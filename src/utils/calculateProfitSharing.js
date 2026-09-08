import { PROFIT_SHARING_CONFIG, getTeamMemberKey } from '../constants/profitSharingConfig.js';

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
    if (tx.status !== 'Terjual') return;

    if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
      tx.items.forEach((it) => {
        const owner = it.ownerName || tx.ownerName || '';
        const tk = getTeamMemberKey(owner);
        const sell = Number(it.sellingPrice || 0);
        const profit = Number(it.profit !== undefined ? it.profit : sell);

        if (tk && totals[tk] !== undefined) {
          // Barang pribadi anggota tim (85% atau skema custom yang tersimpan)
          const custom = it.skemaCustom || tx.skemaCustom;
          const pct = custom?.pemilikBarang !== undefined ? Number(custom.pemilikBarang) : 85;
          const hak = it.profitSharing?.pemilikBarang !== undefined
            ? Number(it.profitSharing.pemilikBarang)
            : Math.round((profit * pct) / 100);
          totals[tk] += hak;
        } else {
          // Barang penitip eksternal (70%)
          const hak = it.profitSharing?.pemilikBarang !== undefined
            ? Number(it.profitSharing.pemilikBarang)
            : Math.round(profit * 0.70);
          totals.pemilikBarang += hak;
        }
      });
    } else {
      const owner = tx.ownerName || tx.owner || '';
      const tk = getTeamMemberKey(owner);
      const sell = Number(tx.sellingPrice || 0);
      const profit = Number(tx.profit !== undefined ? tx.profit : sell);

      if (tk && totals[tk] !== undefined) {
        const custom = tx.skemaCustom || tx.ownerCustomScheme;
        const pct = custom?.pemilikBarang !== undefined ? Number(custom.pemilikBarang) : 85;
        const hak = tx.profitSharing?.pemilikBarang !== undefined
          ? Number(tx.profitSharing.pemilikBarang)
          : Math.round((profit * pct) / 100);
        totals[tk] += hak;
      } else {
        const hak = tx.profitSharing?.pemilikBarang !== undefined
          ? Number(tx.profitSharing.pemilikBarang)
          : Math.round(profit * 0.70);
        totals.pemilikBarang += hak;
      }
    }

    // Tambahkan Operasional dan Komisi Tim 5% dari penjualan penitip eksternal
    if (tx.profitSharing) {
      totals.operational += Number(tx.profitSharing.operational || tx.profitSharing.operasional || 0);
      if (totals.akbar !== undefined) totals.akbar += Number(tx.profitSharing.akbar || 0);
      if (totals.nesa !== undefined) totals.nesa += Number(tx.profitSharing.nesa || tx.profitSharing.nessa || 0);
      if (totals.andin !== undefined) totals.andin += Number(tx.profitSharing.andin || 0);
      if (totals.ritza !== undefined) totals.ritza += Number(tx.profitSharing.ritza || 0);
    }
  });

  // Mirror aliases so either key works seamlessly
  if (totals.nesa !== undefined && totals.nessa !== undefined) {
    const maxNesa = Math.max(totals.nesa, totals.nessa);
    totals.nesa = maxNesa;
    totals.nessa = maxNesa;
  } else if (totals.nesa !== undefined) {
    totals.nessa = totals.nesa;
  } else if (totals.nessa !== undefined) {
    totals.nesa = totals.nessa;
  }

  if (totals.operational !== undefined && totals.operasional !== undefined) {
    const maxOps = Math.max(totals.operational, totals.operasional);
    totals.operational = maxOps;
    totals.operasional = maxOps;
  } else if (totals.operational !== undefined) {
    totals.operasional = totals.operational;
  } else if (totals.operasional !== undefined) {
    totals.operational = totals.operasional;
  }

  return totals;
}

/**
 * Menghitung hanya komisi tim (5% masing-masing) dan operasional dari transaksi
 * @param {Array} transactions
 * @returns {object} { akbar, nesa, andin, ritza, operational }
 */
export function calculateTeamCommissions(transactions) {
  const commissions = {
    akbar: 0,
    nesa: 0,
    andin: 0,
    ritza: 0,
    operational: 0,
  };

  transactions.forEach((tx) => {
    if (tx.status !== 'Terjual') return;
    if (tx.profitSharing) {
      commissions.operational += Number(tx.profitSharing.operational || tx.profitSharing.operasional || 0);
      commissions.akbar += Number(tx.profitSharing.akbar || 0);
      commissions.nesa += Number(tx.profitSharing.nesa || tx.profitSharing.nessa || 0);
      commissions.andin += Number(tx.profitSharing.andin || 0);
      commissions.ritza += Number(tx.profitSharing.ritza || 0);
    }
  });

  // Mirror aliases so either key works seamlessly
  commissions.muhbar = commissions.akbar;
  commissions.nessa = commissions.nesa;
  commissions.operasional = commissions.operational;

  return commissions;
}

/**
 * Menghitung keuntungan dan pembagian hasil untuk satu item spesifik
 * @param {object} item - Objek barang ({ sellingPrice, costPrice, skemaCustom, ownerName })
 * @param {object} [globalConfig] - Konfigurasi global persentase bagi hasil
 * @returns {object} { profit, sharing }
 */
export function calculateItemProfitAndSharing(item, globalConfig = PROFIT_SHARING_CONFIG) {
  const selling = Number(item.sellingPrice || 0);
  const cost = Number(item.costPrice || 0);
  const profit = selling - cost;

  const configToUse = globalConfig || PROFIT_SHARING_CONFIG;
  let schemeToUse = configToUse;
  const customScheme = item.skemaCustom || item.ownerCustomScheme;

  if (customScheme) {
    schemeToUse = {};
    Object.keys(configToUse).forEach((k) => {
      let pct = customScheme[k];
      if (pct === undefined) {
        if (k === 'nesa' && customScheme.nessa !== undefined) pct = customScheme.nessa;
        if (k === 'nessa' && customScheme.nesa !== undefined) pct = customScheme.nesa;
        if (k === 'operational' && customScheme.operasional !== undefined) pct = customScheme.operasional;
        if (k === 'operasional' && customScheme.operational !== undefined) pct = customScheme.operational;
      }
      schemeToUse[k] = {
        ...configToUse[k],
        percentage: Number(pct || 0),
      };
    });
  } else {
    // Otomatisasi Skema Berdasarkan Pemilik Barang:
    // Jika Pemilik Barang adalah Anggota Tim (Akbar, Nessa, Andin, Ritza) -> Skema 85% Pemilik, 15% Ops, 0% Komisi
    // Jika Pemilik Barang adalah Penitip Luar (Atun, Bilah, dll) -> Skema Standar 70% Pemilik, 10% Ops, 5% Tim
    const rawOwner = (item.ownerName || item.owner || '').trim().toLowerCase();
    const isTeam = Boolean(getTeamMemberKey(rawOwner));

    if (isTeam) {
      schemeToUse = {
        pemilikBarang: { percentage: 85, label: 'Pemilik Barang' },
        operational: { percentage: 15, label: 'Operational' },
        akbar: { percentage: 0, label: 'Akbar' },
        nesa: { percentage: 0, label: 'Nessa' },
        andin: { percentage: 0, label: 'Andin' },
        ritza: { percentage: 0, label: 'Ritza' },
      };
    } else {
      schemeToUse = configToUse;
    }
  }

  const { sharing } = calculateProfitSharing(selling, cost, schemeToUse);
  return { profit, sharing };
}

/**
 * Menghitung akumulasi total penjualan, modal, laba, dan bagi hasil dari array items
 * @param {Array} items - Array of item objects
 * @param {object} [globalConfig] - Konfigurasi global persentase bagi hasil
 * @returns {object} { totalSelling, totalCost, totalProfit, totalSharing, calculatedItems }
 */
export function calculateOrderTotals(items = [], globalConfig = PROFIT_SHARING_CONFIG) {
  const configToUse = globalConfig || PROFIT_SHARING_CONFIG;
  let totalSelling = 0;
  let totalCost = 0;
  let totalProfit = 0;
  const totalSharing = {};

  Object.keys(configToUse).forEach((key) => {
    totalSharing[key] = 0;
  });

  const calculatedItems = (items || []).map((item) => {
    const selling = Number(item.sellingPrice || 0);
    const cost = Number(item.costPrice || 0);
    const { profit, sharing } = calculateItemProfitAndSharing(item, configToUse);

    totalSelling += selling;
    totalCost += cost;
    totalProfit += profit;

    Object.keys(configToUse).forEach((key) => {
      totalSharing[key] += getPsValue(sharing, key);
    });

    return {
      ...item,
      sellingPrice: selling,
      costPrice: cost,
      profit,
      profitSharing: sharing,
    };
  });

  return {
    totalSelling,
    totalCost,
    totalProfit,
    totalSharing,
    calculatedItems,
  };
}

