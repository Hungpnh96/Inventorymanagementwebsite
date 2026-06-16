using StackExchange.Redis;

namespace Inventory;

/// <summary>
/// Redis-backed session store. A session = a Redis key per JWT id (jti) with TTL = token expiry.
/// The presence of the key proves the session has not been revoked (logout / force-logout-all).
/// </summary>
public sealed class SessionStore
{
    private readonly IConnectionMultiplexer _redis;

    public SessionStore(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    private IDatabase Db => _redis.GetDatabase();

    public async Task CreateAsync(string jti, long userId, string role, TimeSpan ttl)
    {
        var batch = Db.CreateBatch();
        var t1 = batch.StringSetAsync(
            RedisKeys.Session(jti),
            $"{userId}|{role}",
            ttl);
        var t2 = batch.StringSetAsync(
            RedisKeys.UserSession(userId, jti),
            "1",
            ttl);
        batch.Execute();
        await Task.WhenAll(t1, t2);
    }

    /// <returns>true if session exists; false if missing (revoked or expired).</returns>
    public async Task<bool> ExistsAsync(string jti)
    {
        return await Db.KeyExistsAsync(RedisKeys.Session(jti));
    }

    public async Task RevokeAsync(string jti, long userId)
    {
        var batch = Db.CreateBatch();
        var t1 = batch.KeyDeleteAsync(RedisKeys.Session(jti));
        var t2 = batch.KeyDeleteAsync(RedisKeys.UserSession(userId, jti));
        batch.Execute();
        await Task.WhenAll(t1, t2);
    }

    /// <summary>
    /// Revoke ALL sessions for a user (force logout from all devices). Uses SCAN (non-blocking),
    /// never KEYS. EPIC-003 Risk §12.
    /// </summary>
    public async Task<int> RevokeAllForUserAsync(long userId)
    {
        var server = _redis.GetServer(_redis.GetEndPoints().First());
        var deleted = 0;
        await foreach (var key in server.KeysAsync(pattern: RedisKeys.UserSessionPattern(userId), pageSize: 250))
        {
            var keyStr = key.ToString();
            // session:user:<id>:<jti> → extract jti
            var jti = keyStr[(keyStr.LastIndexOf(':') + 1)..];
            await Db.KeyDeleteAsync(RedisKeys.Session(jti));
            await Db.KeyDeleteAsync(key);
            deleted++;
        }
        return deleted;
    }

    public async Task<long> CountActiveAsync(long userId)
    {
        var server = _redis.GetServer(_redis.GetEndPoints().First());
        long count = 0;
        await foreach (var _ in server.KeysAsync(pattern: RedisKeys.UserSessionPattern(userId), pageSize: 250))
            count++;
        return count;
    }
}
