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
  nesa: {
    label: 'Nesa',
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
export const PAYMENT_METHODS = ['Transfer Bank', 'QRIS'];

// Warna metode pembayaran
export const PAYMENT_METHOD_COLORS = {
  'Transfer Bank': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🏦' },
  'QRIS': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: '📱' },
};

// Role Pengguna
export const USER_ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
};

// Default profile dan role untuk akun tim internal Fitbay.id
export const DEFAULT_USER_PROFILES = {
  muhbar: {
    name: 'Akbar',
    username: 'muhbar',
    role: 'admin',
    title: 'Founder & Admin',
  },
  akbar: {
    name: 'Akbar',
    username: 'akbar',
    role: 'admin',
    title: 'Founder & Admin',
  },
  nessa: {
    name: 'Nessa',
    username: 'nessa',
    role: 'admin',
    title: 'Co-Founder & Admin',
  },
  nesa: {
    name: 'Nesa',
    username: 'nesa',
    role: 'admin',
    title: 'Co-Founder & Admin',
  },
  admin: {
    name: 'Administrator',
    username: 'admin',
    role: 'admin',
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
