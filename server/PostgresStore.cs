using Dapper;

namespace Inventory;

public class PostgresStore
{
    private readonly Db _db;

    public PostgresStore(Db db)
    {
        _db = db;
    }

    public async Task<InventoryData> ReadAsync()
    {
        using var c = await _db.OpenAsync();
        var products = (await c.QueryAsync<Product>(@"
            SELECT stt AS Stt,
                   loai_hang AS LoaiHang,
                   ma_sku AS MaSKU,
                   ten_san_pham AS TenSanPham,
                   don_vi_tinh AS DonViTinh,
                   CAST(ton_kho AS double precision) AS TonKho,
                   CAST(gia_von AS double precision) AS GiaVon,
                   CAST(gia_tri_kho AS double precision) AS GiaTriKho
            FROM products
            ORDER BY stt NULLS LAST, id")).ToList();

        var txs = (await c.QueryAsync<Transaction>(@"
            SELECT id AS Id,
                   product_id AS ProductId,
                   ma_sku AS MaSKU,
                   ten_san_pham AS TenSanPham,
                   type AS Type,
                   CAST(quantity AS double precision) AS Quantity,
                   date AS Date,
                   note AS Note,
                   username AS User
            FROM transactions
            ORDER BY date DESC, id")).ToList();

        return new InventoryData(products, txs);
    }

    public async Task ReplaceProductsAsync(IEnumerable<Product> products, bool cascadeTransactions)
    {
        using var c = await _db.OpenAsync();
        using var tx = await c.BeginTransactionAsync();

        if (cascadeTransactions)
        {
            var keep = products.Select(p => p.MaSKU).ToArray();
            await c.ExecuteAsync(
                "DELETE FROM transactions WHERE ma_sku <> ALL(@keep)",
                new { keep }, tx);
        }

        await c.ExecuteAsync("DELETE FROM products", transaction: tx);

        int stt = 0;
        foreach (var p in products)
        {
            stt++;
            await c.ExecuteAsync(@"
                INSERT INTO products (stt, loai_hang, ma_sku, ten_san_pham, don_vi_tinh, ton_kho, gia_von, gia_tri_kho)
                VALUES (@stt, @loai, @sku, @name, @dvt, @ton, @gia, @gtk)",
                new
                {
                    stt,
                    loai = p.LoaiHang ?? "",
                    sku = p.MaSKU,
                    name = p.TenSanPham,
                    dvt = p.DonViTinh ?? "",
                    ton = p.TonKho,
                    gia = p.GiaVon,
                    gtk = p.GiaTriKho,
                }, tx);
        }

        await tx.CommitAsync();
    }

    /// <summary>
    /// Update a single product in-place. If `ton_kho` changes, record a transaction
    /// (type=import for positive delta, export for negative) so the adjustment shows
    /// up in the báo cáo/lịch sử screen with the actor's username.
    /// </summary>
    public async Task<(Product Updated, Transaction? Adjustment, Product? Before)> UpdateProductAsync(string sku, Product input, string actorUsername)
    {
        using var c = await _db.OpenAsync();
        using var tx = await c.BeginTransactionAsync();

        var before = await c.QuerySingleOrDefaultAsync<Product>(@"
            SELECT stt AS Stt,
                   loai_hang AS LoaiHang,
                   ma_sku AS MaSKU,
                   ten_san_pham AS TenSanPham,
                   don_vi_tinh AS DonViTinh,
                   CAST(ton_kho AS double precision) AS TonKho,
                   CAST(gia_von AS double precision) AS GiaVon,
                   CAST(gia_tri_kho AS double precision) AS GiaTriKho
              FROM products WHERE ma_sku = @sku FOR UPDATE",
            new { sku }, tx);
        if (before is null) throw new InvalidOperationException("Sản phẩm không tồn tại");

        // Recompute gia_tri_kho server-side so client cannot send inconsistent values.
        var newGiaTriKho = input.TonKho * input.GiaVon;
        await c.ExecuteAsync(@"
            UPDATE products
               SET loai_hang = @loai,
                   ten_san_pham = @name,
                   don_vi_tinh = @dvt,
                   ton_kho = @ton,
                   gia_von = @gia,
                   gia_tri_kho = @gtk,
                   updated_at = NOW()
             WHERE ma_sku = @sku",
            new
            {
                loai = input.LoaiHang ?? "",
                name = input.TenSanPham,
                dvt = input.DonViTinh ?? "",
                ton = input.TonKho,
                gia = input.GiaVon,
                gtk = newGiaTriKho,
                sku,
            }, tx);

        Transaction? adjustment = null;
        var delta = input.TonKho - before.TonKho;
        if (Math.Abs(delta) > 0.0001)
        {
            adjustment = new Transaction(
                Id: Guid.NewGuid().ToString("N"),
                ProductId: sku,
                MaSKU: sku,
                TenSanPham: input.TenSanPham,
                Type: delta > 0 ? "import" : "export",
                Quantity: Math.Abs(delta),
                Date: DateTime.UtcNow,
                Note: $"Điều chỉnh tồn kho từ Quản lý kho (cũ: {before.TonKho:0.###}, mới: {input.TonKho:0.###})",
                User: actorUsername
            );
            await c.ExecuteAsync(@"
                INSERT INTO transactions (id, product_id, ma_sku, ten_san_pham, type, quantity, date, note, username)
                VALUES (@Id, @ProductId, @MaSKU, @TenSanPham, @Type, @Quantity, @Date, @Note, @User)",
                adjustment, tx);
        }

        await tx.CommitAsync();

        var updated = input with { MaSKU = sku, GiaTriKho = newGiaTriKho };
        return (updated, adjustment, before);
    }

    public async Task DeleteProductAsync(string sku)
    {
        using var c = await _db.OpenAsync();
        using var tx = await c.BeginTransactionAsync();
        await c.ExecuteAsync("DELETE FROM transactions WHERE ma_sku = @sku", new { sku }, tx);
        await c.ExecuteAsync("DELETE FROM products WHERE ma_sku = @sku", new { sku }, tx);
        await tx.CommitAsync();
    }

    public async Task<Transaction> RecordTransactionAsync(TransactionRequest body, string username, bool isAdmin)
    {
        using var c = await _db.OpenAsync();
        using var tx = await c.BeginTransactionAsync();

        var existing = await c.QuerySingleOrDefaultAsync<(long id, double ton_kho, double gia_von, string ten_san_pham)?>(@"
            SELECT id, CAST(ton_kho AS double precision) AS ton_kho,
                   CAST(gia_von AS double precision) AS gia_von,
                   ten_san_pham
            FROM products WHERE ma_sku = @sku
            FOR UPDATE", new { sku = body.MaSKU }, tx);

        string tenSanPham;
        if (existing.HasValue)
        {
            var (id, ton, gia, name) = existing.Value;
            double newStock = body.Type == "import" ? ton + body.Quantity : ton - body.Quantity;
            if (body.Type == "export" && body.Quantity > ton)
                throw new InvalidOperationException("Số lượng xuất vượt quá tồn kho");
            await c.ExecuteAsync(@"
                UPDATE products
                   SET ton_kho = @ton,
                       gia_tri_kho = @ton * gia_von,
                       updated_at = NOW()
                 WHERE id = @id", new { ton = newStock, id }, tx);
            tenSanPham = name;
        }
        else
        {
            if (body.Type == "export")
                throw new InvalidOperationException("Sản phẩm không tồn tại trong kho");
            var np = body.NewProduct ?? new Product(0, "", body.MaSKU, body.TenSanPham, "", 0, 0, 0);
            double newStock = body.Quantity;
            await c.ExecuteAsync(@"
                INSERT INTO products (stt, loai_hang, ma_sku, ten_san_pham, don_vi_tinh, ton_kho, gia_von, gia_tri_kho)
                VALUES (
                    (SELECT COALESCE(MAX(stt),0)+1 FROM products),
                    @loai, @sku, @name, @dvt, @ton, @gia, @gtk
                )", new
            {
                loai = np.LoaiHang ?? "",
                sku = body.MaSKU,
                name = body.TenSanPham,
                dvt = np.DonViTinh ?? "",
                ton = newStock,
                gia = np.GiaVon,
                gtk = newStock * np.GiaVon,
            }, tx);
            tenSanPham = body.TenSanPham;
        }

        var txn = new Transaction(
            Id: Guid.NewGuid().ToString("N"),
            ProductId: body.MaSKU,
            MaSKU: body.MaSKU,
            TenSanPham: tenSanPham,
            Type: body.Type,
            Quantity: body.Quantity,
            Date: DateTime.UtcNow,
            Note: body.Note,
            User: username
        );
        await c.ExecuteAsync(@"
            INSERT INTO transactions (id, product_id, ma_sku, ten_san_pham, type, quantity, date, note, username)
            VALUES (@Id, @ProductId, @MaSKU, @TenSanPham, @Type, @Quantity, @Date, @Note, @User)",
            txn, tx);

        await tx.CommitAsync();
        return txn;
    }

    public async Task<int> CountProductsAsync()
    {
        using var c = await _db.OpenAsync();
        return (int)(await c.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM products"));
    }

    public async Task<string?> GetMigrationStateAsync(string key)
    {
        using var c = await _db.OpenAsync();
        return await c.ExecuteScalarAsync<string?>(
            "SELECT value FROM migration_state WHERE key = @k", new { k = key });
    }

    public async Task SetMigrationStateAsync(string key, string value)
    {
        using var c = await _db.OpenAsync();
        await c.ExecuteAsync(@"
            INSERT INTO migration_state (key, value, updated_at) VALUES (@k, @v, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
            new { k = key, v = value });
    }
}
