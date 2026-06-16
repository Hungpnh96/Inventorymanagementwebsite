using FluentAssertions;
using Inventory;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;
using Xunit;
using StackExchange.Redis;
using Dapper;

namespace Inventory.Tests;

/// <summary>
/// Integration tests for UserAdminService — exercise real Postgres + Redis containers.
/// Linked to EPIC-002 AC22..AC30 (admin user CRUD + permissions + reset pw + force-logout-all).
/// </summary>
public class UserAdminServiceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _pg = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("inventory")
        .WithUsername("inventory")
        .WithPassword("test")
        .Build();

    private readonly RedisContainer _redis = new RedisBuilder()
        .WithImage("redis:7-alpine")
        .Build();

    private Db _db = null!;
    private IConnectionMultiplexer _redisMux = null!;
    private SessionStore _sessions = null!;
    private UserAdminService _svc = null!;

    public async Task InitializeAsync()
    {
        await _pg.StartAsync();
        await _redis.StartAsync();
        _db = new Db(_pg.GetConnectionString());
        _redisMux = await ConnectionMultiplexer.ConnectAsync(_redis.GetConnectionString());
        _sessions = new SessionStore(_redisMux);
        _svc = new UserAdminService(_db, _sessions);

        // Apply schema
        using var c = await _db.OpenAsync();
        var schemaSql = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "../../../../Db/001_schema.sql"));
        await c.ExecuteAsync(schemaSql);
    }

    public async Task DisposeAsync()
    {
        await _redisMux.DisposeAsync();
        await _pg.DisposeAsync();
        await _redis.DisposeAsync();
    }

    private async Task<long> SeedUserAsync(string username, string role = "user")
    {
        using var c = await _db.OpenAsync();
        return await c.ExecuteScalarAsync<long>(@"
            INSERT INTO users(username, username_lower, full_name, password_hash, role)
            VALUES (@u, @ul, '', @h, @r) RETURNING id",
            new { u = username, ul = username.ToLowerInvariant(), h = "x", r = role });
    }

    // ===== AC22 =====

    [Fact(DisplayName = "EPIC-003-IT-ADMIN-CREATE-USER (AC22): valid input creates row with must_change_password=true")]
    public async Task Create_user_succeeds_and_forces_change()
    {
        var result = await _svc.CreateAsync(new CreateUserRequest("qa1", "QA One", "user", "TempPass1!"));

        result.Ok.Should().BeTrue();
        result.User.Should().NotBeNull();
        result.User!.MustChangePassword.Should().BeTrue();

        using var c = await _db.OpenAsync();
        var perms = await c.QueryAsync<(string menu, string action, bool allowed)>(
            "SELECT menu, action, allowed FROM user_permissions WHERE user_id = @id",
            new { id = result.User.Id });
        perms.Should().Contain(p => p.menu == "inventory" && p.action == "view" && p.allowed);
    }

    // ===== AC23 =====

    [Fact(DisplayName = "EPIC-003-IT-USER-DUP (AC23): duplicate username returns error 'Username đã tồn tại'")]
    public async Task Duplicate_username_rejected()
    {
        await _svc.CreateAsync(new CreateUserRequest("qa2", "", "user", "TempPass1!"));
        var second = await _svc.CreateAsync(new CreateUserRequest("qa2", "", "user", "TempPass2!"));

        second.Ok.Should().BeFalse();
        second.Error.Should().Be("Username đã tồn tại");
    }

    // ===== AC25 =====

    [Fact(DisplayName = "EPIC-003-IT-SELF-DELETE (AC25): admin cannot self-delete")]
    public async Task Self_delete_rejected()
    {
        var adminId = await SeedUserAsync("admin", "admin");

        var r = await _svc.SoftDeleteAsync(adminId, adminId);

        r.Ok.Should().BeFalse();
        r.Error.Should().Contain("tự xoá");
    }

    // ===== AC26 =====

    [Fact(DisplayName = "EPIC-003-IT-LAST-ADMIN (AC26): cannot delete last remaining admin")]
    public async Task Cannot_delete_last_admin()
    {
        var admin1 = await SeedUserAsync("admin1", "admin");
        var admin2 = await SeedUserAsync("admin2", "admin");

        // Delete admin1 first — should succeed (admin2 still present)
        (await _svc.SoftDeleteAsync(actorUserId: admin2, targetUserId: admin1)).Ok.Should().BeTrue();

        // Now try to delete admin2 as a different actor — should be blocked (last admin)
        // Use a dummy actor id (not real, but != admin2 so it bypasses self-delete check)
        var nonAdmin = await SeedUserAsync("intruder", "user");
        var r = await _svc.SoftDeleteAsync(actorUserId: nonAdmin, targetUserId: admin2);

        r.Ok.Should().BeFalse();
        r.Error.Should().Be("Phải còn ít nhất 1 admin.");
    }

    // ===== AC24 + AC30 =====

    [Fact(DisplayName = "EPIC-003-IT-USER-SOFT-DELETE (AC24+AC30): soft-deletes user and revokes all sessions")]
    public async Task Soft_delete_clears_sessions()
    {
        var actor = await SeedUserAsync("admin-a", "admin");
        var target = await SeedUserAsync("victim", "user");
        // Seed two active sessions for target
        await _sessions.CreateAsync("jti-1", target, "user", TimeSpan.FromHours(1));
        await _sessions.CreateAsync("jti-2", target, "user", TimeSpan.FromHours(1));
        (await _sessions.CountActiveAsync(target)).Should().Be(2);

        var r = await _svc.SoftDeleteAsync(actor, target);

        r.Ok.Should().BeTrue();
        using var c = await _db.OpenAsync();
        var deletedAt = await c.ExecuteScalarAsync<DateTime?>(
            "SELECT deleted_at FROM users WHERE id = @id", new { id = target });
        deletedAt.Should().NotBeNull();
        (await _sessions.CountActiveAsync(target)).Should().Be(0);
    }

    // ===== AC27 =====

    [Fact(DisplayName = "EPIC-003-IT-PERMS-UPDATE (AC27): permission update audits before+after matrices")]
    public async Task Permission_update_returns_before_after()
    {
        var u = await SeedUserAsync("qa3", "user");

        var newMatrix = UserAdminService.BlankMatrix();
        newMatrix["inventory"]["view"] = true;
        newMatrix["inventory"]["update"] = true;
        newMatrix["transactions"]["view"] = true;

        var r = await _svc.UpdatePermissionsAsync(actorUserId: 999, targetUserId: u, new PermissionsMatrix(newMatrix));

        r.Ok.Should().BeTrue();
        r.Before.Should().NotBeNull();
        r.After.Should().NotBeNull();
        r.After!["inventory"]["update"].Should().BeTrue();
        r.Before!["inventory"]["update"].Should().BeFalse();
    }

    // ===== AC28 =====

    [Fact(DisplayName = "EPIC-003-IT-RESET-PW (AC28): admin reset returns 16-char temp pw, forces change, kills sessions")]
    public async Task Reset_password_works()
    {
        var u = await SeedUserAsync("qa4", "user");
        await _sessions.CreateAsync("jti-x", u, "user", TimeSpan.FromHours(1));

        var r = await _svc.ResetPasswordAsync(u);

        r.Ok.Should().BeTrue();
        r.TempPassword.Should().NotBeNullOrEmpty();
        r.TempPassword!.Length.Should().Be(16);

        using var c = await _db.OpenAsync();
        var mustChange = await c.ExecuteScalarAsync<bool>(
            "SELECT must_change_password FROM users WHERE id = @id", new { id = u });
        mustChange.Should().BeTrue();
        (await _sessions.CountActiveAsync(u)).Should().Be(0);
    }
}
