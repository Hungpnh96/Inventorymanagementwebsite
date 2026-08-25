namespace Inventory;

/// <summary>
/// Excel snapshot backups of the inventory dataset (products + transactions).
/// Files live in a flat directory mounted from the host (`/data/backups` by default)
/// and are rotated so only the <see cref="MaxBackups"/> most recent snapshots are kept.
/// Reuses <see cref="ExcelStore"/> for the actual workbook read/write.
/// </summary>
public class BackupService
{
    public const int MaxBackups = 3;
    private const string BackupExtension = ".xlsx";

    private readonly string _dir;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public BackupService(string backupDir)
    {
        _dir = backupDir;
        Directory.CreateDirectory(_dir);
    }

    /// <summary>
    /// Write a snapshot of <paramref name="data"/> then rotate old files.
    /// Returns the file name only (never the full path — the path is server-internal).
    /// </summary>
    public async Task<string> CreateBackupAsync(InventoryData data)
    {
        await _lock.WaitAsync();
        try
        {
            Directory.CreateDirectory(_dir);
            var fileName = $"backup-{DateTime.Now:yyyyMMdd-HHmmss}{BackupExtension}";
            var fullPath = Path.Combine(_dir, fileName);
            // Same timestamp within one second → keep it unique instead of overwriting.
            int suffix = 1;
            while (File.Exists(fullPath))
            {
                fileName = $"backup-{DateTime.Now:yyyyMMdd-HHmmss}-{suffix++}{BackupExtension}";
                fullPath = Path.Combine(_dir, fileName);
            }

            await new ExcelStore(fullPath).WriteAsync(data);
            RotateOldBackups();
            return fileName;
        }
        finally { _lock.Release(); }
    }

    /// <summary>Newest first. Capped defensively — rotation should already enforce the limit.</summary>
    public Task<List<BackupInfo>> ListBackupsAsync()
    {
        Directory.CreateDirectory(_dir);
        var list = EnumerateBackupFiles()
            .Take(MaxBackups)
            .Select(f => new BackupInfo(f.Name, f.LastWriteTime, f.Length))
            .ToList();
        return Task.FromResult(list);
    }

    /// <summary>Read a backup workbook back into memory for restore.</summary>
    public async Task<InventoryData> ReadBackupAsync(string fileName)
    {
        var fullPath = GetBackupFilePath(fileName);
        // ExcelStore's ctor creates an empty workbook when the file is missing, so the
        // existence check has to happen before we hand the path over.
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Bản sao lưu không tồn tại", fileName);
        return await new ExcelStore(fullPath).ReadAsync();
    }

    /// <summary>
    /// Resolve a file name to a full path inside the backup directory.
    /// Throws <see cref="ArgumentException"/> on path traversal or a non-xlsx name.
    /// </summary>
    public string GetBackupFilePath(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)
            || Path.GetFileName(fileName) != fileName
            || !fileName.EndsWith(BackupExtension, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Tên file sao lưu không hợp lệ", nameof(fileName));
        return Path.Combine(_dir, fileName);
    }

    private void RotateOldBackups()
    {
        foreach (var stale in EnumerateBackupFiles().Skip(MaxBackups))
        {
            try { stale.Delete(); }
            catch (IOException) { /* file held open by a concurrent download — retry on next rotation */ }
        }
    }

    private IEnumerable<FileInfo> EnumerateBackupFiles() =>
        new DirectoryInfo(_dir)
            .EnumerateFiles("*" + BackupExtension)
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .ThenByDescending(f => f.Name);
}
