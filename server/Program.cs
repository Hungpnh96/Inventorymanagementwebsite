using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Inventory;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ---------- Env ----------
string Env(string key, string? fallback = null) =>
    Environment.GetEnvironmentVariable(key) ?? fallback ?? throw new InvalidOperationException($"Env {key} is required");

var pgConn = Env("POSTGRES_CONNECTION");
var redisConn = Env("REDIS_CONNECTION");
var jwtSecret = Env("JWT_SECRET");
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "inventory-mgmt";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "inventory-mgmt-web";
var jwtExpiryHours = int.Parse(Environment.GetEnvironmentVariable("JWT_EXPIRY_HOURS") ?? "8");
var defaultAdminUsername = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_USERNAME") ?? "admin";
var defaultAdminPassword = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_PASSWORD");
var legacyXlsxPath = Environment.GetEnvironmentVariable("LEGACY_INVENTORY_FILE") ?? "/data/inventory.xlsx";
var allowedOriginsRaw = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")
    ?? "http://localhost:5173,http://localhost:8080";
var allowedOrigins = allowedOriginsRaw
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// ---------- CORS ----------
builder.Services.AddCors(opts =>
{
    opts.AddDefaultPolicy(p => p
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

// ---------- DI ----------
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton(_ => new Db(pgConn));
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var options = ConfigurationOptions.Parse(redisConn);
    options.AbortOnConnectFail = false;
    options.ConnectRetry = 5;
    options.ConnectTimeout = 5000;
    // EPIC-004 hotfix: IServer.KeysAsync (used by SessionStore for SCAN-based logout-all and
    // activeSessions count) requires AllowAdmin on the connection. Without this, every admin
    // user list call throws → HTTP 500 with empty body.
    options.AllowAdmin = true;
    return ConnectionMultiplexer.Connect(options);
});
builder.Services.AddSingleton<SessionStore>();
builder.Services.AddSingleton<LoginThrottle>();
builder.Services.AddSingleton<IAuditLogger, AuditLogger>();
builder.Services.AddSingleton(sp => new AuthService(sp.GetRequiredService<Db>(), jwtSecret, jwtIssuer, jwtAudience, jwtExpiryHours));
builder.Services.AddSingleton(sp => new PostgresStore(sp.GetRequiredService<Db>()));
builder.Services.AddSingleton(_ => new ExcelStore(legacyXlsxPath));
builder.Services.AddSingleton<UserAdminService>();
builder.Services.AddSingleton<AuditQueryService>();
builder.Services.AddSingleton<PermissionService>();

// ---------- Auth ----------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, PermissionHandler>();
// EPIC-004 hotfix: JSON envelope for 403 / 401 (otherwise the FE sees empty bodies).
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationMiddlewareResultHandler, JsonAuthorizationMiddlewareResultHandler>();

// Structured logging (EPIC-003-AC25)
builder.Logging.ClearProviders();
if (builder.Environment.IsDevelopment())
{
    builder.Logging.AddSimpleConsole(opts => { opts.IncludeScopes = true; opts.SingleLine = true; });
}
else
{
    builder.Logging.AddJsonConsole(opts => { opts.IncludeScopes = true; });
}

var app = builder.Build();
// EPIC-004 hotfix: catch unhandled exceptions and emit JSON body (not blank 500).
JsonExceptionHandler.Use(app);
app.UseCors();
app.UseMiddleware<RequestContextMiddleware>();
app.UseAuthentication();
app.UseMiddleware<SessionValidationMiddleware>();
app.UseAuthorization();

// ---------- Bootstrap: seed admin + migrate xlsx if first boot ----------
// EPIC-003-AC03: wait for Postgres before we even try seed/migrate.
using (var startupScope = app.Services.CreateScope())
{
    var startupDb = startupScope.ServiceProvider.GetRequiredService<Db>();
    try
    {
        using var probe = await startupDb.OpenWithRetryAsync(app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Postgres unreachable at startup; exiting");
        Environment.Exit(1);
    }
}

using (var scope = app.Services.CreateScope())
{
    var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
    if (!string.IsNullOrEmpty(defaultAdminPassword))
    {
        try { await auth.SeedAdminIfMissingAsync(defaultAdminUsername, defaultAdminPassword); }
        catch (Exception ex) { app.Logger.LogWarning(ex, "Admin seed failed"); }
    }

    var store = scope.ServiceProvider.GetRequiredService<PostgresStore>();
    var alreadyMigrated = await store.GetMigrationStateAsync("xlsx_imported");
    if (string.IsNullOrEmpty(alreadyMigrated) && await store.CountProductsAsync() == 0 && File.Exists(legacyXlsxPath))
    {
        try
        {
            var legacy = scope.ServiceProvider.GetRequiredService<ExcelStore>();
            var data = await legacy.ReadAsync();
            if (data.Products.Count > 0)
            {
                await store.ReplaceProductsAsync(data.Products, cascadeTransactions: false);
                app.Logger.LogInformation("Migrated {N} products from {Path}", data.Products.Count, legacyXlsxPath);
            }
            await store.SetMigrationStateAsync("xlsx_imported", DateTime.UtcNow.ToString("O"));
        }
        catch (Exception ex) { app.Logger.LogWarning(ex, "Legacy xlsx migration skipped"); }
    }
}

// ---------- Helpers ----------
static bool IsAdmin(ClaimsPrincipal user) => user.IsInRole("admin");
static string Username(ClaimsPrincipal user) => user.Identity?.Name ?? "anonymous";
static long? UserId(ClaimsPrincipal user) =>
    long.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
static string Role(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.Role) ?? "user";
static string? ClientIp(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString();

// ---------- Health (verbose) ----------
app.MapGet("/api/health", async (Db db, IConnectionMultiplexer redis) =>
{
    var pgOk = false;
    var redisOk = false;
    try
    {
        using var c = await db.OpenAsync();
        await Dapper.SqlMapper.ExecuteScalarAsync<int>(c, "SELECT 1");
        pgOk = true;
    }
    catch { }
    try
    {
        var pong = await redis.GetDatabase().PingAsync();
        redisOk = pong.TotalMilliseconds >= 0;
    }
    catch { }

    var status = pgOk && redisOk ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable;
    return Results.Json(new
    {
        api = "ok",
        postgres = pgOk ? "ok" : "down",
        redis = redisOk ? "ok" : "down",
        time = DateTime.UtcNow,
    }, statusCode: status);
});

// ---------- Auth ----------
app.MapPost("/api/auth/login", async (
    LoginRequest body,
    HttpContext ctx,
    AuthService auth,
    SessionStore sessions,
    LoginThrottle throttle,
    IAuditLogger audit,
    PermissionService perms) =>
{
    if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
        return Results.BadRequest(new { error = "Thiếu username hoặc password" });

    var ip = ClientIp(ctx) ?? "unknown";
    var usernameLower = body.Username.Trim().ToLowerInvariant();

    // Rate-limit BEFORE password check (per IP + per username)
    RateLimitResultIngress rl;
    try
    {
        var r = await throttle.CheckRateLimitAsync(ip, usernameLower);
        rl = new RateLimitResultIngress(r.Allowed, r.RetryAfterSeconds);
    }
    catch (RedisException)
    {
        return Results.Json(new { error = "Auth service unavailable", code = "auth_unavailable" }, statusCode: 503);
    }
    if (!rl.Allowed)
    {
        ctx.Response.Headers.Append("Retry-After", rl.RetryAfterSeconds.ToString());
        return Results.Json(new { error = "Quá nhiều lần thử. Vui lòng thử lại sau.", code = "rate_limited" }, statusCode: 429);
    }

    var u = await auth.FindByUsernameAsync(body.Username);

    // Lockout pre-check
    if (u is not null)
    {
        var locked = await throttle.GetLockoutAsync(u);
        if (locked.HasValue)
        {
            await audit.LogAsync(AuditActions.LoginFailed, "auth", u.Id.ToString(),
                u.Id, u.Username, u.Role, null,
                new { reason = "locked", lockedUntil = locked.Value },
                ip, AuditContext.GetUserAgent(ctx));
            return Results.Json(new
            {
                error = "Tài khoản bị tạm khoá. Thử lại sau 15 phút.",
                code = "account_locked",
                lockedUntil = locked.Value,
            }, statusCode: 423);
        }
    }

    if (u is null || !AuthService.VerifyPassword(body.Password, u.PasswordHash))
    {
        if (u is not null)
        {
            await throttle.RegisterFailureAsync(u);
            var nowLocked = throttle.ShouldLockAfterFailure(u.FailedLoginAttempts);
            await audit.LogAsync(
                nowLocked ? AuditActions.LoginLocked : AuditActions.LoginFailed,
                "auth", u.Id.ToString(),
                u.Id, u.Username, u.Role, null,
                new { reason = "bad_password", attempt = u.FailedLoginAttempts + 1 },
                ip, AuditContext.GetUserAgent(ctx));
        }
        else
        {
            await audit.LogAsync(AuditActions.LoginFailed, "auth", null,
                null, body.Username, "unknown", null,
                new { reason = "no_such_user" },
                ip, AuditContext.GetUserAgent(ctx));
        }
        return Results.Json(new { error = "Sai username hoặc password" }, statusCode: 401);
    }

    // Success
    await throttle.ResetFailureAsync(u.Id);
    var issued = auth.IssueToken(u);
    try
    {
        await sessions.CreateAsync(issued.Jti, u.Id, u.Role, issued.Ttl);
    }
    catch (RedisException)
    {
        return Results.Json(new { error = "Auth service unavailable", code = "auth_unavailable" }, statusCode: 503);
    }
    await audit.LogAsync(AuditActions.LoginSuccess, "auth", u.Id.ToString(),
        u.Id, u.Username, u.Role, null,
        new { jti = issued.Jti },
        ip, AuditContext.GetUserAgent(ctx));

    var matrix = u.Role == "admin" ? AdminAllAllowedMatrix() : await perms.LoadAsync(u.Id);
    return Results.Ok(new LoginResponse(
        Token: issued.Token,
        Username: u.Username,
        Role: u.Role,
        FullName: u.FullName,
        MustChangePassword: u.MustChangePassword,
        ExpiresInSeconds: (int)issued.Ttl.TotalSeconds,
        Permissions: matrix
    ));
});

// Admin matrix all-true helper for FE — server enforces via role short-circuit regardless.
static Dictionary<string, Dictionary<string, bool>> AdminAllAllowedMatrix()
{
    var m = PermissionService.BlankMatrix();
    foreach (var menu in m.Keys.ToList())
        foreach (var action in m[menu].Keys.ToList())
            m[menu][action] = true;
    return m;
}

app.MapPost("/api/auth/logout", async (
    HttpContext ctx,
    ClaimsPrincipal user,
    SessionStore sessions,
    IAuditLogger audit) =>
{
    var jti = user.FindFirstValue(JwtRegisteredClaimNames.Jti);
    var uid = UserId(user);
    if (jti is not null && uid.HasValue)
    {
        try
        {
            await sessions.RevokeAsync(jti, uid.Value);
        }
        catch (RedisException)
        {
            // Even if Redis is flaky, do not 500 the client; FE should still clear local token.
            // Audit captures the attempt.
        }
        await audit.LogAsync(AuditActions.Logout, "auth", uid.Value.ToString(),
            uid, Username(user), Role(user), null,
            new { jti },
            ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    }
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/auth/me", async (ClaimsPrincipal user, AuthService auth, PermissionService perms) =>
{
    var id = UserId(user);
    if (id is null) return Results.Unauthorized();
    var u = await auth.FindByIdAsync(id.Value);
    if (u is null) return Results.Unauthorized();
    var matrix = u.Role == "admin" ? AdminAllAllowedMatrix() : await perms.LoadAsync(u.Id);
    return Results.Ok(new MeResponse(u.Id, u.Username, u.FullName, u.Role, u.MustChangePassword, matrix));
}).RequireAuthorization();

app.MapPost("/api/auth/change-password", async (
    ChangePasswordRequest body,
    HttpContext ctx,
    ClaimsPrincipal user,
    AuthService auth,
    IAuditLogger audit) =>
{
    var id = UserId(user);
    if (id is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(body.NewPassword) || body.NewPassword.Length < 8)
        return Results.BadRequest(new { error = "Password mới phải có ít nhất 8 ký tự" });
    var u = await auth.FindByIdAsync(id.Value);
    if (u is null) return Results.Unauthorized();
    if (!AuthService.VerifyPassword(body.OldPassword, u.PasswordHash))
        return Results.Json(new { error = "Mật khẩu cũ không đúng" }, statusCode: 400);
    var newHash = AuthService.HashPassword(body.NewPassword);
    await auth.UpdatePasswordAsync(id.Value, newHash, clearMustChange: true);
    await audit.LogAsync(AuditActions.PasswordChange, "user", u.Id.ToString(),
        u.Id, u.Username, u.Role, null, new { selfService = true },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// ---------- Inventory (per-permission policies; admin short-circuits in PermissionHandler) ----------
app.MapGet("/api/inventory", async (PostgresStore store) =>
    Results.Ok(await store.ReadAsync())
).RequirePermission("inventory", "view");

app.MapPost("/api/inventory/import", async (
    HttpRequest req, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, IAuditLogger audit) =>
{
    if (!req.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart/form-data" });
    var form = await req.ReadFormAsync();
    var file = form.Files.FirstOrDefault();
    if (file is null || file.Length == 0) return Results.BadRequest(new { error = "Thiếu file xlsx" });
    try
    {
        var tempInputPath = Path.Combine(Path.GetTempPath(), $"upload-{Guid.NewGuid():N}.xlsx");
        using (var fs = File.Create(tempInputPath))
        {
            await file.CopyToAsync(fs);
        }
        var parsed = await ExcelStore.ParseProductsFromFileAsync(tempInputPath);
        File.Delete(tempInputPath);
        await store.ReplaceProductsAsync(parsed, cascadeTransactions: false);
        var data = await store.ReadAsync();
        await audit.LogAsync(AuditActions.ProductImport, "products", null,
            UserId(user), Username(user), Role(user), null,
            new { rowCount = data.Products.Count },
            ClientIp(ctx), AuditContext.GetUserAgent(ctx));
        return Results.Ok(new { imported = data.Products.Count, data });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequirePermission("inventory", "update");

app.MapPost("/api/products", async (
    List<Product> products, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, IAuditLogger audit) =>
{
    var before = await store.ReadAsync();
    try
    {
        await store.ReplaceProductsAsync(products, cascadeTransactions: true);
    }
    catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
    {
        // EPIC-002-AC05: unique SKU violation → 409 Conflict (not 500)
        return Results.Json(new { error = "SKU đã tồn tại", code = "duplicate_sku" }, statusCode: StatusCodes.Status409Conflict);
    }
    var after = await store.ReadAsync();
    await audit.LogAsync(AuditActions.ProductReplace, "products", null,
        UserId(user), Username(user), Role(user),
        new { count = before.Products.Count },
        new { count = after.Products.Count },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(after);
}).RequirePermission("inventory", "update");

// EPIC-UI: edit single product, auto-create transaction when ton_kho changes so the
// adjustment appears in báo cáo/lịch sử with the actor's username.
app.MapPut("/api/products/{sku}", async (
    string sku, Product body, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, IAuditLogger audit) =>
{
    try
    {
        var (updated, adjustment, before) = await store.UpdateProductAsync(sku, body, Username(user));
        await audit.LogAsync(AuditActions.ProductReplace, "product", sku,
            UserId(user), Username(user), Role(user),
            before, updated,
            ClientIp(ctx), AuditContext.GetUserAgent(ctx));
        return Results.Ok(new { product = updated, adjustment, data = await store.ReadAsync() });
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequirePermission("inventory", "update");

app.MapDelete("/api/products/{sku}", async (
    string sku, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, IAuditLogger audit) =>
{
    await store.DeleteProductAsync(sku);
    await audit.LogAsync(AuditActions.ProductDelete, "product", sku,
        UserId(user), Username(user), Role(user),
        new { maSku = sku }, null,
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(await store.ReadAsync());
}).RequirePermission("inventory", "delete");

app.MapPost("/api/transactions", async (
    TransactionRequest body, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, IAuditLogger audit) =>
{
    if (body.Quantity <= 0)
        return Results.BadRequest(new { error = "Số lượng phải lớn hơn 0" });
    if (body.Type is not ("import" or "export"))
        return Results.BadRequest(new { error = "Type không hợp lệ" });

    try
    {
        var tx = await store.RecordTransactionAsync(body, Username(user), IsAdmin(user));
        await audit.LogAsync(AuditActions.TransactionCreate, "transaction", tx.Id,
            UserId(user), Username(user), Role(user), null, tx,
            ClientIp(ctx), AuditContext.GetUserAgent(ctx));
        return Results.Ok(new { transaction = tx, data = await store.ReadAsync() });
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequirePermission("transactions", "create");

// ---------- Admin: Users (EPIC-003 S3) ----------
app.MapGet("/api/admin/users", async (ClaimsPrincipal user, UserAdminService svc) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    return Results.Ok(await svc.ListAsync());
}).RequireAuthorization();

app.MapPost("/api/admin/users", async (
    CreateUserRequest body, HttpContext ctx, ClaimsPrincipal user,
    UserAdminService svc, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var result = await svc.CreateAsync(body);
    if (!result.Ok)
    {
        var code = result.Error?.Contains("đã tồn tại") == true ? 400 : 400;
        // Distinguish duplicate username (409) from other validation (400)
        var status = result.Error == "Username đã tồn tại" ? 409 : 400;
        return Results.Json(new { error = result.Error, code = status == 409 ? "duplicate_username" : "validation_failed" }, statusCode: status);
    }
    await audit.LogAsync(AuditActions.UserCreate, "user", result.User!.Id.ToString(),
        UserId(user), Username(user), Role(user), null,
        new { result.User.Id, result.User.Username, result.User.Role },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Created($"/api/admin/users/{result.User.Id}", result.User);
}).RequireAuthorization();

app.MapPatch("/api/admin/users/{id:long}", async (
    long id, UpdateUserRequest body, HttpContext ctx, ClaimsPrincipal user,
    UserAdminService svc, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var r = await svc.UpdateProfileAsync(id, body.FullName ?? "");
    if (!r.Ok) return Results.BadRequest(new { error = r.Error });
    await audit.LogAsync(AuditActions.UserUpdate, "user", id.ToString(),
        UserId(user), Username(user), Role(user),
        r.Before, r.After,
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(r.After);
}).RequireAuthorization();

app.MapDelete("/api/admin/users/{id:long}", async (
    long id, HttpContext ctx, ClaimsPrincipal user,
    UserAdminService svc, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var actorId = UserId(user) ?? 0L;
    var result = await svc.SoftDeleteAsync(actorId, id);
    if (!result.Ok)
        return Results.BadRequest(new { error = result.Error });
    await audit.LogAsync(AuditActions.UserDelete, "user", id.ToString(),
        UserId(user), Username(user), Role(user),
        new { id }, null,
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/admin/users/{id:long}/permissions", async (
    long id, ClaimsPrincipal user, UserAdminService svc) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    return Results.Ok(new PermissionsMatrix(await svc.GetPermissionsAsync(id)));
}).RequireAuthorization();

app.MapPut("/api/admin/users/{id:long}/permissions", async (
    long id, PermissionsMatrix body, HttpContext ctx, ClaimsPrincipal user,
    UserAdminService svc, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var actorId = UserId(user) ?? 0L;
    var r = await svc.UpdatePermissionsAsync(actorId, id, body);
    if (!r.Ok) return Results.BadRequest(new { error = r.Error });
    await audit.LogAsync(AuditActions.UserPermissionsUpdate, "user", id.ToString(),
        UserId(user), Username(user), Role(user),
        r.Before, r.After,
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(new PermissionsMatrix(r.After!));
}).RequireAuthorization();

app.MapPost("/api/admin/users/{id:long}/reset-password", async (
    long id, HttpContext ctx, ClaimsPrincipal user,
    UserAdminService svc, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var r = await svc.ResetPasswordAsync(id);
    if (!r.Ok) return Results.NotFound(new { error = r.Error });
    await audit.LogAsync(AuditActions.PasswordReset, "user", id.ToString(),
        UserId(user), Username(user), Role(user),
        null, new { resetBy = "admin" },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(new ResetPasswordResponse(r.TempPassword!));
}).RequireAuthorization();

app.MapPost("/api/admin/users/{id:long}/logout-all", async (
    long id, HttpContext ctx, ClaimsPrincipal user,
    UserAdminService svc, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var killed = await svc.LogoutAllAsync(id);
    await audit.LogAsync(AuditActions.UserLogoutAll, "user", id.ToString(),
        UserId(user), Username(user), Role(user),
        null, new { sessionsRevoked = killed },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(new { sessionsRevoked = killed });
}).RequireAuthorization();

// ---------- Admin: Audit (EPIC-003 S4) ----------
app.MapGet("/api/admin/audit", async (
    HttpRequest req, ClaimsPrincipal user, AuditQueryService auditQuery) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    DateTime? Parse(string? s) => DateTime.TryParse(s, out var d) ? d : null;
    long? ParseCursor(string? c)
    {
        if (string.IsNullOrEmpty(c) || !c.StartsWith("id:", StringComparison.Ordinal)) return null;
        return long.TryParse(c[3..], out var id) ? id : null;
    }
    int.TryParse(req.Query["limit"].ToString(), out var limit);
    var filter = new AuditQueryService.Filter(
        From: Parse(req.Query["from"]),
        To: Parse(req.Query["to"]),
        Actor: req.Query["actor"].ToString() is { Length: > 0 } a ? a : null,
        Action: req.Query["action"].ToString() is { Length: > 0 } ac ? ac : null,
        ResourceType: req.Query["resourceType"].ToString() is { Length: > 0 } rt ? rt : null,
        ResourceId: req.Query["resourceId"].ToString() is { Length: > 0 } ri ? ri : null,
        Limit: limit,
        Cursor: ParseCursor(req.Query["cursor"])
    );
    return Results.Ok(await auditQuery.QueryAsync(filter));
}).RequireAuthorization();

app.Run("http://0.0.0.0:3001");

// Local helper record
internal record RateLimitResultIngress(bool Allowed, int RetryAfterSeconds);
