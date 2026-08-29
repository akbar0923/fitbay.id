import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { calculateProfitSharing } from '../utils/calculateProfitSharing';
import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';
import {
  getTransactions,
  addTransactionDoc,
  updateTransactionDoc,
  deleteTransactionDoc,
} from '../firebase/firestoreService';
import {
  getProfitSharingSettings,
  saveProfitSharingSettings,
} from '../firebase/settingsService';
import { restoreItemToUnsold } from '../firebase/inventoryService';
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

    case ACTIONS.ADD_TRANSACTION:
      return {
        ...state,
        transactions: [action.payload, ...state.transactions],
      };

    case ACTIONS.UPDATE_TRANSACTION:
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.payload.id ? action.payload : tx
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

  // Load data transaksi dan setting bagi hasil dari Firestore on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load settings & transactions secara paralel
      const [txsData, settingsConfig] = await Promise.all([
        getTransactions(),
        getProfitSharingSettings(),
      ]);

      dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: txsData });
      if (settingsConfig) {
        setProfitSharingConfig(settingsConfig);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Gagal memuat data. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await getTransactions();
      dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: data });
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

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

      const { profit, sharing } = calculateProfitSharing(
        Number(data.sellingPrice),
        Number(data.costPrice),
        schemeToUse
      );

      const newTransaction = {
        date: data.date,
        itemName: data.itemName,
        ownerName: data.ownerName || 'Akbar',
        category: data.category || 'Baju',
        costPrice: Number(data.costPrice || 0),
        sellingPrice: Number(data.sellingPrice),
        paymentMethod: data.paymentMethod || 'Transfer Bank',
        profit,
        status: data.status || 'Terjual',
        profitSharing: sharing,
        ownerCustomScheme: customScheme || null,
        skemaCustom: customScheme || null,
        kodeBarang: data.kodeBarang || null,
        inventoryItemId: data.inventoryItemId || null,
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

      const { profit, sharing } = calculateProfitSharing(
        Number(data.sellingPrice),
        Number(data.costPrice),
        schemeToUse
      );

      const updated = {
        ...data,
        id,
        ownerName: data.ownerName || 'Akbar',
        paymentMethod: data.paymentMethod || 'Transfer Bank',
        costPrice: Number(data.costPrice || 0),
        sellingPrice: Number(data.sellingPrice),
        profit,
        profitSharing: sharing,
        ownerCustomScheme: customScheme || null,
        skemaCustom: customScheme || null,
        kodeBarang: data.kodeBarang || null,
        inventoryItemId: data.inventoryItemId || null,
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

  const deleteTransaction = async (id) => {
    try {
      const targetTx = state.transactions.find((t) => t.id === id);
      if (targetTx?.inventoryItemId) {
        try {
          await restoreItemToUnsold(targetTx.inventoryItemId);
        } catch (invErr) {
          console.warn('Could not restore inventory item to unsold:', invErr);
        }
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
