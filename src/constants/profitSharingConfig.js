// Konfigurasi persentase pembagian hasil
// Mudah diubah di satu tempat tanpa mengubah banyak file
export const PROFIT_SHARING_CONFIG = {
  pemilikBarang: {
    label: 'Pemilik Barang',
    percentage: 70,
    color: '#10B981', // emerald-500
    icon: '👤',
  },
  operational: {
    label: 'Operational',
    percentage: 10,
    color: '#8B5CF6', // violet-500
    icon: '⚙️',
  },
  akbar: {
    label: 'Akbar',
    percentage: 5,
    color: '#3B82F6', // blue-500
    icon: '👨',
  },
  nessa: {
    label: 'Nessa',
    percentage: 5,
    color: '#EC4899', // pink-500
    icon: '👩',
  },
  andin: {
    label: 'Andin',
    percentage: 5,
    color: '#F59E0B', // amber-500
    icon: '👩',
  },
  ritza: {
    label: 'Ritza',
    percentage: 5,
    color: '#06B6D4', // cyan-500
    icon: '👩',
  },
};

export const TEAM_MEMBER_KEYS = ['akbar', 'nesa', 'andin', 'ritza'];

// Preset Skema Pembagian Hasil
export const SCHEME_PRESETS = [
  {
    id: 'standard',
    label: 'Standar Global (70% Pemilik, 10% Ops, 5% Tiap Tim)',
    description: '70% Pemilik, 10% Operasional, 5% Akbar, 5% Nessa, 5% Andin, 5% Ritza',
    isCustom: false,
    scheme: {
      pemilikBarang: 70,
      operational: 10,
      akbar: 5,
      nesa: 5,
      andin: 5,
      ritza: 5,
    },
  },
  {
    id: 'scheme_85_15',
    label: 'Skema 85% Pemilik & 15% Operasional',
    description: '85% Pemilik Barang, 15% Operasional, 0% Anggota Tim',
    isCustom: true,
    scheme: {
      pemilikBarang: 85,
      operational: 15,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
  },
  {
    id: 'scheme_90_10',
    label: 'Skema 90% Pemilik & 10% Operasional',
    description: '90% Pemilik Barang, 10% Operasional, 0% Anggota Tim',
    isCustom: true,
    scheme: {
      pemilikBarang: 90,
      operational: 10,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
  },
  {
    id: 'custom',
    label: 'Skema Kustom (Input Manual)',
    description: 'Atur persentase manual per pihak',
    isCustom: true,
  },
];

export function getTeamMemberKey(nameOrUsername) {
  if (!nameOrUsername) return null;
  const clean = String(nameOrUsername).trim().toLowerCase();
  if (clean === 'akbar' || clean === 'muhbar') return 'akbar';
  if (clean === 'nesa' || clean === 'nessa') return 'nesa';
  if (clean === 'andin') return 'andin';
  if (clean === 'ritza') return 'ritza';
  return null;
}

// Kategori barang
export const CATEGORIES = [
  'Sepatu',
  'Baju',
  'Celana',
  'Tas',
  'Jaket',
  'Aksesoris',
  'Lainnya',
];

// Status transaksi
export const TRANSACTION_STATUSES = ['Terjual', 'Pending', 'Retur'];

// Metode Pembayaran
export const PAYMENT_METHODS = ['Transfer Bank', 'QRIS', 'Tunai / Cash'];

// Sumber Pesanan / Channel Penjualan
export const ORDER_SOURCES = [
  'WhatsApp',
  'Instagram',
  'TikTok Live',
  'Bertemu Langsung (Offline)',
  'Shopee',
  'Lainnya',
];

// Opsi Ekspedisi / Kurir Pengiriman
export const SHIPPING_COURIERS = [
  'J&T Express',
  'SiCepat',
  'JNE Express',
  'Shopee Xpress (SPX)',
  'J&T Cargo',
  'Anteraja',
  'Paxel',
  'Ambil Sendiri (Self-Pickup)',
  'Kurir Instan (Gojek/Grab)',
  'Lainnya',
];

// Warna sumber pesanan
export const ORDER_SOURCE_COLORS = {
  'WhatsApp': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '💬' },
  'Instagram': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', icon: '📸' },
  'TikTok Live': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', icon: '🎵' },
  'Bertemu Langsung (Offline)': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: '🏪' },
  'Shopee': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: '🛍️' },
  'Lainnya': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: '📦' },
};

// Warna metode pembayaran
export const PAYMENT_METHOD_COLORS = {
  'Transfer Bank': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🏦' },
  'QRIS': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: '📱' },
  'Tunai / Cash': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '💵' },
};

// Role Pengguna
export const USER_ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  STAFF: 'staff',
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
};

// Default profile dan role untuk akun tim internal Fitbay.id
export const DEFAULT_USER_PROFILES = {
  muhbar: {
    name: 'Akbar',
    username: 'muhbar',
    role: 'superadmin',
    title: 'Founder & Super Admin',
  },
  akbar: {
    name: 'Akbar',
    username: 'akbar',
    role: 'superadmin',
    title: 'Founder & Super Admin',
  },
  nessa: {
    name: 'Nessa',
    username: 'nessa',
    role: 'superadmin',
    title: 'Co-Founder & Super Admin',
  },
  nesa: {
    name: 'Nesa',
    username: 'nesa',
    role: 'superadmin',
    title: 'Co-Founder & Super Admin',
  },
  admin: {
    name: 'Administrator',
    username: 'admin',
    role: 'superadmin',
    title: 'Super Admin',
  },
  andin: {
    name: 'Andin',
    username: 'andin',
    role: 'staff',
    title: 'Staff & Host Live',
  },
  ritza: {
    name: 'Ritza',
    username: 'ritza',
    role: 'staff',
    title: 'Staff & Host Live',
  },
};

// Default nama pemilik barang awal
export const DEFAULT_OWNER_NAMES = [
  'Akbar',
  'Nesa',
  'Ritza',
  'Andin',
  'Atun',
  'Bilah',
  'Fitbay Store',
];

// Warna status
export const STATUS_COLORS = {
  Terjual: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  Pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  Retur: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
};

// Pagination options
export const PAGE_SIZE_OPTIONS = [10, 25, 50];
