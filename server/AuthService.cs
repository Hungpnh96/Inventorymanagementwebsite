using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Dapper;

namespace Inventory;

public class AuthService
{
    private readonly Db _db;
    private readonly byte[] _jwtKey;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expiryHours;

    public AuthService(Db db, string jwtSecret, string issuer, string audience, int expiryHours)
    {
        _db = db;
        _jwtKey = Encoding.UTF8.GetBytes(jwtSecret);
        if (_jwtKey.Length < 32) throw new InvalidOperationException("JWT_SECRET must be at least 32 bytes");
        _issuer = issuer;
        _audience = audience;
        _expiryHours = expiryHours;
    }

    public byte[] JwtKey => _jwtKey;
    public string Issuer => _issuer;
    public string Audience => _audience;

    public static string HashPassword(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, workFactor: 11);

    public static bool VerifyPassword(string password, string hash) =>
        BCrypt.Net.BCrypt.Verify(password, hash);

    public async Task<UserRow?> FindByUsernameAsync(string username)
    {
        using var c = await _db.OpenAsync();
        return await c.QuerySingleOrDefaultAsync<UserRow>(@"
            SELECT id, username, username_lower AS UsernameLower, full_name AS FullName,
                   password_hash AS PasswordHash, role, must_change_password AS MustChangePassword,
                   failed_login_attempts AS FailedLoginAttempts, locked_until AS LockedUntil,
                   created_at AS CreatedAt, updated_at AS UpdatedAt, deleted_at AS DeletedAt,
                   status
            FROM users WHERE username_lower = @u AND deleted_at IS NULL",
            new { u = username.Trim().ToLowerInvariant() });
    }

    public async Task<UserRow?> FindByIdAsync(long id)
    {
        using var c = await _db.OpenAsync();
        return await c.QuerySingleOrDefaultAsync<UserRow>(@"
            SELECT id, username, username_lower AS UsernameLower, full_name AS FullName,
                   password_hash AS PasswordHash, role, must_change_password AS MustChangePassword,
                   failed_login_attempts AS FailedLoginAttempts, locked_until AS LockedUntil,
                   created_at AS CreatedAt, updated_at AS UpdatedAt, deleted_at AS DeletedAt,
                   status
            FROM users WHERE id = @id AND deleted_at IS NULL",
            new { id });
    }

    public async Task UpdatePasswordAsync(long userId, string newHash, bool clearMustChange)
    {
        using var c = await _db.OpenAsync();
        await c.ExecuteAsync(@"
            UPDATE users
               SET password_hash = @h,
                   must_change_password = CASE WHEN @clear THEN FALSE ELSE must_change_password END,
                   updated_at = NOW()
             WHERE id = @id",
            new { h = newHash, clear = clearMustChange, id = userId });
    }

    public sealed record IssuedToken(string Token, string Jti, TimeSpan Ttl);

    public IssuedToken IssueToken(UserRow user)
    {
        var creds = new SigningCredentials(new SymmetricSecurityKey(_jwtKey), SecurityAlgorithms.HmacSha256);
        var jti = Guid.NewGuid().ToString("N");
        var ttl = TimeSpan.FromHours(_expiryHours);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, jti),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("must_change_password", user.MustChangePassword ? "1" : "0"),
        };
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(ttl),
            signingCredentials: creds);
        return new IssuedToken(new JwtSecurityTokenHandler().WriteToken(token), jti, ttl);
    }

    public int ExpiryHours => _expiryHours;

    public sealed record RegisterResult(bool Ok, string? Error, long? UserId);

    /// <summary>
    /// EPIC-007 — public self-registration. The account lands in `pending` and cannot log in
    /// until an admin approves it. `role` is hard-coded to 'user': self-registration must never
    /// be able to mint an admin account.
    /// </summary>
    public async Task<RegisterResult> RegisterAsync(string username, string password, string fullName)
    {
        if (string.IsNullOrWhiteSpace(username))
            return new RegisterResult(false, "Username là bắt buộc", null);
        if (string.IsNullOrEmpty(password) || password.Length < 8)
            return new RegisterResult(false, "Password phải có ít nhất 8 ký tự", null);

        var u = username.Trim();
        var ul = u.ToLowerInvariant();
        var hash = HashPassword(password);

        try
        {
            using var c = await _db.OpenAsync();
            var id = await c.ExecuteScalarAsync<long>(@"
                INSERT INTO users (username, username_lower, full_name, password_hash, role, must_change_password, status)
                VALUES (@u, @ul, @fn, @h, 'user', FALSE, 'pending')
                RETURNING id",
                new { u, ul, fn = fullName?.Trim() ?? "", h = hash });
            return new RegisterResult(true, null, id);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
        {
            return new RegisterResult(false, "Username đã tồn tại", null);
        }
    }

    /// <summary>
    /// Idempotent DDL guard. Db/005_user_status.sql only runs on FIRST boot of the postgres
    /// container (docker-entrypoint-initdb.d), so already-provisioned databases would otherwise
    /// never get the column. Same statement, safe to re-run.
    /// </summary>
    public async Task EnsureUserStatusColumnAsync()
    {
        using var c = await _db.OpenAsync();
        await c.ExecuteAsync(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','rejected'))");
    }

    public async Task SeedAdminIfMissingAsync(string username, string password)
    {
        using var c = await _db.OpenAsync();
        var any = await c.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL");
        if (any > 0) return;

        var hash = HashPassword(password);
        await c.ExecuteAsync(@"
            INSERT INTO users (username, username_lower, full_name, password_hash, role, must_change_password)
            VALUES (@u, @ul, 'Administrator', @h, 'admin', TRUE)",
            new { u = username, ul = username.Trim().ToLowerInvariant(), h = hash });
    }
}

public record UserRow(
    long Id,
    string Username,
    string UsernameLower,
    string FullName,
    string PasswordHash,
    string Role,
    bool MustChangePassword,
    int FailedLoginAttempts,
    DateTime? LockedUntil,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? DeletedAt,
    string Status
);
