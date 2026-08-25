using Dapper;

namespace Inventory;

public sealed class AuditQueryService
{
    private const int DefaultLimit = 50;
    private const int MaxLimit = 200;
    private const int TruncationThreshold = 10_000;

    private readonly Db _db;

    public AuditQueryService(Db db) => _db = db;

    public sealed record Filter(
        DateTime? From,
        DateTime? To,
        string? Actor,
        string? Action,
        string? ResourceType,
        string? ResourceId,
        int Limit,
        long? Cursor);

    public async Task<AuditPageResponse> QueryAsync(Filter f)
    {
        var limit = Math.Clamp(f.Limit <= 0 ? DefaultLimit : f.Limit, 1, MaxLimit);

        var sql = @"
            SELECT id AS Id,
                   at AS At,
                   actor_user_id AS ActorUserId,
                   actor_username AS ActorUsername,
                   actor_role AS ActorRole,
                   action AS Action,
                   resource_type AS ResourceType,
                   resource_id AS ResourceId,
                   before_json::text AS BeforeJson,
                   after_json::text AS AfterJson,
                   host(ip_address) AS IpAddress,
                   user_agent AS UserAgent
              FROM audit_logs
             WHERE 1=1";

        var p = new DynamicParameters();
        if (f.From.HasValue) { sql += " AND at >= @from"; p.Add("from", f.From.Value); }
        if (f.To.HasValue) { sql += " AND at <= @to"; p.Add("to", f.To.Value); }
        if (!string.IsNullOrWhiteSpace(f.Actor)) { sql += " AND actor_username = @actor"; p.Add("actor", f.Actor); }
        if (!string.IsNullOrWhiteSpace(f.Action)) { sql += " AND action = @action"; p.Add("action", f.Action); }
        if (!string.IsNullOrWhiteSpace(f.ResourceType)) { sql += " AND resource_type = @rtype"; p.Add("rtype", f.ResourceType); }
        if (!string.IsNullOrWhiteSpace(f.ResourceId)) { sql += " AND resource_id = @rid"; p.Add("rid", f.ResourceId); }
        if (f.Cursor.HasValue) { sql += " AND id < @cursor"; p.Add("cursor", f.Cursor.Value); }

        // Probe for truncation: count up to TruncationThreshold+1
        var countSql = sql.Replace(
            "SELECT id AS Id,\n                   at AS At,\n                   actor_user_id AS ActorUserId,\n                   actor_username AS ActorUsername,\n                   actor_role AS ActorRole,\n                   action AS Action,\n                   resource_type AS ResourceType,\n                   resource_id AS ResourceId,\n                   before_json::text AS BeforeJson,\n                   after_json::text AS AfterJson,\n                   host(ip_address) AS IpAddress,\n                   user_agent AS UserAgent",
            "SELECT COUNT(*) FROM (SELECT 1 AS x"
        );

        sql += " ORDER BY at DESC, id DESC LIMIT @limit";
        p.Add("limit", limit + 1);

        using var c = await _db.OpenAsync();

        // Lightweight truncation probe using a separate bounded query.
        var truncated = false;
        if (!f.Cursor.HasValue)
        {
            // Explicit casts prevent Postgres 42P08 (could not determine data type)
            // when Dapper sends nullable parameters.
            var probeSql = @"SELECT EXISTS (
                SELECT 1 FROM audit_logs
                 WHERE 1=1
                   AND (CAST(@from AS timestamptz) IS NULL OR at >= CAST(@from AS timestamptz))
                   AND (CAST(@to AS timestamptz) IS NULL OR at <= CAST(@to AS timestamptz))
                   AND (CAST(@actor AS text) IS NULL OR actor_username = CAST(@actor AS text))
                   AND (CAST(@action AS text) IS NULL OR action = CAST(@action AS text))
                   AND (CAST(@rtype AS text) IS NULL OR resource_type = CAST(@rtype AS text))
                   AND (CAST(@rid AS text) IS NULL OR resource_id = CAST(@rid AS text))
                OFFSET @threshold
                LIMIT 1)";
            truncated = await c.ExecuteScalarAsync<bool>(probeSql, new
            {
                from = f.From, to = f.To, actor = f.Actor, action = f.Action,
                rtype = f.ResourceType, rid = f.ResourceId, threshold = TruncationThreshold,
            });
        }

        var rows = (await c.QueryAsync<AuditRow>(sql, p)).ToList();
        string? nextCursor = null;
        if (rows.Count > limit)
        {
            nextCursor = $"id:{rows[limit - 1].Id}";
            rows = rows.Take(limit).ToList();
        }

        return new AuditPageResponse(rows, nextCursor, truncated);
    }
}
