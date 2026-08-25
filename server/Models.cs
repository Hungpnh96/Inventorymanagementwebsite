namespace Inventory;

public record Product(
    int Stt,
    string LoaiHang,
    string MaSKU,
    string TenSanPham,
    string DonViTinh,
    double TonKho,
    double GiaVon,
    double GiaTriKho
);

public record Transaction(
    string Id,
    string ProductId,
    string MaSKU,
    string TenSanPham,
    string Type,
    double Quantity,
    double UnitPrice,
    DateTime Date,
    string? Note,
    string User
);

public record InventoryData(
    List<Product> Products,
    List<Transaction> Transactions
);

public record TransactionRequest(
    string MaSKU,
    string TenSanPham,
    string Type,
    double Quantity,
    string? Note,
    Product? NewProduct,
    /// <summary>
    /// Optional unit price for import; if null server defaults to product's current gia_von.
    /// Ignored for export (uses current WAC gia_von automatically).
    /// </summary>
    double? UnitPrice = null
);

public record PriceHistoryRow(
    string Id,
    DateTime Date,
    string Type,
    double Quantity,
    double UnitPrice,
    string? Note,
    string User
);

public record LoginRequest(string Username, string Password);

// EPIC-007 — public self-registration. No `Role` field on purpose: the server always
// hard-codes 'user' so a registration body can never escalate to admin.
public record RegisterRequest(string Username, string Password, string FullName);

public record LoginResponse(
    string Token,
    string Username,
    string Role,
    string FullName,
    bool MustChangePassword,
    int ExpiresInSeconds,
    Dictionary<string, Dictionary<string, bool>> Permissions
);

public record ChangePasswordRequest(string OldPassword, string NewPassword);

public record PasswordResetRequest(string Username, string? Reason);

public record MeResponse(
    long Id,
    string Username,
    string FullName,
    string Role,
    bool MustChangePassword,
    Dictionary<string, Dictionary<string, bool>> Permissions
);

// ---------------- EPIC-003 Slice 3 — Admin user management ----------------

public record CreateUserRequest(
    string Username,
    string FullName,
    string Role,
    string TempPassword
);

public record UpdateUserRequest(string FullName);

public record UserListItem(
    long Id,
    string Username,
    string FullName,
    string Role,
    bool MustChangePassword,
    DateTime? LockedUntil,
    DateTime CreatedAt,
    long ActiveSessions,
    string Status
);

public record PermissionsMatrix(
    Dictionary<string, Dictionary<string, bool>> Permissions
);

public record ResetPasswordResponse(string TempPassword);

// EPIC-007 — shared response shape for admin approve / reject of a pending registration.
public record ApproveRejectResult(bool Ok, string? Error, UserListItem? User);

public record AuditRow(
    long Id,
    DateTime At,
    long? ActorUserId,
    string ActorUsername,
    string ActorRole,
    string Action,
    string ResourceType,
    string? ResourceId,
    string? BeforeJson,
    string? AfterJson,
    string? IpAddress,
    string? UserAgent
);

public record AuditPageResponse(
    List<AuditRow> Rows,
    string? NextCursor,
    bool Truncated
);

// ---------------- EPIC-005 — Admin data module (clear / backup / restore) ----------------

public record BackupInfo(string FileName, DateTime CreatedAt, long SizeBytes);

public record ClearDataRequest(string ConfirmText);

// ---------------- EPIC-006 — Settings module (Telegram notifications) ----------------

public record TelegramSettings(
    string BotToken,
    string ChatId,
    bool NotifyUserCreate,
    bool NotifyPasswordReset,
    bool NotifyPermissionRequest,
    bool NotifyLowStock
);

public record TelegramSettingsUpdateRequest(
    string BotToken,
    string ChatId,
    bool NotifyUserCreate,
    bool NotifyPasswordReset,
    bool NotifyPermissionRequest,
    bool NotifyLowStock
);

public record AccessRequestBody(string Menu, string? Reason);

public record TelegramTestResult(bool Ok, string? Error);

// ---------------- EPIC-006 — Settings module (general / UI preferences) ----------------

/// <summary>
/// Admin-configurable, app-wide preferences. `Language` is stored only (the UI is 100%
/// Vietnamese today) — it is a saved preference for a future i18n pass.
/// </summary>
public record GeneralSettings(
    string Language,
    double LowStockThreshold
);

public record GeneralSettingsUpdateRequest(
    string Language,
    double LowStockThreshold
);

/// <summary>
/// Result of RecordTransactionAsync — carries the stock level on both sides of the write so
/// callers can detect a low-stock threshold crossing without a second query.
/// </summary>
public record TransactionResult(
    Transaction Transaction,
    double StockBefore,
    double StockAfter
);
