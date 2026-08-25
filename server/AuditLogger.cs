using System.Text.Json;
using Dapper;

namespace Inventory;

public interface IAuditLogger
{
    Task LogAsync(
        string action,
        string resourceType,
        string? resourceId,
        long? actorUserId,
        string actorUsername,
        string actorRole,
        object? before,
        object? after,
        string? ipAddress,
        string? userAgent);
}

public sealed class AuditLogger : IAuditLogger
{
    private readonly Db _db;
    private readonly ILogger<AuditLogger> _log;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public AuditLogger(Db db, ILogger<AuditLogger> log)
    {
        _db = db;
        _log = log;
    }

    public async Task LogAsync(
        string action,
        string resourceType,
        string? resourceId,
        long? actorUserId,
        string actorUsername,
        string actorRole,
        object? before,
        object? after,
        string? ipAddress,
        string? userAgent)
    {
        try
        {
            using var c = await _db.OpenAsync();
            await c.ExecuteAsync(@"
                INSERT INTO audit_logs (
                    actor_user_id, actor_username, actor_role, action,
                    resource_type, resource_id, before_json, after_json,
                    ip_address, user_agent, at
                ) VALUES (
                    @actorUserId, @actorUsername, @actorRole, @action,
                    @resourceType, @resourceId, @beforeJson::jsonb, @afterJson::jsonb,
                    @ipAddress::inet, @userAgent, NOW()
                )",
                new
                {
                    actorUserId,
                    actorUsername,
                    actorRole,
                    action,
                    resourceType,
                    resourceId,
                    beforeJson = before is null ? null : JsonSerializer.Serialize(before, JsonOpts),
                    afterJson = after is null ? null : JsonSerializer.Serialize(after, JsonOpts),
                    ipAddress,
                    userAgent,
                });
        }
        catch (Exception ex)
        {
            // Auth should not depend on logging (EPIC-003 §6.4). Emit and swallow.
            _log.LogError(ex, "audit_write_failed action={Action} resource={ResourceType}:{ResourceId}",
                action, resourceType, resourceId);
        }
    }
}

/// <summary>Helper extracting request context for audit calls.</summary>
public static class AuditContext
{
    public static string? GetIp(HttpContext ctx) =>
        ctx.Connection.RemoteIpAddress?.ToString();

    public static string? GetUserAgent(HttpContext ctx) =>
        ctx.Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null;
}
