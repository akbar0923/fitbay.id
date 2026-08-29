/**
 * Format angka menjadi format Rupiah
 * @param {number} amount - Jumlah uang
 * @returns {string} Format Rupiah, contoh: "Rp 1.250.000"
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format angka ringkas (K, M, B)
 * @param {number} amount 
 * @returns {string}
 */
export function formatCompact(amount) {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(1)}K`;
  return `Rp ${amount}`;
}

/**
 * Format tanggal ke locale Indonesia
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Format: "29 Agu 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format tanggal lengkap
 * @param {string} dateStr
 * @returns {string} Format: "Jumat, 29 Agustus 2026"
 */
export function formatDateFull(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
