using Microsoft.AspNetCore.Authorization;

namespace Inventory;

/// <summary>
/// Authorization requirement carrying a single menu.action permission check.
/// Resolved by <see cref="PermissionHandler"/> against the user's cached permission matrix.
/// </summary>
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public string Menu { get; }
    public string Action { get; }

    public PermissionRequirement(string menu, string action)
    {
        Menu = menu;
        Action = action;
    }

    public string PolicyName => $"{Menu}.{Action}";
}

/// <summary>Centralized list of valid menus and actions. Single source of truth.</summary>
public static class Permissions
{
    public static readonly string[] Menus = { "dashboard", "inventory", "transactions", "reports", "users" };
    public static readonly string[] Actions = { "view", "create", "update", "delete" };

    public static bool IsValidName(string menu, string action) =>
        Array.IndexOf(Menus, menu) >= 0 && Array.IndexOf(Actions, action) >= 0;

    /// <summary>Parse "menu.action" policy name. Returns null on malformed input.</summary>
    public static (string Menu, string Action)? Parse(string policyName)
    {
        var dot = policyName.IndexOf('.');
        if (dot <= 0 || dot >= policyName.Length - 1) return null;
        var menu = policyName[..dot];
        var action = policyName[(dot + 1)..];
        return IsValidName(menu, action) ? (menu, action) : null;
    }
}
