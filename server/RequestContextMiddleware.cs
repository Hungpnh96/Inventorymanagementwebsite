using System.Security.Claims;

namespace Inventory;

/// <summary>
/// Sets request-scoped log context: requestId (from X-Request-ID or generated) + userId (when authenticated).
/// Writes requestId back on response so callers can correlate.
/// EPIC-003-AC25.
/// </summary>
public sealed class RequestContextMiddleware
{
    public const string RequestIdHeader = "X-Request-ID";

    private readonly RequestDelegate _next;
    private readonly ILogger<RequestContextMiddleware> _log;

    public RequestContextMiddleware(RequestDelegate next, ILogger<RequestContextMiddleware> log)
    {
        _next = next;
        _log = log;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        var requestId = ctx.Request.Headers[RequestIdHeader].ToString();
        if (string.IsNullOrEmpty(requestId)) requestId = Guid.NewGuid().ToString("N");
        ctx.Response.Headers[RequestIdHeader] = requestId;

        var userIdClaim = ctx.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var scope = new Dictionary<string, object?>
        {
            ["requestId"] = requestId,
            ["userId"] = userIdClaim,
            ["path"] = ctx.Request.Path.ToString(),
        };
        using (_log.BeginScope(scope))
        {
            await _next(ctx);
        }
    }
}
