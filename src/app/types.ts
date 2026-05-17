export interface Product {
  stt: number;
  loaiHang: string;
  maSKU: string;
  tenSanPham: string;
  donViTinh: string;
  tonKho: number;
  giaVon: number;
  giaTriKho: number;
}

export interface Transaction {
  id: string;
  productId: string;
  maSKU: string;
  tenSanPham: string;
  type: 'import' | 'export';
  quantity: number;
  date: Date;
  note?: string;
  user: string;
}

export interface User {
  username: string;
  role: 'admin' | 'user';
}

export interface InventoryData {
  products: Product[];
  transactions: Transaction[];
}
