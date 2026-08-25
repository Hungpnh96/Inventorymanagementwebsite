using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Inventory;

/// <summary>
/// Returns an AuthorizationPolicy for any name of the form "&lt;menu&gt;.&lt;action&gt;"
/// where menu ∈ <see cref="Permissions.Menus"/> and action ∈ <see cref="Permissions.Actions"/>.
/// Falls back to the default provider for non-permission policy names (e.g. role checks).
/// </summary>
public sealed class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        var parsed = Permissions.Parse(policyName);
        if (parsed is null) return _fallback.GetPolicyAsync(policyName);

        var (menu, action) = parsed.Value;
        var policy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermissionRequirement(menu, action))
            .Build();
        return Task.FromResult<AuthorizationPolicy?>(policy);
    }
}

/// <summary>Convenience extension so endpoints read declaratively.</summary>
public static class PermissionEndpointExtensions
{
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string menu, string action)
        where TBuilder : Microsoft.AspNetCore.Builder.IEndpointConventionBuilder
    {
        return Microsoft.AspNetCore.Builder.AuthorizationEndpointConventionBuilderExtensions
            .RequireAuthorization(builder, $"{menu}.{action}");
    }
}
