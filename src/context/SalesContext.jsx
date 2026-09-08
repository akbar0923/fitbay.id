import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { calculateProfitSharing, calculateOrderTotals } from '../utils/calculateProfitSharing';
import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';
import {
  getTransactions,
  subscribeTransactions,
  addTransactionDoc,
  updateTransactionDoc,
  deleteTransactionDoc,
} from '../firebase/firestoreService';
import {
  getProfitSharingSettings,
  subscribeProfitSharingSettings,
  saveProfitSharingSettings,
} from '../firebase/settingsService';
import { restoreItemToUnsold, restoreItemsByTransactionRef, markItemAsSold } from '../firebase/inventoryService';
import toast from 'react-hot-toast';

const SalesContext = createContext();

// Action types
const ACTIONS = {
  SET_TRANSACTIONS: 'SET_TRANSACTIONS',
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  UPDATE_TRANSACTION: 'UPDATE_TRANSACTION',
  DELETE_TRANSACTION: 'DELETE_TRANSACTION',
};

// Reducer
function salesReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_TRANSACTIONS:
      return {
        ...state,
        transactions: action.payload,
      };

    case ACTIONS.ADD_TRANSACTION: {
      const exists = state.transactions.some((t) => t.id === action.payload.id);
      if (exists) return state;
      return {
        ...state,
        transactions: [action.payload, ...state.transactions],
      };
    }

    case ACTIONS.UPDATE_TRANSACTION:
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.payload.id ? { ...tx, ...action.payload } : tx
        ),
      };

    case ACTIONS.DELETE_TRANSACTION:
      return {
        ...state,
        transactions: state.transactions.filter((tx) => tx.id !== action.payload),
      };

    default:
      return state;
  }
}

export function SalesProvider({ children }) {
  // Theme di localStorage
  const [theme, setTheme] = useLocalStorage('fitbay_theme', 'dark');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Konfigurasi Persentase Bagi Hasil Dinamis
  const [profitSharingConfig, setProfitSharingConfig] = useState(PROFIT_SHARING_CONFIG);

  const [state, dispatch] = useReducer(salesReducer, {
    transactions: [],
  });

  // REAL-TIME LISTENER: Berlangganan transaksi & pengaturan bagi hasil dari Firestore
  useEffect(() => {
    setLoading(true);
    setError(null);

    // 1. Subscribe ke koleksi transaksi
    const unsubscribeTransactions = subscribeTransactions(
      (transactionsList) => {
        dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: transactionsList });
        setLoading(false);
      },
      (err) => {
        console.error('Real-time transaction listener error:', err);
        setError('Gagal memuat data transaksi real-time.');
        setLoading(false);
      }
    );

    // 2. Subscribe ke setting bagi hasil
    const unsubscribeSettings = subscribeProfitSharingSettings((newConfig) => {
      if (newConfig) {
        setProfitSharingConfig(newConfig);
      }
    });

    // Cleanup: Unsubscribe saat unmount agar tidak terjadi memory leak
    return () => {
      unsubscribeTransactions();
      unsubscribeSettings();
    };
  }, []);

  // Update persentase bagi hasil
  const updateProfitSharingConfig = async (newConfig) => {
    try {
      await saveProfitSharingSettings(newConfig);
      setProfitSharingConfig(newConfig);
      toast.success('Pengaturan persentase bagi hasil berhasil disimpan!');
    } catch (err) {
      console.error('Error saving profit sharing settings:', err);
      toast.error('Gagal menyimpan pengaturan persentase');
      throw err;
    }
  };

  // Reset persentase bagi hasil ke default
  const resetProfitSharingConfig = async () => {
    try {
      await saveProfitSharingSettings(PROFIT_SHARING_CONFIG);
      setProfitSharingConfig(PROFIT_SHARING_CONFIG);
      toast.success('Persentase bagi hasil dikembalikan ke default!');
    } catch (err) {
      console.error('Error resetting profit sharing settings:', err);
    }
  };

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // CRUD Operations — Firestore
  const addTransaction = async (data) => {
    try {
      let sellingPrice = Number(data.sellingPrice || 0);
      let costPrice = Number(data.costPrice || 0);
      let profit = 0;
      let sharing = {};
      let finalItems = data.items || null;
      let itemName = data.itemName || '';
      let kodeBarang = data.kodeBarang || null;
      let ownerName = data.ownerName || 'Akbar';
      let category = data.category || 'Baju';

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const totals = calculateOrderTotals(data.items, profitSharingConfig);
        sellingPrice = totals.totalSelling;
        costPrice = totals.totalCost;
        profit = totals.totalProfit;
        sharing = totals.totalSharing;
        finalItems = totals.calculatedItems;

        if (data.items.length === 1) {
          itemName = data.items[0].itemName || itemName;
          kodeBarang = data.items[0].kodeBarang || kodeBarang;
          ownerName = data.items[0].ownerName || ownerName;
          category = data.items[0].category || category;
        } else {
          const names = data.items.map((it) => it.itemName).filter(Boolean);
          itemName = `${names.join(', ')} (${data.items.length} Barang)`;
          const codes = data.items.map((it) => it.kodeBarang).filter(Boolean);
          kodeBarang = codes.length > 0 ? codes.join(', ') : null;
          const owners = [...new Set(data.items.map((it) => it.ownerName).filter(Boolean))];
          ownerName = owners.length === 1 ? owners[0] : (owners.join(', ') || 'Akbar');
          const categories = [...new Set(data.items.map((it) => it.category).filter(Boolean))];
          category = categories.length === 1 ? categories[0] : 'Campuran';
        }
      } else {
        let schemeToUse = profitSharingConfig;
        const customScheme = data.skemaCustom || data.ownerCustomScheme;
        if (customScheme) {
          schemeToUse = {};
          Object.keys(profitSharingConfig).forEach((k) => {
            schemeToUse[k] = {
              ...profitSharingConfig[k],
              percentage: Number(customScheme[k] || 0),
            };
          });
        }

        const calc = calculateProfitSharing(sellingPrice, costPrice, schemeToUse);
        profit = calc.profit;
        sharing = calc.sharing;
      }

      const newTransaction = {
        date: data.date,
        itemName,
        ownerName,
        category,
        costPrice,
        sellingPrice,
        paymentMethod: data.paymentMethod || 'Transfer Bank',
        sumberPesanan: data.sumberPesanan || 'WhatsApp',
        profit,
        status: data.status || 'Terjual',
        profitSharing: sharing,
        ownerCustomScheme: data.skemaCustom || data.ownerCustomScheme || null,
        skemaCustom: data.skemaCustom || data.ownerCustomScheme || null,
        kodeBarang: kodeBarang || null,
        inventoryItemId: data.inventoryItemId || (finalItems?.[0]?.inventoryItemId) || null,
        items: finalItems,
        // Data Pengiriman & Penerima
        namaPenerima: data.namaPenerima || '',
        noHpPenerima: data.noHpPenerima || '',
        alamatPenerima: data.alamatPenerima || '',
        ekspedisi: data.ekspedisi || 'J&T Express',
        resi: data.resi || '',
        catatanPengiriman: data.catatanPengiriman || '',
        createdAt: new Date().toISOString(),
      };

      // Simpan ke Firestore (id dihasilkan Firestore)
      const saved = await addTransactionDoc(newTransaction);
      dispatch({ type: ACTIONS.ADD_TRANSACTION, payload: saved });
      toast.success('Transaksi berhasil ditambahkan!');
      return saved;
    } catch (err) {
      console.error('Error adding transaction:', err);
      if (err.code === 'permission-denied') {
        toast.error('Gagal: Akses ditolak. Pastikan Rules Firestore sudah di-publish di Firebase Console.');
      } else if (err.code === 'unavailable') {
        toast.error('Gagal: Database Firestore offline / tidak terhubung.');
      } else {
        toast.error(`Gagal menambahkan transaksi: ${err.message || 'Coba lagi.'}`);
      }
      throw err;
    }
  };

  // Batch import transactions
  const addTransactionsBatch = async (items, onProgress) => {
    try {
      const savedItems = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const { profit, sharing } = calculateProfitSharing(
          Number(item.sellingPrice),
          Number(item.costPrice || 0),
          profitSharingConfig
        );

        const newTransaction = {
          date: item.date,
          itemName: item.itemName,
          ownerName: item.ownerName || item.owner || 'Akbar',
          category: item.category || 'Baju',
          costPrice: Number(item.costPrice || 0),
          sellingPrice: Number(item.sellingPrice),
          paymentMethod: item.paymentMethod || 'Transfer Bank',
          profit,
          status: item.status || 'Terjual',
          profitSharing: sharing,
          kodeBarang: item.kodeBarang || null,
          inventoryItemId: item.inventoryItemId || null,
          createdAt: new Date(Date.now() + i * 100).toISOString(),
        };

        const saved = await addTransactionDoc(newTransaction);
        savedItems.push(saved);
        if (onProgress) onProgress(i + 1, items.length);
      }

      // Refresh transactions state from Firestore
      await loadTransactions();
      return savedItems;
    } catch (err) {
      console.error('Error batch adding transactions:', err);
      if (err.code === 'permission-denied') {
        toast.error('Gagal: Akses ditolak oleh Rules Firestore.');
      } else {
        toast.error(`Gagal mengimpor batch: ${err.message || 'Coba lagi.'}`);
      }
      throw err;
    }
  };

  const updateTransaction = async (id, data) => {
    try {
      let sellingPrice = Number(data.sellingPrice || 0);
      let costPrice = Number(data.costPrice || 0);
      let profit = 0;
      let sharing = {};
      let finalItems = data.items || null;
      let itemName = data.itemName || '';
      let kodeBarang = data.kodeBarang || null;
      let ownerName = data.ownerName || 'Akbar';
      let category = data.category || 'Baju';

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const totals = calculateOrderTotals(data.items, profitSharingConfig);
        sellingPrice = totals.totalSelling;
        costPrice = totals.totalCost;
        profit = totals.totalProfit;
        sharing = totals.totalSharing;
        finalItems = totals.calculatedItems;

        if (data.items.length === 1) {
          itemName = data.items[0].itemName || itemName;
          kodeBarang = data.items[0].kodeBarang || kodeBarang;
          ownerName = data.items[0].ownerName || ownerName;
          category = data.items[0].category || category;
        } else {
          const names = data.items.map((it) => it.itemName).filter(Boolean);
          itemName = `${names.join(', ')} (${data.items.length} Barang)`;
          const codes = data.items.map((it) => it.kodeBarang).filter(Boolean);
          kodeBarang = codes.length > 0 ? codes.join(', ') : null;
          const owners = [...new Set(data.items.map((it) => it.ownerName).filter(Boolean))];
          ownerName = owners.length === 1 ? owners[0] : (owners.join(', ') || 'Akbar');
          const categories = [...new Set(data.items.map((it) => it.category).filter(Boolean))];
          category = categories.length === 1 ? categories[0] : 'Campuran';
        }
      } else {
        let schemeToUse = profitSharingConfig;
        const customScheme = data.skemaCustom || data.ownerCustomScheme;
        if (customScheme) {
          schemeToUse = {};
          Object.keys(profitSharingConfig).forEach((k) => {
            schemeToUse[k] = {
              ...profitSharingConfig[k],
              percentage: Number(customScheme[k] || 0),
            };
          });
        }

        const calc = calculateProfitSharing(sellingPrice, costPrice, schemeToUse);
        profit = calc.profit;
        sharing = calc.sharing;
      }

      const updated = {
        ...data,
        id,
        itemName,
        ownerName,
        category,
        paymentMethod: data.paymentMethod || 'Transfer Bank',
        costPrice,
        sellingPrice,
        profit,
        profitSharing: sharing,
        ownerCustomScheme: data.skemaCustom || data.ownerCustomScheme || null,
        skemaCustom: data.skemaCustom || data.ownerCustomScheme || null,
        kodeBarang: kodeBarang || null,
        inventoryItemId: data.inventoryItemId || (finalItems?.[0]?.inventoryItemId) || null,
        items: finalItems,
        updatedAt: new Date().toISOString(),
      };

      // Update di Firestore
      await updateTransactionDoc(id, updated);
      dispatch({ type: ACTIONS.UPDATE_TRANSACTION, payload: updated });
      toast.success('Transaksi berhasil diperbarui!');
      return updated;
    } catch (err) {
      console.error('Error updating transaction:', err);
      if (err.code === 'permission-denied') {
        toast.error('Gagal: Akses ditolak. Pastikan Rules Firestore sudah di-publish.');
      } else {
        toast.error(`Gagal memperbarui transaksi: ${err.message || 'Coba lagi.'}`);
      }
      throw err;
    }
  };

  // Merge Multiple Transactions into 1 unified Transaction
  const mergeTransactions = async (sourceTxIds, mergedData) => {
    try {
      // 1. Tambah transaksi baru gabungan
      const saved = await addTransaction(mergedData);

      // 2. Tandai semua item inventaris terkait transaksi baru menjadi Terjual
      if (mergedData.items && Array.isArray(mergedData.items)) {
        for (const item of mergedData.items) {
          const invId = item.inventoryItemId;
          if (invId) {
            try {
              await markItemAsSold(invId, saved.id, {
                sellingPrice: Number(item.sellingPrice || 0),
                namaPenerima: mergedData.namaPenerima || '',
                noHpPenerima: mergedData.noHpPenerima || '',
                alamatPenerima: mergedData.alamatPenerima || '',
                ekspedisi: mergedData.ekspedisi || 'J&T Express',
                resi: mergedData.resi || '',
              });
            } catch (itemErr) {
              console.warn('Error marking item as sold in merge:', itemErr);
            }
          }
        }
      }

      // 3. Hapus dokumen transaksi lama dari Firestore (tanpa me-restore inventaris)
      for (const oldId of sourceTxIds) {
        try {
          await deleteTransactionDoc(oldId);
          dispatch({ type: ACTIONS.DELETE_TRANSACTION, payload: oldId });
        } catch (delErr) {
          console.warn(`Could not delete old transaction ${oldId}:`, delErr);
        }
      }

      toast.success(`Berhasil menggabungkan ${sourceTxIds.length} transaksi menjadi 1 transaksi! 🎉`);
      return saved;
    } catch (err) {
      console.error('Error merging transactions:', err);
      toast.error('Gagal menggabungkan transaksi.');
      throw err;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      const targetTx = state.transactions.find((t) => t.id === id);
      
      // Cascade: Kembalikan seluruh barang terkait transaksi ini menjadi Belum Terjual
      try {
        await restoreItemsByTransactionRef(id, targetTx?.inventoryItemId);
        if (targetTx?.items && Array.isArray(targetTx.items)) {
          for (const it of targetTx.items) {
            if (it.inventoryItemId) {
              await restoreItemToUnsold(it.inventoryItemId).catch(() => {});
            }
          }
        }
      } catch (invErr) {
        console.warn('Could not restore inventory item to unsold:', invErr);
      }

      // Hapus dari Firestore
      await deleteTransactionDoc(id);
      dispatch({ type: ACTIONS.DELETE_TRANSACTION, payload: id });
      toast.success('Transaksi berhasil dihapus!');
    } catch (err) {
      console.error('Error deleting transaction:', err);
      if (err.code === 'permission-denied') {
        toast.error('Gagal: Akses ditolak. Pastikan Rules Firestore sudah di-publish.');
      } else {
        toast.error(`Gagal menghapus transaksi: ${err.message || 'Coba lagi.'}`);
      }
      throw err;
    }
  };

  // Computed values
  const getTransactionsByDateRange = (startDate, endDate) => {
    return state.transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= new Date(startDate) && txDate <= new Date(endDate);
    });
  };

  const getCurrentMonthTransactions = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return getTransactionsByDateRange(start, end);
  };

  const getTotalRevenue = (transactions) => {
    return transactions
      .filter((tx) => tx.status === 'Terjual')
      .reduce((sum, tx) => sum + tx.sellingPrice, 0);
  };

  const getTotalProfit = (transactions) => {
    return transactions
      .filter((tx) => tx.status === 'Terjual')
      .reduce((sum, tx) => sum + tx.profit, 0);
  };

  const loadTransactions = async () => {
    try {
      const data = await getTransactions();
      dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: data });
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

  const value = {
    transactions: state.transactions,
    loading,
    error,
    theme,
    toggleTheme,
    profitSharingConfig,
    updateProfitSharingConfig,
    resetProfitSharingConfig,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    mergeTransactions,
    deleteTransaction,
    getTransactionsByDateRange,
    getCurrentMonthTransactions,
    getTotalRevenue,
    getTotalProfit,
    refreshData: loadTransactions,
  };

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
}

export default SalesContext;
