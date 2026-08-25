using Npgsql;

namespace Inventory;

public class Db
{
    private readonly string _connStr;

    public Db(string connStr)
    {
        _connStr = connStr;
    }

    public NpgsqlConnection Open()
    {
        var c = new NpgsqlConnection(_connStr);
        c.Open();
        return c;
    }

    public async Task<NpgsqlConnection> OpenAsync()
    {
        var c = new NpgsqlConnection(_connStr);
        await c.OpenAsync();
        return c;
    }

    /// <summary>
    /// EPIC-003-AC03 — Startup helper: open with retry (30 × 2s = 60s).
    /// Use only from startup paths. Per-request opens should fail-fast (Npgsql pool retries on its own).
    /// </summary>
    public async Task<NpgsqlConnection> OpenWithRetryAsync(ILogger? log = null, int attempts = 30, int delayMs = 2000)
    {
        Exception? last = null;
        for (var i = 1; i <= attempts; i++)
        {
            try
            {
                var c = new NpgsqlConnection(_connStr);
                await c.OpenAsync();
                if (i > 1) log?.LogInformation("Postgres available after {Attempt} attempts", i);
                return c;
            }
            catch (Exception ex) when (ex is NpgsqlException || ex is System.Net.Sockets.SocketException || ex is TimeoutException)
            {
                last = ex;
                log?.LogWarning("Waiting for postgres (attempt {Attempt}/{Max}): {Msg}", i, attempts, ex.Message);
                await Task.Delay(delayMs);
            }
        }
        throw new InvalidOperationException($"Postgres unreachable after {attempts} attempts", last);
    }
}
