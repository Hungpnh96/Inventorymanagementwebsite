using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using StackExchange.Redis;

namespace Inventory;

/// <summary>
/// Runs after JwtBearer authentication and BEFORE Authorization. If the request carries an
/// authenticated identity, verify a Redis session key exists for the JWT id (jti). Missing
/// session = revoked / expired → 401. Redis unreachable = fail-secure → 503.
///
/// Bypass switch: env DISABLE_REDIS_SESSION_CHECK=true (kill-switch — removed 7 days after S1 GA).
/// </summary>
public sealed class SessionValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly SessionStore _store;
    private readonly ILogger<SessionValidationMiddleware> _log;
    private readonly bool _disabled;

    public SessionValidationMiddleware(
        RequestDelegate next,
        SessionStore store,
        ILogger<SessionValidationMiddleware> log)
    {
        _next = next;
        _store = store;
        _log = log;
        _disabled = string.Equals(
            Environment.GetEnvironmentVariable("DISABLE_REDIS_SESSION_CHECK"),
            "true",
            StringComparison.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        // Skip when no authenticated identity (login, health, etc.).
        if (ctx.User?.Identity is null || !ctx.User.Identity.IsAuthenticated)
        {
            await _next(ctx);
            return;
        }

        if (_disabled)
        {
            _log.LogWarning("SessionValidationMiddleware DISABLED via env (kill-switch active)");
            await _next(ctx);
            return;
        }

        var jti = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Jti);
        if (string.IsNullOrEmpty(jti))
        {
            await Unauthorized(ctx, "missing_jti");
            return;
        }

        try
        {
            var exists = await _store.ExistsAsync(jti);
            if (!exists)
            {
                await Unauthorized(ctx, "session_revoked");
                return;
            }
        }
        catch (RedisException ex)
        {
            _log.LogError(ex, "Redis unreachable during session check");
            await ServiceUnavailable(ctx, "auth_unavailable");
            return;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unexpected error during session check");
            await ServiceUnavailable(ctx, "auth_unavailable");
            return;
        }

        await _next(ctx);
    }

    private static async Task Unauthorized(HttpContext ctx, string code)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync($"{{\"error\":\"Phiên đã kết thúc\",\"code\":\"{code}\"}}");
    }

    private static async Task ServiceUnavailable(HttpContext ctx, string code)
    {
        ctx.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync($"{{\"error\":\"Auth service unavailable\",\"code\":\"{code}\"}}");
    }
}
