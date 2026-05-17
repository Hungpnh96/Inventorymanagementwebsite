import * as XLSX from 'xlsx';
import { Product } from '../types';

export const parseExcelFile = (file: File): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Skip header row
        const products: Product[] = jsonData.slice(1)
          .filter(row => row.length > 0 && row[0])
          .map((row, index) => ({
            stt: Number(row[0]) || index + 1,
            loaiHang: String(row[1] || ''),
            maSKU: String(row[2] || ''),
            tenSanPham: String(row[3] || ''),
            donViTinh: String(row[4] || ''),
            tonKho: Number(row[5]) || 0,
            giaVon: Number(row[6]) || 0,
            giaTriKho: Number(row[7]) || 0,
          }));

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsBinaryString(file);
  });
};

export const exportToExcel = (products: Product[], fileName: string = 'inventory.xlsx') => {
  const worksheet = XLSX.utils.json_to_sheet(
    products.map(p => ({
      'STT': p.stt,
      'Loại hàng': p.loaiHang,
      'Mã SKU': p.maSKU,
      'Tên sản phẩm': p.tenSanPham,
      'Đơn vị tính': p.donViTinh,
      'Tồn kho': p.tonKho,
      'Giá vốn': p.giaVon,
      'Giá trị kho': p.giaTriKho,
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tồn kho');
  XLSX.writeFile(workbook, fileName);
};
