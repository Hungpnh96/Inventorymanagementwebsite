using Dapper;
using StackExchange.Redis;

namespace Inventory;

/// <summary>
/// Login rate limiting + account lockout. Rate limits per-IP and per-username via Redis counters.
/// Lockout state is dual-tracked in DB (users.failed_login_attempts, users.locked_until) and
/// mirrored in Redis for fast pre-check (EPIC-003 §4.2).
/// </summary>
public sealed class LoginThrottle
{
    private const int IpLimitPerMinute = 10;
    private const int UserLimitPerMinute = 5;
    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 15;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    private readonly IConnectionMultiplexer _redis;
    private readonly Db _db;
    private readonly IClock _clock;

    public LoginThrottle(IConnectionMultiplexer redis, Db db, IClock clock)
    {
        _redis = redis;
        _db = db;
        _clock = clock;
    }

    public sealed record RateLimitResult(bool Allowed, int RetryAfterSeconds);

    public async Task<RateLimitResult> CheckRateLimitAsync(string ip, string usernameLower)
    {
        var redis = _redis.GetDatabase();
        var ipKey = RedisKeys.LoginRateLimitIp(ip);
        var userKey = RedisKeys.LoginRateLimitUser(usernameLower);

        var ipCount = await redis.StringIncrementAsync(ipKey);
        if (ipCount == 1) await redis.KeyExpireAsync(ipKey, Window);
        var userCount = await redis.StringIncrementAsync(userKey);
        if (userCount == 1) await redis.KeyExpireAsync(userKey, Window);

        if (ipCount > IpLimitPerMinute)
        {
            var ttl = await redis.KeyTimeToLiveAsync(ipKey);
            return new RateLimitResult(false, (int)Math.Ceiling((ttl ?? Window).TotalSeconds));
        }
        if (userCount > UserLimitPerMinute)
        {
            var ttl = await redis.KeyTimeToLiveAsync(userKey);
            return new RateLimitResult(false, (int)Math.Ceiling((ttl ?? Window).TotalSeconds));
        }
        return new RateLimitResult(true, 0);
    }

    /// <returns>locked-until timestamp if currently locked; null if not locked.</returns>
    public async Task<DateTime?> GetLockoutAsync(UserRow user)
    {
        if (user.LockedUntil is null) return null;
        if (user.LockedUntil <= _clock.UtcNow) return null;
        return user.LockedUntil;
    }

    public async Task RegisterFailureAsync(UserRow user)
    {
        var newCount = user.FailedLoginAttempts + 1;
        DateTime? lockedUntil = null;
        if (newCount >= MaxFailedAttempts)
            lockedUntil = _clock.UtcNow.AddMinutes(LockoutMinutes);

        using var c = await _db.OpenAsync();
        await c.ExecuteAsync(@"
            UPDATE users
               SET failed_login_attempts = @n,
                   locked_until = @lu,
                   updated_at = NOW()
             WHERE id = @id",
            new { n = newCount, lu = lockedUntil, id = user.Id });

        if (lockedUntil.HasValue)
        {
            await _redis.GetDatabase().StringSetAsync(
                RedisKeys.LoginLock(user.Id),
                lockedUntil.Value.ToString("O"),
                TimeSpan.FromMinutes(LockoutMinutes) + TimeSpan.FromSeconds(5));
        }
    }

    public async Task ResetFailureAsync(long userId)
    {
        using var c = await _db.OpenAsync();
        await c.ExecuteAsync(@"
            UPDATE users
               SET failed_login_attempts = 0,
                   locked_until = NULL,
                   updated_at = NOW()
             WHERE id = @id AND (failed_login_attempts > 0 OR locked_until IS NOT NULL)",
            new { id = userId });
        await _redis.GetDatabase().KeyDeleteAsync(RedisKeys.LoginLock(userId));
    }

    public bool ShouldLockAfterFailure(int currentFailedAttempts) =>
        currentFailedAttempts + 1 >= MaxFailedAttempts;
}
