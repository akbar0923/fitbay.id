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
 * Menghitung rincian pembagian hasil untuk satu baris transaksi di tabel
 * Menempatkan hak barang pribadi tim ke kolom masing-masing anggota (Akbar, Nesa, Andin, Ritza),
 * barang penitip luar ke kolom pemilikBarang, dan menambahkan komisi 5% serta operasional.
 * @param {object} tx - Transaksi
 * @param {object} [customConfig] - Konfigurasi persentase dinamis
 * @returns {object} { pemilikBarang, operational, akbar, nesa, andin, ritza, ... }
 */
export function getRowProfitSharing(tx, customConfig = PROFIT_SHARING_CONFIG) {
  const row = {
    pemilikBarang: 0,
    operational: 0,
    operasional: 0,
    akbar: 0,
    muhbar: 0,
    nesa: 0,
    nessa: 0,
    andin: 0,
    ritza: 0,
  };

  if (!tx || tx.status !== 'Terjual') return row;

  if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
    tx.items.forEach((it) => {
      const owner = it.ownerName || tx.ownerName || '';
      const tk = getTeamMemberKey(owner);
      const sell = Number(it.sellingPrice || 0);
      const cost = Number(it.costPrice || 0);
      const profit = Number(it.profit !== undefined ? it.profit : sell - cost);

      const custom = it.skemaCustom || tx.skemaCustom || tx.ownerCustomScheme;

      if (tk) {
        // Barang milik tim (Akbar, Nessa, Andin, Ritza)
        const pct = custom?.pemilikBarang !== undefined ? Number(custom.pemilikBarang) : 85;
        const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 15;

        // Cek apakah sudah ada hak spesifik tersimpan di item.profitSharing
        const hak = it.profitSharing?.[tk] !== undefined && Number(it.profitSharing[tk]) > 0
          ? Number(it.profitSharing[tk])
          : (it.profitSharing?.pemilikBarang !== undefined
            ? Number(it.profitSharing.pemilikBarang)
            : Math.round((profit * pct) / 100));

        const opsHak = it.profitSharing?.operational !== undefined
          ? Number(it.profitSharing.operational)
          : (it.profitSharing?.operasional !== undefined
            ? Number(it.profitSharing.operasional)
            : Math.round((profit * opsPct) / 100));

        row[tk] = (row[tk] || 0) + hak;
        if (tk === 'nesa') row.nessa = (row.nessa || 0) + hak;
        if (tk === 'nessa') row.nesa = (row.nesa || 0) + hak;
        if (tk === 'akbar') row.muhbar = (row.muhbar || 0) + hak;

        row.operational += opsHak;
        row.operasional += opsHak;
      } else {
        // Barang milik penitip eksternal (Atun, Bilah, dll)
        const pct = custom?.pemilikBarang !== undefined ? Number(custom.pemilikBarang) : 70;
        const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 10;

        const hak = it.profitSharing?.pemilikBarang !== undefined
          ? Number(it.profitSharing.pemilikBarang)
          : Math.round((profit * pct) / 100);

        const opsHak = it.profitSharing?.operational !== undefined
          ? Number(it.profitSharing.operational)
          : (it.profitSharing?.operasional !== undefined
            ? Number(it.profitSharing.operasional)
            : Math.round((profit * opsPct) / 100));

        row.pemilikBarang += hak;
        row.operational += opsHak;
        row.operasional += opsHak;

        // Komisi 5% tiap anggota tim dari barang luar
        ['akbar', 'nesa', 'andin', 'ritza'].forEach((k) => {
          const cPct = custom?.[k] !== undefined ? Number(custom[k]) : 5;
          const cHak = it.profitSharing?.[k] !== undefined
            ? Number(it.profitSharing[k])
            : (k === 'nesa' && it.profitSharing?.nessa !== undefined
              ? Number(it.profitSharing.nessa)
              : Math.round((profit * cPct) / 100));

          row[k] = (row[k] || 0) + cHak;
          if (k === 'nesa') row.nessa = (row.nessa || 0) + cHak;
          if (k === 'akbar') row.muhbar = (row.muhbar || 0) + cHak;
        });
      }
    });
  } else {
    // Single item legacy
    const owner = tx.ownerName || tx.owner || '';
    const tk = getTeamMemberKey(owner);
    const sell = Number(tx.sellingPrice || 0);
    const cost = Number(tx.costPrice || 0);
    const profit = Number(tx.profit !== undefined ? tx.profit : sell - cost);

    const custom = tx.skemaCustom || tx.ownerCustomScheme;

    if (tk) {
      const pct = custom?.pemilikBarang !== undefined ? Number(custom.pemilikBarang) : 85;
      const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 15;

      const hak = tx.profitSharing?.[tk] !== undefined && Number(tx.profitSharing[tk]) > 0
        ? Number(tx.profitSharing[tk])
        : (tx.profitSharing?.pemilikBarang !== undefined
          ? Number(tx.profitSharing.pemilikBarang)
          : Math.round((profit * pct) / 100));

      const opsHak = tx.profitSharing?.operational !== undefined
        ? Number(tx.profitSharing.operational)
        : (tx.profitSharing?.operasional !== undefined
          ? Number(tx.profitSharing.operasional)
          : Math.round((profit * opsPct) / 100));

      row[tk] = (row[tk] || 0) + hak;
      if (tk === 'nesa') row.nessa = (row.nessa || 0) + hak;
      if (tk === 'nessa') row.nesa = (row.nesa || 0) + hak;
      if (tk === 'akbar') row.muhbar = (row.muhbar || 0) + hak;

      row.operational += opsHak;
      row.operasional += opsHak;
    } else {
      const pct = custom?.pemilikBarang !== undefined ? Number(custom.pemilikBarang) : 70;
      const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 10;

      const hak = tx.profitSharing?.pemilikBarang !== undefined
        ? Number(tx.profitSharing.pemilikBarang)
        : Math.round((profit * pct) / 100);

      const opsHak = tx.profitSharing?.operational !== undefined
        ? Number(tx.profitSharing.operational)
        : (tx.profitSharing?.operasional !== undefined
          ? Number(tx.profitSharing.operasional)
          : Math.round((profit * opsPct) / 100));

      row.pemilikBarang += hak;
      row.operational += opsHak;
      row.operasional += opsHak;

      ['akbar', 'nesa', 'andin', 'ritza'].forEach((k) => {
        const cPct = custom?.[k] !== undefined ? Number(custom[k]) : 5;
        const cHak = tx.profitSharing?.[k] !== undefined
          ? Number(tx.profitSharing[k])
          : (k === 'nesa' && tx.profitSharing?.nessa !== undefined
            ? Number(tx.profitSharing.nessa)
            : Math.round((profit * cPct) / 100));

        row[k] = (row[k] || 0) + cHak;
        if (k === 'nesa') row.nessa = (row.nessa || 0) + cHak;
        if (k === 'akbar') row.muhbar = (row.muhbar || 0) + cHak;
      });
    }
  }

  return row;
}

/**
 * Mendapatkan informasi badge skema untuk satu transaksi
 * @param {object} tx
 * @returns {object} { label, className }
 */
export function getTransactionSchemeBadge(tx) {
  if (!tx) {
    return {
      label: '🌐 Standar (70%)',
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    };
  }

  if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
    let hasTeam = false;
    let hasExternal = false;
    let hasCustomNonStandard = false;
    let customDesc = '';

    tx.items.forEach((it) => {
      const owner = it.ownerName || tx.ownerName || '';
      const isTeam = Boolean(getTeamMemberKey(owner));
      const custom = it.skemaCustom || tx.skemaCustom || tx.ownerCustomScheme;

      if (isTeam) {
        hasTeam = true;
      } else {
        hasExternal = true;
      }

      if (custom && custom.pemilikBarang !== 85 && custom.pemilikBarang !== 70) {
        hasCustomNonStandard = true;
        customDesc = `${custom.pemilikBarang}% / ${custom.operational}% Ops`;
      }
    });

    if (hasCustomNonStandard) {
      return {
        label: `⚡ ${customDesc}`,
        className: 'bg-purple-500/15 text-purple-300 border border-purple-500/20',
      };
    }

    if (hasTeam && hasExternal) {
      return {
        label: '⚡ Campuran (85% Tim / 70% Luar)',
        className: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-bold',
      };
    }

    if (hasTeam) {
      return {
        label: '⚡ 85% / 15% Ops (Tim)',
        className: 'bg-purple-500/15 text-purple-300 border border-purple-500/20 font-bold',
      };
    }

    return {
      label: '🌐 Standar (70% Penitip)',
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    };
  }

  // Single item
  const owner = tx.ownerName || tx.owner || '';
  const isTeam = Boolean(getTeamMemberKey(owner));
  const custom = tx.skemaCustom || tx.ownerCustomScheme;

  if (custom) {
    return {
      label: `⚡ ${custom.pemilikBarang}% / ${custom.operational}% Ops`,
      className: 'bg-purple-500/15 text-purple-300 border border-purple-500/20 font-bold',
    };
  }

  if (isTeam) {
    return {
      label: '⚡ 85% / 15% Ops (Tim)',
      className: 'bg-purple-500/15 text-purple-300 border border-purple-500/20 font-bold',
    };
  }

  return {
    label: '🌐 Standar (70% Penitip)',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  };
}

/**
 * Menghitung total pembagian dari array transaksi
 * @param {Array} transactions - Array of transaction objects
 * @param {object} [customConfig] - Konfigurasi persentase dinamis (opsional)
 * @returns {object} Total sharing per pihak
 */
export function calculateTotalSharing(transactions, customConfig = PROFIT_SHARING_CONFIG) {
  const configToUse = customConfig || PROFIT_SHARING_CONFIG;
  const totals = {
    pemilikBarang: 0,
    operational: 0,
    operasional: 0,
    akbar: 0,
    muhbar: 0,
    nesa: 0,
    nessa: 0,
    andin: 0,
    ritza: 0,
  };

  Object.keys(configToUse).forEach((key) => {
    if (totals[key] === undefined) totals[key] = 0;
  });

  (transactions || []).forEach((tx) => {
    if (tx.status !== 'Terjual') return;

    const row = getRowProfitSharing(tx, configToUse);

    totals.pemilikBarang += (row.pemilikBarang || 0);
    totals.operational += (row.operational || 0);
    totals.operasional += (row.operational || 0);

    totals.akbar += (row.akbar || 0);
    totals.muhbar += (row.akbar || 0);

    totals.nesa += (row.nesa || 0);
    totals.nessa += (row.nesa || 0);

    totals.andin += (row.andin || 0);
    totals.ritza += (row.ritza || 0);
  });

  return totals;
}

/**
 * Menghitung hanya komisi tim murni (5% masing-masing) dari penitip luar dan operasional toko
 * @param {Array} transactions
 * @returns {object} { akbar, nesa, andin, ritza, operational, muhbar, nessa, operasional }
 */
export function calculateTeamCommissions(transactions) {
  const commissions = {
    akbar: 0,
    nesa: 0,
    andin: 0,
    ritza: 0,
    operational: 0,
  };

  (transactions || []).forEach((tx) => {
    if (tx.status !== 'Terjual') return;

    if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
      tx.items.forEach((it) => {
        const owner = it.ownerName || tx.ownerName || '';
        const tk = getTeamMemberKey(owner);
        const sell = Number(it.sellingPrice || 0);
        const cost = Number(it.costPrice || 0);
        const profit = Number(it.profit !== undefined ? it.profit : sell - cost);
        const custom = it.skemaCustom || tx.skemaCustom || tx.ownerCustomScheme;

        if (tk) {
          // Barang pribadi tim: operasional toko 15% (atau sesuai skema), komisi tim = 0
          const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 15;
          const opsHak = it.profitSharing?.operational !== undefined
            ? Number(it.profitSharing.operational)
            : (it.profitSharing?.operasional !== undefined
              ? Number(it.profitSharing.operasional)
              : Math.round((profit * opsPct) / 100));
          commissions.operational += opsHak;
        } else {
          // Penitip luar: operasional toko 10% (atau custom), komisi tim masing-masing 5%
          const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 10;
          const opsHak = it.profitSharing?.operational !== undefined
            ? Number(it.profitSharing.operational)
            : (it.profitSharing?.operasional !== undefined
              ? Number(it.profitSharing.operasional)
              : Math.round((profit * opsPct) / 100));
          commissions.operational += opsHak;

          ['akbar', 'nesa', 'andin', 'ritza'].forEach((k) => {
            const cPct = custom?.[k] !== undefined ? Number(custom[k]) : 5;
            const cHak = it.profitSharing?.[k] !== undefined
              ? Number(it.profitSharing[k])
              : (k === 'nesa' && it.profitSharing?.nessa !== undefined
                ? Number(it.profitSharing.nessa)
                : Math.round((profit * cPct) / 100));
            commissions[k] += cHak;
          });
        }
      });
    } else {
      const owner = tx.ownerName || tx.owner || '';
      const tk = getTeamMemberKey(owner);
      const sell = Number(tx.sellingPrice || 0);
      const cost = Number(tx.costPrice || 0);
      const profit = Number(tx.profit !== undefined ? tx.profit : sell - cost);
      const custom = tx.skemaCustom || tx.ownerCustomScheme;

      if (tk) {
        // Barang pribadi tim: operasional toko 15%
        const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 15;
        const opsHak = tx.profitSharing?.operational !== undefined
          ? Number(tx.profitSharing.operational)
          : (tx.profitSharing?.operasional !== undefined
            ? Number(tx.profitSharing.operasional)
            : Math.round((profit * opsPct) / 100));
        commissions.operational += opsHak;
      } else {
        // Penitip luar: operasional 10% & komisi tim 5% masing-masing
        const opsPct = custom?.operational !== undefined ? Number(custom.operational) : 10;
        const opsHak = tx.profitSharing?.operational !== undefined
          ? Number(tx.profitSharing.operational)
          : (tx.profitSharing?.operasional !== undefined
            ? Number(tx.profitSharing.operasional)
            : Math.round((profit * opsPct) / 100));
        commissions.operational += opsHak;

        ['akbar', 'nesa', 'andin', 'ritza'].forEach((k) => {
          const cPct = custom?.[k] !== undefined ? Number(custom[k]) : 5;
          const cHak = tx.profitSharing?.[k] !== undefined
            ? Number(tx.profitSharing[k])
            : (k === 'nesa' && tx.profitSharing?.nessa !== undefined
              ? Number(tx.profitSharing.nessa)
              : Math.round((profit * cPct) / 100));
          commissions[k] += cHak;
        });
      }
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
  const rawOwner = (item.ownerName || item.owner || '').trim();
  const tk = getTeamMemberKey(rawOwner);

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
  } else if (tk) {
    // Otomatisasi Skema Berdasarkan Pemilik Barang Anggota Tim:
    // 85% Pemilik, 15% Ops, 0% Komisi
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

  const { sharing } = calculateProfitSharing(selling, cost, schemeToUse);

  // Jika pemilik adalah anggota tim, tetapkan hak barang pribadi langsung ke kunci anggota tim
  if (tk && sharing.pemilikBarang > 0) {
    sharing[tk] = sharing.pemilikBarang;
    if (tk === 'nesa') sharing.nessa = sharing.pemilikBarang;
    if (tk === 'akbar') sharing.muhbar = sharing.pemilikBarang;
  }

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
  const totalSharing = {
    pemilikBarang: 0,
    operational: 0,
    operasional: 0,
    akbar: 0,
    muhbar: 0,
    nesa: 0,
    nessa: 0,
    andin: 0,
    ritza: 0,
  };

  Object.keys(configToUse).forEach((key) => {
    if (totalSharing[key] === undefined) totalSharing[key] = 0;
  });

  const calculatedItems = (items || []).map((item) => {
    const selling = Number(item.sellingPrice || 0);
    const cost = Number(item.costPrice || 0);
    const { profit, sharing } = calculateItemProfitAndSharing(item, configToUse);

    totalSelling += selling;
    totalCost += cost;
    totalProfit += profit;

    const owner = item.ownerName || item.owner || '';
    const tk = getTeamMemberKey(owner);

    if (tk) {
      // Hak barang pribadi anggota tim masuk ke kolom anggota tim yang bersangkutan
      const hak = sharing[tk] !== undefined ? sharing[tk] : (sharing.pemilikBarang || 0);
      totalSharing[tk] = (totalSharing[tk] || 0) + hak;
      if (tk === 'nesa') totalSharing.nessa = (totalSharing.nessa || 0) + hak;
      if (tk === 'akbar') totalSharing.muhbar = (totalSharing.muhbar || 0) + hak;
    } else {
      // Barang milik penitip luar masuk ke pemilikBarang
      totalSharing.pemilikBarang += (sharing.pemilikBarang || 0);

      // Komisi tim dari penitip luar
      ['akbar', 'nesa', 'andin', 'ritza'].forEach((k) => {
        const cHak = getPsValue(sharing, k);
        totalSharing[k] = (totalSharing[k] || 0) + cHak;
        if (k === 'nesa') totalSharing.nessa = (totalSharing.nessa || 0) + cHak;
        if (k === 'akbar') totalSharing.muhbar = (totalSharing.muhbar || 0) + cHak;
      });
    }

    const opsHak = getPsValue(sharing, 'operational');
    totalSharing.operational += opsHak;
    totalSharing.operasional += opsHak;

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

