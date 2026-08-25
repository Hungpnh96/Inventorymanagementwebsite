using System.Security.Cryptography;
using Dapper;

namespace Inventory;

/// <summary>
/// Admin operations on users + permissions. All methods are intended to be called
/// from endpoints that already validated the caller is an admin.
/// </summary>
public sealed class UserAdminService
{
    private static readonly string[] Menus = { "dashboard", "inventory", "transactions", "reports", "users" };
    private static readonly string[] Actions = { "view", "create", "update", "delete" };

    private readonly Db _db;
    private readonly SessionStore _sessions;
    private readonly PermissionService? _perms;

    public UserAdminService(Db db, SessionStore sessions, PermissionService? perms = null)
    {
        _db = db;
        _sessions = sessions;
        _perms = perms;
    }

    // ---------- LIST ----------

    public async Task<List<UserListItem>> ListAsync()
    {
        using var c = await _db.OpenAsync();
        var rows = (await c.QueryAsync<UserRow>(@"
            SELECT id, username, username_lower AS UsernameLower, full_name AS FullName,
                   password_hash AS PasswordHash, role, must_change_password AS MustChangePassword,
                   failed_login_attempts AS FailedLoginAttempts, locked_until AS LockedUntil,
                   created_at AS CreatedAt, updated_at AS UpdatedAt, deleted_at AS DeletedAt,
                   status
              FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC")).ToList();

        var result = new List<UserListItem>(rows.Count);
        foreach (var r in rows)
        {
            var sessions = await _sessions.CountActiveAsync(r.Id);
            result.Add(ToListItem(r, sessions));
        }
        return result;
    }

    private static UserListItem ToListItem(UserRow r, long activeSessions) =>
        new(r.Id, r.Username, r.FullName, r.Role,
            r.MustChangePassword, r.LockedUntil, r.CreatedAt, activeSessions, r.Status);

    /// <summary>
    /// Single-user variant of <see cref="ListAsync"/> — same projection, used to return the
    /// fresh row after an approve/reject transition.
    /// </summary>
    private async Task<UserListItem?> GetUserListItemAsync(long id)
    {
        using var c = await _db.OpenAsync();
        var row = await c.QuerySingleOrDefaultAsync<UserRow>(@"
            SELECT id, username, username_lower AS UsernameLower, full_name AS FullName,
                   password_hash AS PasswordHash, role, must_change_password AS MustChangePassword,
                   failed_login_attempts AS FailedLoginAttempts, locked_until AS LockedUntil,
                   created_at AS CreatedAt, updated_at AS UpdatedAt, deleted_at AS DeletedAt,
                   status
              FROM users WHERE id = @id AND deleted_at IS NULL",
            new { id });
        if (row is null) return null;

        var sessions = await _sessions.CountActiveAsync(row.Id);
        return ToListItem(row, sessions);
    }

    // ---------- CREATE ----------

    public sealed record CreateResult(bool Ok, string? Error, UserListItem? User);

    public async Task<CreateResult> CreateAsync(CreateUserRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Username))
            return new CreateResult(false, "Username là bắt buộc", null);
        if (body.Role is not ("admin" or "user"))
            return new CreateResult(false, "Role không hợp lệ", null);
        if (string.IsNullOrEmpty(body.TempPassword) || body.TempPassword.Length < 8)
            return new CreateResult(false, "Password tạm phải có ít nhất 8 ký tự", null);

        var username = body.Username.Trim();
        var usernameLower = username.ToLowerInvariant();
        var hash = AuthService.HashPassword(body.TempPassword);

        try
        {
            using var c = await _db.OpenAsync();
            var id = await c.ExecuteScalarAsync<long>(@"
                INSERT INTO users (username, username_lower, full_name, password_hash, role, must_change_password)
                VALUES (@u, @ul, @fn, @h, @r, TRUE)
                RETURNING id",
                new { u = username, ul = usernameLower, fn = body.FullName ?? "", h = hash, r = body.Role });

            // Sensible defaults: inventory.view + transactions.view (read-only access).
            await SetDefaultPermissionsAsync(c, id, body.Role);

            var item = new UserListItem(
                id, username, body.FullName ?? "", body.Role,
                MustChangePassword: true, LockedUntil: null,
                CreatedAt: DateTime.UtcNow, ActiveSessions: 0,
                Status: "active"); // admin-created users are active immediately (column default)
            return new CreateResult(true, null, item);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
        {
            return new CreateResult(false, "Username đã tồn tại", null);
        }
    }

    private static async Task SetDefaultPermissionsAsync(Npgsql.NpgsqlConnection c, long userId, string role)
    {
        if (role == "admin") return; // admins short-circuit checks; no rows needed.

        var defaults = new[]
        {
            ("dashboard", "view", true),
            ("inventory", "view", true),
            ("transactions", "view", true),
        };
        foreach (var (menu, action, allowed) in defaults)
        {
            await c.ExecuteAsync(@"
                INSERT INTO user_permissions (user_id, menu, action, allowed)
                VALUES (@u, @m, @a, @al)
                ON CONFLICT (user_id, menu, action) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW()",
                new { u = userId, m = menu, a = action, al = allowed });
        }
    }

    // ---------- UPDATE PROFILE ----------

    public sealed record UpdateProfileResult(bool Ok, string? Error, UserListItem? Before, UserListItem? After);

    private sealed record UserProjection(long Id, string Username, string FullName, string Role,
        bool MustChangePassword, DateTime? LockedUntil, DateTime CreatedAt, string Status);

    public async Task<UpdateProfileResult> UpdateProfileAsync(long targetUserId, string fullName)
    {
        fullName ??= "";
        if (fullName.Length > 200)
            return new UpdateProfileResult(false, "Tên đầy đủ vượt quá 200 ký tự", null, null);

        using var c = await _db.OpenAsync();
        var existing = await c.QuerySingleOrDefaultAsync<UserProjection>(@"
            SELECT id AS Id,
                   username AS Username,
                   full_name AS FullName,
                   role AS Role,
                   must_change_password AS MustChangePassword,
                   locked_until AS LockedUntil,
                   created_at AS CreatedAt,
                   status AS Status
              FROM users WHERE id = @id AND deleted_at IS NULL",
            new { id = targetUserId });
        if (existing is null)
            return new UpdateProfileResult(false, "User không tồn tại", null, null);

        var before = new UserListItem(
            existing.Id, existing.Username, existing.FullName, existing.Role,
            existing.MustChangePassword, existing.LockedUntil, existing.CreatedAt,
            ActiveSessions: 0, Status: existing.Status);

        await c.ExecuteAsync(
            "UPDATE users SET full_name = @fn, updated_at = NOW() WHERE id = @id",
            new { fn = fullName, id = targetUserId });

        var after = before with { FullName = fullName };
        return new UpdateProfileResult(true, null, before, after);
    }

    // ---------- DELETE (soft) ----------

    public sealed record DeleteResult(bool Ok, string? Error);

    public async Task<DeleteResult> SoftDeleteAsync(long actorUserId, long targetUserId)
    {
        if (actorUserId == targetUserId)
            return new DeleteResult(false, "Không thể tự xoá tài khoản của mình.");

        using var c = await _db.OpenAsync();
        var target = await c.QuerySingleOrDefaultAsync<UserRow>(@"
            SELECT id, username, username_lower AS UsernameLower, full_name AS FullName,
                   password_hash AS PasswordHash, role, must_change_password AS MustChangePassword,
                   failed_login_attempts AS FailedLoginAttempts, locked_until AS LockedUntil,
                   created_at AS CreatedAt, updated_at AS UpdatedAt, deleted_at AS DeletedAt,
                   status
              FROM users WHERE id = @id AND deleted_at IS NULL",
            new { id = targetUserId });

        if (target is null) return new DeleteResult(false, "User không tồn tại");

        if (target.Role == "admin")
        {
            var adminCount = await c.ExecuteScalarAsync<long>(
                "SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL");
            if (adminCount <= 1)
                return new DeleteResult(false, "Phải còn ít nhất 1 admin.");
        }

        await c.ExecuteAsync(
            "UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = @id",
            new { id = targetUserId });

        // Force-logout from all devices.
        await _sessions.RevokeAllForUserAsync(targetUserId);

        return new DeleteResult(true, null);
    }

    // ---------- APPROVE / REJECT (EPIC-007) ----------

    /// <summary>
    /// Activates a self-registered account. Deliberately does NOT grant any permissions:
    /// approval only unblocks login, the admin assigns the matrix afterwards via
    /// PUT /api/admin/users/{id}/permissions. With no permission rows, GetPermissionsAsync
    /// naturally returns BlankMatrix().
    /// </summary>
    public async Task<ApproveRejectResult> ApproveAsync(long targetUserId)
    {
        using var c = await _db.OpenAsync();
        var rows = await c.ExecuteAsync(
            "UPDATE users SET status = 'active', updated_at = NOW() WHERE id = @id AND status = 'pending' AND deleted_at IS NULL",
            new { id = targetUserId });
        if (rows == 0)
            return new ApproveRejectResult(false, "User không ở trạng thái chờ duyệt", null);

        var updated = await GetUserListItemAsync(targetUserId);
        return new ApproveRejectResult(true, null, updated);
    }

    /// <summary>
    /// Marks a self-registered account as rejected. The row is kept (audit trail) but login
    /// stays blocked. Only transitions FROM 'pending', so a stale UI cannot un-approve a user.
    /// </summary>
    public async Task<ApproveRejectResult> RejectAsync(long targetUserId)
    {
        using var c = await _db.OpenAsync();
        var rows = await c.ExecuteAsync(
            "UPDATE users SET status = 'rejected', updated_at = NOW() WHERE id = @id AND status = 'pending' AND deleted_at IS NULL",
            new { id = targetUserId });
        if (rows == 0)
            return new ApproveRejectResult(false, "User không ở trạng thái chờ duyệt", null);

        // Defensive: a pending user can never have had a session, but this keeps the
        // "access revoked => sessions killed" invariant symmetric with SoftDeleteAsync.
        await _sessions.RevokeAllForUserAsync(targetUserId);

        var updated = await GetUserListItemAsync(targetUserId);
        return new ApproveRejectResult(true, null, updated);
    }

    // ---------- PERMISSIONS ----------

    public async Task<Dictionary<string, Dictionary<string, bool>>> GetPermissionsAsync(long userId)
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

    public sealed record UpdatePermsResult(bool Ok, string? Error, Dictionary<string, Dictionary<string, bool>>? Before, Dictionary<string, Dictionary<string, bool>>? After);

    public async Task<UpdatePermsResult> UpdatePermissionsAsync(long actorUserId, long targetUserId, PermissionsMatrix req)
    {
        using var c = await _db.OpenAsync();
        var exists = await c.ExecuteScalarAsync<long>(
            "SELECT COUNT(*) FROM users WHERE id = @id AND deleted_at IS NULL", new { id = targetUserId });
        if (exists == 0) return new UpdatePermsResult(false, "User không tồn tại", null, null);

        var before = await GetPermissionsAsync(targetUserId);

        // Validate keys
        foreach (var (menu, sub) in req.Permissions)
        {
            if (!Menus.Contains(menu))
                return new UpdatePermsResult(false, $"Menu không hợp lệ: {menu}", null, null);
            foreach (var (action, _) in sub)
            {
                if (!Actions.Contains(action))
                    return new UpdatePermsResult(false, $"Action không hợp lệ: {action}", null, null);
            }
        }

        using var tx = await c.BeginTransactionAsync();
        // Replace by upsert. We keep absent keys at their old value (predictable additive semantics)
        // — caller is expected to send a full matrix from the matrix UI.
        foreach (var (menu, sub) in req.Permissions)
        foreach (var (action, allowed) in sub)
        {
            await c.ExecuteAsync(@"
                INSERT INTO user_permissions (user_id, menu, action, allowed)
                VALUES (@u, @m, @a, @al)
                ON CONFLICT (user_id, menu, action) DO UPDATE
                  SET allowed = EXCLUDED.allowed, updated_at = NOW()",
                new { u = targetUserId, m = menu, a = action, al = allowed }, tx);
        }
        await tx.CommitAsync();

        // EPIC-003-AC16: invalidate-on-write so the user sees new perms on next request, not 30s later.
        if (_perms is not null) await _perms.InvalidateAsync(targetUserId);

        var after = await GetPermissionsAsync(targetUserId);
        return new UpdatePermsResult(true, null, before, after);
    }

    // ---------- RESET PASSWORD ----------

    public sealed record ResetResult(bool Ok, string? Error, string? TempPassword);

    public async Task<ResetResult> ResetPasswordAsync(long targetUserId)
    {
        using var c = await _db.OpenAsync();
        var exists = await c.ExecuteScalarAsync<long>(
            "SELECT COUNT(*) FROM users WHERE id = @id AND deleted_at IS NULL", new { id = targetUserId });
        if (exists == 0) return new ResetResult(false, "User không tồn tại", null);

        var temp = GenerateTempPassword();
        var hash = AuthService.HashPassword(temp);
        await c.ExecuteAsync(@"
            UPDATE users
               SET password_hash = @h,
                   must_change_password = TRUE,
                   failed_login_attempts = 0,
                   locked_until = NULL,
                   updated_at = NOW()
             WHERE id = @id",
            new { h = hash, id = targetUserId });

        // Force re-login on all devices.
        await _sessions.RevokeAllForUserAsync(targetUserId);

        return new ResetResult(true, null, temp);
    }

    // ---------- LOGOUT ALL ----------

    public async Task<int> LogoutAllAsync(long targetUserId) =>
        await _sessions.RevokeAllForUserAsync(targetUserId);

    // ---------- HELPERS ----------

    public static Dictionary<string, Dictionary<string, bool>> BlankMatrix()
    {
        var d = new Dictionary<string, Dictionary<string, bool>>(Menus.Length);
        foreach (var m in Menus)
        {
            var sub = new Dictionary<string, bool>(Actions.Length);
            foreach (var a in Actions) sub[a] = false;
            d[m] = sub;
        }
        return d;
    }

    private static string GenerateTempPassword()
    {
        // 16 chars: A-Z a-z 0-9 + a few symbols. Avoid ambiguous chars (0/O, l/1).
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
        var bytes = new byte[16];
        RandomNumberGenerator.Fill(bytes);
        var sb = new System.Text.StringBuilder(16);
        foreach (var b in bytes) sb.Append(chars[b % chars.Length]);
        return sb.ToString();
    }
}
