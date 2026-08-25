using System.Net.Http.Json;

namespace Inventory;

public enum TelegramEvent
{
    UserCreate,
    PasswordReset,
    PermissionRequest,
}

/// <summary>
/// EPIC-006 — Sends notification messages to a single admin Telegram chat.
/// Content-agnostic: callers build the message text; this class only resolves config,
/// checks the matching per-event toggle, and performs the HTTP call.
/// </summary>
public sealed class TelegramNotifier
{
    private const string TestMessage = "✅ Kiểm tra kết nối Bot Telegram thành công — Hệ thống Quản lý Kho";

    private readonly IHttpClientFactory _httpFactory;
    private readonly SettingsService _settings;
    private readonly ILogger<TelegramNotifier> _log;

    public TelegramNotifier(IHttpClientFactory httpFactory, SettingsService settings, ILogger<TelegramNotifier> log)
    {
        _httpFactory = httpFactory;
        _settings = settings;
        _log = log;
    }

    /// <summary>
    /// Fire a notification if the bot is configured AND the event toggle is on.
    /// GUARANTEED NON-THROWING: a Telegram outage/misconfiguration must never break the
    /// business flow that triggered it (user creation, password reset request, ...).
    /// </summary>
    public async Task NotifyIfEnabledAsync(TelegramEvent evt, string message)
    {
        try
        {
            var cfg = await _settings.GetTelegramSettingsAsync();
            if (string.IsNullOrWhiteSpace(cfg.BotToken) || string.IsNullOrWhiteSpace(cfg.ChatId))
                return; // not configured yet — silent no-op

            var enabled = evt switch
            {
                TelegramEvent.UserCreate => cfg.NotifyUserCreate,
                TelegramEvent.PasswordReset => cfg.NotifyPasswordReset,
                TelegramEvent.PermissionRequest => cfg.NotifyPermissionRequest,
                _ => false,
            };
            if (!enabled) return;

            await SendRawAsync(cfg.BotToken, cfg.ChatId, message);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Telegram notify failed for {Event}", evt);
        }
    }

    /// <summary>
    /// Admin diagnostic: sends a fixed test message and surfaces the real failure reason
    /// (unlike NotifyIfEnabledAsync, which swallows silently).
    /// </summary>
    public async Task<TelegramTestResult> SendTestMessageAsync()
    {
        TelegramSettings cfg;
        try
        {
            cfg = await _settings.GetTelegramSettingsAsync();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Telegram test failed to load settings");
            return new TelegramTestResult(false, ex.Message);
        }

        if (string.IsNullOrWhiteSpace(cfg.BotToken) || string.IsNullOrWhiteSpace(cfg.ChatId))
            return new TelegramTestResult(false, "Chưa cấu hình Bot Token hoặc Chat ID");

        try
        {
            await SendRawAsync(cfg.BotToken, cfg.ChatId, TestMessage);
            return new TelegramTestResult(true, null);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Telegram test message failed");
            return new TelegramTestResult(false, ex.Message);
        }
    }

    private async Task SendRawAsync(string botToken, string chatId, string text)
    {
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);

        var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
        using var resp = await http.PostAsJsonAsync(url, new
        {
            chat_id = chatId,
            text,
            parse_mode = "HTML",
        });

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"Telegram API {(int)resp.StatusCode}: {body}");
        }
    }
}
