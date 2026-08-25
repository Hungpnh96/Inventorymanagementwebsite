using Dapper;

namespace Inventory;

/// <summary>
/// EPIC-006 — Generic key/value application settings backed by the `app_settings` table.
/// Currently hosts the Telegram Bot notification config (single global config, no per-user rows).
/// </summary>
public sealed class SettingsService
{
    // Key names are centralised here — no magic strings at call sites (same rule as RedisKeys).
    public const string KeyTelegramBotToken = "telegram.bot_token";
    public const string KeyTelegramChatId = "telegram.chat_id";
    public const string KeyTelegramNotifyUserCreate = "telegram.notify_user_create";
    public const string KeyTelegramNotifyPasswordReset = "telegram.notify_password_reset";
    public const string KeyTelegramNotifyPermissionRequest = "telegram.notify_permission_request";

    private readonly Db _db;

    public SettingsService(Db db) => _db = db;

    /// <summary>
    /// Idempotent DDL guard. Db/004_app_settings.sql only runs on FIRST boot of the postgres
    /// container (docker-entrypoint-initdb.d), so already-provisioned databases would otherwise
    /// never get the table. Same statements, safe to re-run.
    /// </summary>
    public async Task EnsureSchemaAsync()
    {
        using var c = await _db.OpenAsync();
        await c.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS app_settings (
                key         TEXT        PRIMARY KEY,
                value       TEXT        NOT NULL DEFAULT '',
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_by  BIGINT      REFERENCES users(id)
            )");
    }

    public async Task<Dictionary<string, string>> GetAllAsync()
    {
        using var c = await _db.OpenAsync();
        var rows = await c.QueryAsync<SettingRow>("SELECT key AS Key, value AS Value FROM app_settings");
        return rows.ToDictionary(r => r.Key, r => r.Value ?? "", StringComparer.Ordinal);
    }

    private sealed class SettingRow
    {
        public string Key { get; set; } = "";
        public string? Value { get; set; }
    }

    public async Task SetManyAsync(Dictionary<string, string> values, long? updatedByUserId)
    {
        if (values.Count == 0) return;

        using var c = await _db.OpenAsync();
        using var tx = await c.BeginTransactionAsync();
        foreach (var (key, value) in values)
        {
            await c.ExecuteAsync(@"
                INSERT INTO app_settings (key, value, updated_at, updated_by)
                VALUES (@key, @value, NOW(), @updatedBy)
                ON CONFLICT (key) DO UPDATE
                    SET value = EXCLUDED.value,
                        updated_at = NOW(),
                        updated_by = EXCLUDED.updated_by",
                new { key, value = value ?? "", updatedBy = updatedByUserId },
                tx);
        }
        await tx.CommitAsync();
    }

    public async Task<TelegramSettings> GetTelegramSettingsAsync()
    {
        var all = await GetAllAsync();

        string Str(string key) => all.TryGetValue(key, out var v) ? v : "";
        // Toggles default to ON so a freshly-configured bot notifies without extra clicks.
        bool Bool(string key) => !all.TryGetValue(key, out var v)
            || !string.Equals(v, "false", StringComparison.OrdinalIgnoreCase);

        return new TelegramSettings(
            BotToken: Str(KeyTelegramBotToken),
            ChatId: Str(KeyTelegramChatId),
            NotifyUserCreate: Bool(KeyTelegramNotifyUserCreate),
            NotifyPasswordReset: Bool(KeyTelegramNotifyPasswordReset),
            NotifyPermissionRequest: Bool(KeyTelegramNotifyPermissionRequest));
    }

    public Task UpdateTelegramSettingsAsync(TelegramSettingsUpdateRequest req, long? updatedByUserId) =>
        SetManyAsync(new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [KeyTelegramBotToken] = (req.BotToken ?? "").Trim(),
            [KeyTelegramChatId] = (req.ChatId ?? "").Trim(),
            [KeyTelegramNotifyUserCreate] = req.NotifyUserCreate ? "true" : "false",
            [KeyTelegramNotifyPasswordReset] = req.NotifyPasswordReset ? "true" : "false",
            [KeyTelegramNotifyPermissionRequest] = req.NotifyPermissionRequest ? "true" : "false",
        }, updatedByUserId);
}
