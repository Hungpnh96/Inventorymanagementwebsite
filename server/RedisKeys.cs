namespace Inventory;

/// <summary>
/// Centralized Redis key formatting. No magic strings allowed at call sites.
/// </summary>
public static class RedisKeys
{
    public static string Session(string jti) => $"session:{jti}";
    public static string UserSession(long userId, string jti) => $"session:user:{userId}:{jti}";
    public static string UserSessionPattern(long userId) => $"session:user:{userId}:*";

    public static string LoginRateLimitIp(string ip) => $"login:ratelimit:ip:{ip}";
    public static string LoginRateLimitUser(string usernameLower) => $"login:ratelimit:user:{usernameLower}";
    public static string LoginLock(long userId) => $"login:lock:{userId}";

    public static string PermsUser(long userId) => $"perms:user:{userId}";
}

public static class AuditActions
{
    public const string LoginSuccess = "login.success";
    public const string LoginFailed = "login.failed";
    public const string LoginLocked = "login.locked";
    public const string Logout = "logout";
    public const string PasswordChange = "password.change";
    public const string PasswordReset = "password.reset";

    public const string ProductImport = "product.import";
    public const string ProductReplace = "product.replace";
    public const string ProductDelete = "product.delete";

    public const string TransactionCreate = "transaction.create";

    public const string UserCreate = "user.create";
    public const string UserUpdate = "user.update";
    public const string UserDelete = "user.delete";
    public const string UserPermissionsUpdate = "user.permissions.update";
    public const string UserLogoutAll = "user.logout_all";
}
