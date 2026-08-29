import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';

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
    sharing[key] = Math.round((profit * (Number(config.percentage) || 0)) / 100);
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
          totals[key] += tx.profitSharing[key] || 0;
        });
      } else if (tx.profit > 0) {
        // Fallback hitung on the fly jika profitSharing belum tersimpan
        Object.entries(configToUse).forEach(([key, config]) => {
          totals[key] += Math.round((tx.profit * (Number(config.percentage) || 0)) / 100);
        });
      }
    }
  });

  return totals;
}
