using ClosedXML.Excel;

namespace Inventory;

public class ExcelStore
{
    private readonly string _path;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private const string ProductsSheet = "products";
    private const string TransactionsSheet = "transactions";

    public ExcelStore(string path)
    {
        _path = path;
        EnsureFile();
    }

    private void EnsureFile()
    {
        var dir = Path.GetDirectoryName(_path);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        if (File.Exists(_path)) return;
        using var wb = new XLWorkbook();
        WriteProductsHeader(wb.AddWorksheet(ProductsSheet));
        WriteTransactionsHeader(wb.AddWorksheet(TransactionsSheet));
        wb.SaveAs(_path);
    }

    private static void WriteProductsHeader(IXLWorksheet ws)
    {
        var headers = new[] { "STT", "LoaiHang", "MaSKU", "TenSanPham", "DonViTinh", "TonKho", "GiaVon", "GiaTriKho" };
        for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
    }

    private static void WriteTransactionsHeader(IXLWorksheet ws)
    {
        var headers = new[] { "Id", "ProductId", "MaSKU", "TenSanPham", "Type", "Quantity", "Date", "Note", "User" };
        for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
    }

    public async Task<InventoryData> ReadAsync()
    {
        await _lock.WaitAsync();
        try
        {
            EnsureFile();
            using var wb = new XLWorkbook(_path);
            return new InventoryData(ReadProducts(wb), ReadTransactions(wb));
        }
        finally { _lock.Release(); }
    }

    private static List<Product> ReadProducts(XLWorkbook wb)
    {
        if (!wb.TryGetWorksheet(ProductsSheet, out var ws)) return new();
        var result = new List<Product>();
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            var sku = ws.Cell(r, 3).GetString().Trim();
            if (string.IsNullOrEmpty(sku)) continue;
            result.Add(new Product(
                Stt: (int)ws.Cell(r, 1).GetDouble(),
                LoaiHang: ws.Cell(r, 2).GetString(),
                MaSKU: sku,
                TenSanPham: ws.Cell(r, 4).GetString(),
                DonViTinh: ws.Cell(r, 5).GetString(),
                TonKho: ws.Cell(r, 6).GetDouble(),
                GiaVon: ws.Cell(r, 7).GetDouble(),
                GiaTriKho: ws.Cell(r, 8).GetDouble()
            ));
        }
        return result;
    }

    private static List<Transaction> ReadTransactions(XLWorkbook wb)
    {
        if (!wb.TryGetWorksheet(TransactionsSheet, out var ws)) return new();
        var result = new List<Transaction>();
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            var id = ws.Cell(r, 1).GetString().Trim();
            if (string.IsNullOrEmpty(id)) continue;
            DateTime date;
            try { date = ws.Cell(r, 7).GetDateTime(); }
            catch { date = DateTime.TryParse(ws.Cell(r, 7).GetString(), out var d) ? d : DateTime.UtcNow; }
            result.Add(new Transaction(
                Id: id,
                ProductId: ws.Cell(r, 2).GetString(),
                MaSKU: ws.Cell(r, 3).GetString(),
                TenSanPham: ws.Cell(r, 4).GetString(),
                Type: ws.Cell(r, 5).GetString(),
                Quantity: ws.Cell(r, 6).GetDouble(),
                Date: date,
                Note: ws.Cell(r, 8).GetString(),
                User: ws.Cell(r, 9).GetString()
            ));
        }
        return result;
    }

    public async Task WriteAsync(InventoryData data)
    {
        await _lock.WaitAsync();
        try
        {
            var tmp = _path + "." + Guid.NewGuid().ToString("N") + ".tmp.xlsx";
            using (var wb = new XLWorkbook())
            {
                var ps = wb.AddWorksheet(ProductsSheet);
                WriteProductsHeader(ps);
                for (int i = 0; i < data.Products.Count; i++)
                {
                    var p = data.Products[i];
                    int r = i + 2;
                    ps.Cell(r, 1).Value = p.Stt;
                    ps.Cell(r, 2).Value = p.LoaiHang;
                    ps.Cell(r, 3).Value = p.MaSKU;
                    ps.Cell(r, 4).Value = p.TenSanPham;
                    ps.Cell(r, 5).Value = p.DonViTinh;
                    ps.Cell(r, 6).Value = p.TonKho;
                    ps.Cell(r, 7).Value = p.GiaVon;
                    ps.Cell(r, 8).Value = p.GiaTriKho;
                }
                var ts = wb.AddWorksheet(TransactionsSheet);
                WriteTransactionsHeader(ts);
                for (int i = 0; i < data.Transactions.Count; i++)
                {
                    var t = data.Transactions[i];
                    int r = i + 2;
                    ts.Cell(r, 1).Value = t.Id;
                    ts.Cell(r, 2).Value = t.ProductId;
                    ts.Cell(r, 3).Value = t.MaSKU;
                    ts.Cell(r, 4).Value = t.TenSanPham;
                    ts.Cell(r, 5).Value = t.Type;
                    ts.Cell(r, 6).Value = t.Quantity;
                    ts.Cell(r, 7).Value = t.Date;
                    ts.Cell(r, 8).Value = t.Note ?? string.Empty;
                    ts.Cell(r, 9).Value = t.User;
                }
                wb.SaveAs(tmp);
            }
            File.Move(tmp, _path, overwrite: true);
        }
        finally { _lock.Release(); }
    }

    public static Task<List<Product>> ParseProductsFromFileAsync(string path)
    {
        return Task.Run(() =>
        {
            using var wb = new XLWorkbook(path);
            IXLWorksheet? ws = wb.TryGetWorksheet(ProductsSheet, out var named) ? named : wb.Worksheets.FirstOrDefault();
            if (ws is null) throw new InvalidOperationException("File Excel không có sheet nào.");
            return ReadProductsFromArbitrarySheet(ws);
        });
    }

    public async Task ImportProductsAsync(Stream xlsx)
    {
        // Parse uploaded xlsx -> replace products, keep transactions intact.
        List<Product> newProducts;
        using (var wb = new XLWorkbook(xlsx))
        {
            // Accept either the first sheet or a sheet named "products".
            IXLWorksheet? ws = wb.TryGetWorksheet(ProductsSheet, out var named) ? named : wb.Worksheets.FirstOrDefault();
            if (ws is null) throw new InvalidOperationException("File Excel không có sheet nào.");
            newProducts = ReadProductsFromArbitrarySheet(ws);
        }
        var current = await ReadAsync();
        await WriteAsync(current with { Products = newProducts });
    }

    private static List<Product> ReadProductsFromArbitrarySheet(IXLWorksheet ws)
    {
        // Detect header row (first row) -- map by name when possible, fallback to fixed order.
        var headerRow = ws.FirstRowUsed();
        if (headerRow is null) return new();
        var headers = headerRow.CellsUsed().Select(c => c.GetString().Trim()).ToList();
        int Idx(params string[] names)
        {
            foreach (var n in names)
            {
                var i = headers.FindIndex(h => string.Equals(h, n, StringComparison.OrdinalIgnoreCase));
                if (i >= 0) return i + 1;
            }
            return -1;
        }

        int cStt = Idx("STT", "stt");
        int cLoai = Idx("LoaiHang", "Loại hàng", "loaiHang");
        int cSku = Idx("MaSKU", "Mã SKU", "SKU", "maSKU");
        int cName = Idx("TenSanPham", "Tên sản phẩm", "tenSanPham");
        int cDvt = Idx("DonViTinh", "Đơn vị tính", "donViTinh");
        int cTon = Idx("TonKho", "Tồn kho", "tonKho");
        int cGia = Idx("GiaVon", "Giá vốn", "giaVon");
        int cGtk = Idx("GiaTriKho", "Giá trị kho", "giaTriKho");

        // Fallback to fixed positional layout if names not found.
        if (cSku < 0 || cName < 0)
        {
            cStt = 1; cLoai = 2; cSku = 3; cName = 4; cDvt = 5; cTon = 6; cGia = 7; cGtk = 8;
        }

        var list = new List<Product>();
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        int stt = 0;
        for (int r = headerRow.RowNumber() + 1; r <= lastRow; r++)
        {
            string sku = cSku > 0 ? ws.Cell(r, cSku).GetString().Trim() : "";
            if (string.IsNullOrEmpty(sku)) continue;
            stt++;
            double ton = cTon > 0 ? TryNum(ws.Cell(r, cTon)) : 0;
            double gia = cGia > 0 ? TryNum(ws.Cell(r, cGia)) : 0;
            double gtk = cGtk > 0 ? TryNum(ws.Cell(r, cGtk)) : ton * gia;
            list.Add(new Product(
                Stt: cStt > 0 ? (int)TryNum(ws.Cell(r, cStt)) : stt,
                LoaiHang: cLoai > 0 ? ws.Cell(r, cLoai).GetString() : "",
                MaSKU: sku,
                TenSanPham: cName > 0 ? ws.Cell(r, cName).GetString() : "",
                DonViTinh: cDvt > 0 ? ws.Cell(r, cDvt).GetString() : "",
                TonKho: ton,
                GiaVon: gia,
                GiaTriKho: gtk
            ));
        }
        return list;
    }

    private static double TryNum(IXLCell cell)
    {
        try { return cell.GetDouble(); }
        catch
        {
            return double.TryParse(cell.GetString(), out var v) ? v : 0;
        }
    }
}
