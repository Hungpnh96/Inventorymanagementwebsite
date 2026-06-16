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
    Product? NewProduct
);

public record LoginRequest(string Username, string Password);

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
    long ActiveSessions
);

public record PermissionsMatrix(
    Dictionary<string, Dictionary<string, bool>> Permissions
);

public record ResetPasswordResponse(string TempPassword);

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
