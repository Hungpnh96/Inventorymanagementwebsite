using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace Inventory;

/// <summary>
/// Resolves <see cref="PermissionRequirement"/> by consulting <see cref="PermissionService"/>.
/// Admin role short-circuits to allow. Kill-switch: env <c>PERMISSION_ENFORCEMENT_ENABLED=false</c>
/// allows all authenticated requests (legacy behavior). Removed in S7 cleanup.
/// </summary>
public sealed class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly PermissionService _perms;
    private readonly ILogger<PermissionHandler> _log;
    private readonly bool _disabled;

    public PermissionHandler(PermissionService perms, ILogger<PermissionHandler> log)
    {
        _perms = perms;
        _log = log;
        _disabled = string.Equals(
            Environment.GetEnvironmentVariable("PERMISSION_ENFORCEMENT_ENABLED"),
            "false",
            StringComparison.OrdinalIgnoreCase);
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        // Authentication itself happens upstream (JwtBearer + SessionValidationMiddleware).
        // If we reach here without an authenticated user, fail.
        var user = context.User;
        if (user?.Identity is null || !user.Identity.IsAuthenticated)
            return; // requirement remains unfulfilled → 403

        // Kill-switch (legacy behavior). Logged once per request so ops can see it.
        if (_disabled)
        {
            _log.LogWarning("Permission enforcement DISABLED via env (kill-switch active)");
            context.Succeed(requirement);
            return;
        }

        // Admin short-circuit.
        if (user.IsInRole("admin"))
        {
            context.Succeed(requirement);
            return;
        }

        // Resolve user id from claims.
        var idStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!long.TryParse(idStr, out var userId))
            return; // malformed token → 403

        // Load matrix (cached) and check.
        var matrix = await _perms.LoadAsync(userId);
        if (matrix.TryGetValue(requirement.Menu, out var sub)
            && sub.TryGetValue(requirement.Action, out var allowed)
            && allowed)
        {
            context.Succeed(requirement);
        }
        // else: requirement remains unfulfilled → 403 via Authorization middleware
    }
}
