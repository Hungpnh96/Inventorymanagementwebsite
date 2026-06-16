using System.Text.Json;
using Dapper;
using StackExchange.Redis;

namespace Inventory;

/// <summary>
/// Loads + caches per-user permission matrix. Source of truth = Postgres user_permissions table.
/// Cache layer = Redis perms:user:&lt;id&gt; with 30s TTL.
///
/// Invalidation strategy: invalidate-on-write — callers (UserAdminService.UpdatePermissionsAsync)
/// invoke <see cref="InvalidateAsync"/> after committing changes. 30s TTL is a safety net only.
///
/// Admins short-circuit in the consumer (PermissionHandler) — this service does NOT special-case
/// the admin role; it returns whatever rows the DB has (typically empty for admins).
/// </summary>
public sealed class PermissionService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = null };

    private readonly Db _db;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<PermissionService> _log;

    public PermissionService(Db db, IConnectionMultiplexer redis, ILogger<PermissionService> log)
    {
        _db = db;
        _redis = redis;
        _log = log;
    }

    public async Task<Dictionary<string, Dictionary<string, bool>>> LoadAsync(long userId)
    {
        var key = RedisKeys.PermsUser(userId);
        try
        {
            var cached = await _redis.GetDatabase().StringGetAsync(key);
            if (cached.HasValue)
            {
                var deserialized = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, bool>>>(cached!, JsonOpts);
                if (deserialized is not null) return deserialized;
            }
        }
        catch (RedisException ex)
        {
            // Cache miss is acceptable; bubble up RedisException would block the request — instead,
            // fall back to DB read. Per AC19, if Redis is *totally* down, SessionValidationMiddleware
            // already returns 503 before we reach this code path.
            _log.LogWarning(ex, "Permission cache read failed; falling back to DB");
        }

        var matrix = await LoadFromDbAsync(userId);

        try
        {
            await _redis.GetDatabase().StringSetAsync(
                key,
                JsonSerializer.Serialize(matrix, JsonOpts),
                CacheTtl);
        }
        catch (RedisException ex)
        {
            _log.LogWarning(ex, "Permission cache write failed; continuing without cache");
        }

        return matrix;
    }

    public async Task InvalidateAsync(long userId)
    {
        try
        {
            await _redis.GetDatabase().KeyDeleteAsync(RedisKeys.PermsUser(userId));
        }
        catch (RedisException ex)
        {
            // Best-effort. Worst case: stale cache expires in 30s.
            _log.LogWarning(ex, "Permission cache invalidate failed for user {UserId}", userId);
        }
    }

    private async Task<Dictionary<string, Dictionary<string, bool>>> LoadFromDbAsync(long userId)
    {
        using var c = await _db.OpenAsync();
        var rows = await c.QueryAsync<(string Menu, string Action, bool Allowed)>(@"
            SELECT menu, action, allowed FROM user_permissions WHERE user_id = @u",
            new { u = userId });

        var matrix = BlankMatrix();
        foreach (var (menu, action, allowed) in rows)
        {
            if (matrix.TryGetValue(menu, out var sub) && sub.ContainsKey(action))
                sub[action] = allowed;
        }
        return matrix;
    }

    public static Dictionary<string, Dictionary<string, bool>> BlankMatrix()
    {
        var d = new Dictionary<string, Dictionary<string, bool>>(Permissions.Menus.Length);
        foreach (var m in Permissions.Menus)
        {
            var sub = new Dictionary<string, bool>(Permissions.Actions.Length);
            foreach (var a in Permissions.Actions) sub[a] = false;
            d[m] = sub;
        }
        return d;
    }
}
