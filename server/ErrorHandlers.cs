using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Diagnostics;

namespace Inventory;

/// <summary>
/// EPIC-004 hotfix: emit a JSON body for 403 (instead of ASP.NET's empty/framework default)
/// so the frontend can show a meaningful toast. Covers AC15 of EPIC-003.
/// </summary>
public sealed class JsonAuthorizationMiddlewareResultHandler : IAuthorizationMiddlewareResultHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly AuthorizationMiddlewareResultHandler _default = new();

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult result)
    {
        if (result.Forbidden && !context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json; charset=utf-8";
            var body = JsonSerializer.Serialize(new
            {
                error = "Không có quyền thực hiện hành động này",
                code = "permission_denied",
            }, JsonOpts);
            await context.Response.WriteAsync(body);
            return;
        }
        if (result.Challenged && !context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json; charset=utf-8";
            var body = JsonSerializer.Serialize(new
            {
                error = "Phiên đăng nhập đã kết thúc",
                code = "unauthorized",
            }, JsonOpts);
            await context.Response.WriteAsync(body);
            return;
        }
        await _default.HandleAsync(next, context, policy, result);
    }
}

/// <summary>
/// EPIC-004 hotfix: catch unhandled exceptions and emit a JSON body so the frontend can
/// always display SOMETHING. Stack traces never go to the wire.
/// </summary>
public static class JsonExceptionHandler
{
    public static void Use(WebApplication app)
    {
        app.UseExceptionHandler(builder => builder.Run(async ctx =>
        {
            var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
            var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JsonExceptionHandler");
            logger.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);

            if (ctx.Response.HasStarted) return;
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/json; charset=utf-8";
            var isDev = ctx.RequestServices.GetService<IHostEnvironment>()?.IsDevelopment() ?? false;
            var body = JsonSerializer.Serialize(new
            {
                error = "Lỗi máy chủ. Vui lòng thử lại hoặc liên hệ admin.",
                code = "internal_error",
                detail = isDev ? ex?.Message : null,
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            await ctx.Response.WriteAsync(body);
        }));
    }
}
