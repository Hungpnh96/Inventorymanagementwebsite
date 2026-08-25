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
var dataBackupDir = Environment.GetEnvironmentVariable("DATA_BACKUP_DIR") ?? "/data/backups";
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
builder.Services.AddSingleton(_ => new BackupService(dataBackupDir));
builder.Services.AddSingleton<UserAdminService>();
builder.Services.AddSingleton<AuditQueryService>();
builder.Services.AddSingleton<PermissionService>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<TelegramNotifier>();
builder.Services.AddHttpClient();

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

    var settings = scope.ServiceProvider.GetRequiredService<SettingsService>();
    try { await settings.EnsureSchemaAsync(); }
    catch (Exception ex) { app.Logger.LogWarning(ex, "app_settings schema ensure failed"); }

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

// EPIC-006 — the raw Telegram bot token must never round-trip to the browser once saved.
static string MaskBotToken(string token)
{
    if (string.IsNullOrEmpty(token)) return "";
    return token.Length > 4 ? new string('\u2022', token.Length - 4) + token[^4..] : "\u2022\u2022\u2022\u2022";
}

static TelegramSettings MaskTelegram(TelegramSettings s) => s with { BotToken = MaskBotToken(s.BotToken) };

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

// Password reset REQUEST (public; no auth needed) — user without login asks admin to reset.
// We just append to audit_logs so admin can see in audit screen and act manually.
app.MapPost("/api/auth/password-reset-request", async (
    PasswordResetRequest body,
    HttpContext ctx,
    IAuditLogger audit,
    TelegramNotifier telegram) =>
{
    var username = (body.Username ?? "").Trim();
    var reason = (body.Reason ?? "").Trim();
    if (string.IsNullOrEmpty(username))
        return Results.BadRequest(new { error = "Thiếu tên đăng nhập" });
    if (username.Length > 64 || reason.Length > 500)
        return Results.BadRequest(new { error = "Username/lý do quá dài" });

    await audit.LogAsync(
        AuditActions.PasswordResetRequest,
        "user", null,
        null, username, "anonymous",
        null,
        new { username, reason = string.IsNullOrEmpty(reason) ? null : reason, requestedAt = DateTime.UtcNow },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));

    // EPIC-006 — notify admins. NotifyIfEnabledAsync never throws, so awaiting is safe.
    await telegram.NotifyIfEnabledAsync(
        TelegramEvent.PasswordReset,
        $"🔑 <b>Yêu cầu đổi mật khẩu</b>\nUsername: {username}\nLý do: {(string.IsNullOrEmpty(reason) ? "(không có)" : reason)}");

    return Results.Ok(new { ok = true, message = "Yêu cầu đã được ghi nhận. Quản trị viên sẽ liên hệ lại." });
});

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

// Price history — all transactions for a SKU with unit_price, oldest first
app.MapGet("/api/products/{sku}/price-history", async (
    string sku, ClaimsPrincipal user, PostgresStore store) =>
{
    var rows = await store.GetPriceHistoryAsync(sku);
    return Results.Ok(rows);
}).RequireAuthorization();

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
    PostgresStore store, IAuditLogger audit, SettingsService settings, TelegramNotifier telegram) =>
{
    if (body.Quantity <= 0)
        return Results.BadRequest(new { error = "Số lượng phải lớn hơn 0" });
    if (body.Type is not ("import" or "export"))
        return Results.BadRequest(new { error = "Type không hợp lệ" });

    try
    {
        var result = await store.RecordTransactionAsync(body, Username(user), IsAdmin(user));
        await audit.LogAsync(AuditActions.TransactionCreate, "transaction", result.Transaction.Id,
            UserId(user), Username(user), Role(user), null, result.Transaction,
            ClientIp(ctx), AuditContext.GetUserAgent(ctx));

        // Edge-triggered, not level-triggered: only the transaction that actually crosses the
        // threshold notifies. Further exports while already low stay silent (no spam).
        var general = await settings.GetGeneralSettingsAsync();
        if (result.StockBefore >= general.LowStockThreshold && result.StockAfter < general.LowStockThreshold)
        {
            await telegram.NotifyIfEnabledAsync(TelegramEvent.LowStock,
                $"📉 <b>Tồn kho thấp</b>\nSKU: {result.Transaction.MaSKU}\nSản phẩm: {result.Transaction.TenSanPham}\nTồn kho hiện tại: {result.StockAfter}\nNgưỡng cảnh báo: {general.LowStockThreshold}");
        }

        return Results.Ok(new { transaction = result.Transaction, data = await store.ReadAsync() });
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
    UserAdminService svc, IAuditLogger audit, TelegramNotifier telegram) =>
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

    // EPIC-006 — notify admins. NotifyIfEnabledAsync never throws, so awaiting is safe.
    await telegram.NotifyIfEnabledAsync(
        TelegramEvent.UserCreate,
        $"👤 <b>Nhân sự mới</b>\nUsername: {result.User.Username}\nHọ tên: {result.User.FullName}\nVai trò: {result.User.Role}");

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

// ---------- Admin: Data (clear/backup/restore) ----------
app.MapPost("/api/admin/data/clear", async (
    ClearDataRequest body, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, BackupService backups, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    // Server-side confirmation — never trust the FE dialog alone.
    if (body?.ConfirmText != "XOA")
        return Results.BadRequest(new { error = "Từ khoá xác nhận không đúng" });

    var before = await store.ReadAsync();
    var backupFile = await backups.CreateBackupAsync(before);
    await store.ClearInventoryDataAsync();
    await audit.LogAsync(AuditActions.DataClear, "inventory", null,
        UserId(user), Username(user), Role(user), null,
        new
        {
            backupFile,
            productsCleared = before.Products.Count,
            transactionsCleared = before.Transactions.Count,
        },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(new { backupFile, data = await store.ReadAsync() });
}).RequireAuthorization();

app.MapGet("/api/admin/data/backups", async (ClaimsPrincipal user, BackupService backups) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    return Results.Ok(await backups.ListBackupsAsync());
}).RequireAuthorization();

app.MapGet("/api/admin/data/backups/{fileName}/download", (
    string fileName, ClaimsPrincipal user, BackupService backups) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    string path;
    try { path = backups.GetBackupFilePath(fileName); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
    if (!File.Exists(path)) return Results.NotFound(new { error = "Bản sao lưu không tồn tại" });
    return Results.File(path, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
}).RequireAuthorization();

app.MapPost("/api/admin/data/backups/{fileName}/restore", async (
    string fileName, HttpContext ctx, ClaimsPrincipal user,
    PostgresStore store, BackupService backups, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);

    InventoryData restoreData;
    string safetyBackup;
    try
    {
        // Load the snapshot into memory BEFORE taking the safety backup: rotation keeps only
        // the 3 newest files, so writing the safety backup first could delete the very file
        // being restored. Also avoids burning a rotation slot on a bad file name.
        restoreData = await backups.ReadBackupAsync(fileName);
        // Snapshot the current state so a wrong restore is itself undoable.
        var current = await store.ReadAsync();
        safetyBackup = await backups.CreateBackupAsync(current);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (FileNotFoundException)
    {
        return Results.NotFound(new { error = "Bản sao lưu không tồn tại" });
    }

    await store.RestoreInventoryAsync(restoreData);
    await audit.LogAsync(AuditActions.DataRestore, "inventory", fileName,
        UserId(user), Username(user), Role(user), null,
        new
        {
            restoredFrom = fileName,
            safetyBackup,
            productsRestored = restoreData.Products.Count,
            transactionsRestored = restoreData.Transactions.Count,
        },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));
    return Results.Ok(new { restoredFrom = fileName, safetyBackup, data = await store.ReadAsync() });
}).RequireAuthorization();

// ---------- Admin: Settings (Telegram notifications) ----------
app.MapGet("/api/admin/settings/telegram", async (ClaimsPrincipal user, SettingsService settings) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    return Results.Ok(MaskTelegram(await settings.GetTelegramSettingsAsync()));
}).RequireAuthorization();

app.MapPut("/api/admin/settings/telegram", async (
    TelegramSettingsUpdateRequest body, HttpContext ctx, ClaimsPrincipal user,
    SettingsService settings, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    if (body is null) return Results.BadRequest(new { error = "Thiếu dữ liệu" });

    var current = await settings.GetTelegramSettingsAsync();

    // The FE only ever sees a masked token. If it echoes the mask back, the admin did not
    // change it — keep the stored secret instead of overwriting it with bullet characters.
    var incomingToken = (body.BotToken ?? "").Trim();
    var tokenIsMask = incomingToken.StartsWith('\u2022');
    var botToken = tokenIsMask ? current.BotToken : incomingToken;
    var chatId = (body.ChatId ?? "").Trim();

    var toSave = body with { BotToken = botToken, ChatId = chatId };
    await settings.UpdateTelegramSettingsAsync(toSave, UserId(user));

    // Never log the raw token/chat id into audit history — booleans only.
    await audit.LogAsync(AuditActions.SettingsUpdate, "telegram_settings", null,
        UserId(user), Username(user), Role(user), null,
        new
        {
            tokenChanged = !tokenIsMask && botToken != current.BotToken,
            chatIdChanged = chatId != current.ChatId,
            notifyUserCreate = body.NotifyUserCreate,
            notifyPasswordReset = body.NotifyPasswordReset,
            notifyPermissionRequest = body.NotifyPermissionRequest,
            notifyLowStock = body.NotifyLowStock,
        },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));

    return Results.Ok(MaskTelegram(await settings.GetTelegramSettingsAsync()));
}).RequireAuthorization();

app.MapPost("/api/admin/settings/telegram/test", async (ClaimsPrincipal user, TelegramNotifier telegram) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    // 200 even when ok=false: this is a diagnostic result, not a server error.
    return Results.Ok(await telegram.SendTestMessageAsync());
}).RequireAuthorization();

// ---------- Settings: General (language preference + low-stock threshold) ----------
// GET is open to any authenticated user on purpose: every client needs the threshold to render
// low-stock badges. The payload holds no secrets. Writing stays admin-only.
app.MapGet("/api/settings/general", async (SettingsService settings) =>
    Results.Ok(await settings.GetGeneralSettingsAsync()))
    .RequireAuthorization();

app.MapPut("/api/admin/settings/general", async (
    GeneralSettingsUpdateRequest body, HttpContext ctx, ClaimsPrincipal user,
    SettingsService settings, IAuditLogger audit) =>
{
    if (!IsAdmin(user)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    if (body is null) return Results.BadRequest(new { error = "Thiếu dữ liệu" });

    var language = (body.Language ?? "").Trim();
    if (language is not ("vi" or "en"))
        return Results.BadRequest(new { error = "Ngôn ngữ không hợp lệ" });
    if (body.LowStockThreshold < 0)
        return Results.BadRequest(new { error = "Ngưỡng cảnh báo phải >= 0" });

    await settings.UpdateGeneralSettingsAsync(body with { Language = language }, UserId(user));

    await audit.LogAsync(AuditActions.SettingsUpdate, "general_settings", null,
        UserId(user), Username(user), Role(user), null,
        new { language, lowStockThreshold = body.LowStockThreshold },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));

    return Results.Ok(await settings.GetGeneralSettingsAsync());
}).RequireAuthorization();

// ---------- Access requests (any authenticated user, from the permission-denied wall) ----------
// Intentionally has no dedicated table: the audit log IS the record, and doubles as the
// rate-limit source (one request per user per menu per 10 minutes).
app.MapPost("/api/access-requests", async (
    AccessRequestBody body, HttpContext ctx, ClaimsPrincipal user,
    Db db, IAuditLogger audit, TelegramNotifier telegram) =>
{
    var menu = (body?.Menu ?? "").Trim();
    var reason = (body?.Reason ?? "").Trim();
    if (string.IsNullOrEmpty(menu))
        return Results.BadRequest(new { error = "Thiếu tên trang cần cấp quyền" });
    if (menu.Length > 64 || reason.Length > 500)
        return Results.BadRequest(new { error = "Tên trang/lý do quá dài" });

    var userId = UserId(user);
    using (var c = await db.OpenAsync())
    {
        var recent = await Dapper.SqlMapper.ExecuteScalarAsync<long>(c, @"
            SELECT COUNT(*) FROM audit_logs
            WHERE action = @action
              AND actor_user_id IS NOT DISTINCT FROM @userId::bigint
              AND resource_id = @menu
              AND at > NOW() - INTERVAL '10 minutes'",
            new { action = AuditActions.PermissionRequestAccess, userId, menu });
        if (recent > 0)
            return Results.Json(
                new { error = "Bạn vừa gửi yêu cầu này rồi, vui lòng chờ Admin xử lý" },
                statusCode: StatusCodes.Status429TooManyRequests);
    }

    await telegram.NotifyIfEnabledAsync(
        TelegramEvent.PermissionRequest,
        $"\U0001F512 <b>Yêu cầu cấp quyền</b>\nUser: {Username(user)}\nTrang: {menu}\nLý do: {(string.IsNullOrEmpty(reason) ? "(không có)" : reason)}");

    await audit.LogAsync(AuditActions.PermissionRequestAccess, "permission", menu,
        userId, Username(user), Role(user), null,
        new { menu, reason = string.IsNullOrEmpty(reason) ? null : reason },
        ClientIp(ctx), AuditContext.GetUserAgent(ctx));

    return Results.Ok(new { ok = true });
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
