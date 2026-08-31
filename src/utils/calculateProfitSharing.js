import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';

/**
 * Normalisasi akses nilai profit sharing terhadap perbedaan penamaan kunci lama (alias)
 */
function getPsValue(ps, key) {
  if (!ps) return 0;
  if (ps[key] !== undefined) return Number(ps[key]) || 0;
  if (key === 'operasional' && ps.operational !== undefined) return Number(ps.operational) || 0;
  if (key === 'operational' && ps.operasional !== undefined) return Number(ps.operasional) || 0;
  if (key === 'nesa' && ps.nessa !== undefined) return Number(ps.nessa) || 0;
  if (key === 'nessa' && ps.nesa !== undefined) return Number(ps.nesa) || 0;
  return 0;
}

/**
 * Menghitung pembagian keuntungan dari satu transaksi
 * @param {number} sellingPrice - Harga jual
 * @param {number} costPrice - Harga modal
 * @param {object} [customConfig] - Konfigurasi persentase dinamis (opsional)
 * @returns {object} { profit, sharing: { pemilikBarang, operational, akbar, nesa, andin, ritza } }
 */
export function calculateProfitSharing(sellingPrice, costPrice, customConfig = PROFIT_SHARING_CONFIG) {
  const profit = sellingPrice - costPrice;
  const configToUse = customConfig || PROFIT_SHARING_CONFIG;

  // Jika rugi atau impas, semua pembagian = 0
  if (profit <= 0) {
    const sharing = {};
    Object.keys(configToUse).forEach((key) => {
      sharing[key] = 0;
    });
    return { profit, sharing };
  }

  const sharing = {};
  Object.entries(configToUse).forEach(([key, config]) => {
    const pct = typeof config === 'object' ? Number(config.percentage) || 0 : Number(config) || 0;
    sharing[key] = Math.round((profit * pct) / 100);
  });

  return { profit, sharing };
}

/**
 * Menghitung total pembagian dari array transaksi
 * @param {Array} transactions - Array of transaction objects
 * @param {object} [customConfig] - Konfigurasi persentase dinamis (opsional)
 * @returns {object} Total sharing per pihak
 */
export function calculateTotalSharing(transactions, customConfig = PROFIT_SHARING_CONFIG) {
  const configToUse = customConfig || PROFIT_SHARING_CONFIG;
  const totals = {};
  Object.keys(configToUse).forEach((key) => {
    totals[key] = 0;
  });

  transactions.forEach((tx) => {
    if (tx.status === 'Terjual') {
      if (tx.profitSharing) {
        Object.keys(configToUse).forEach((key) => {
          totals[key] += getPsValue(tx.profitSharing, key);
        });
      } else if (tx.profit > 0) {
        // Fallback hitung on the fly jika profitSharing belum tersimpan
        Object.entries(configToUse).forEach(([key, config]) => {
          const pct = typeof config === 'object' ? Number(config.percentage) || 0 : Number(config) || 0;
          totals[key] += Math.round((tx.profit * pct) / 100);
        });
      }
    }
  });

  return totals;
}
