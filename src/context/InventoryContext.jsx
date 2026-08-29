import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  subscribeInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  markItemAsSold,
  restoreItemToUnsold,
  getNextItemCode,
  getLocalInventory,
} from '../firebase/inventoryService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(() => getLocalInventory());
  const [loading, setLoading] = useState(true);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeInventory((fetchedItems) => {
      setItems(fetchedItems);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter items
  const availableItems = useMemo(() => {
    return items.filter((item) => item.status === 'Belum Terjual');
  }, [items]);

  const soldItems = useMemo(() => {
    return items.filter((item) => item.status === 'Terjual');
  }, [items]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = items.length;
    const availableCount = availableItems.length;
    const soldCount = soldItems.length;
    const totalCapitalValue = availableItems.reduce((sum, item) => sum + (Number(item.hargaModal) || 0), 0);
    const soldCapitalValue = soldItems.reduce((sum, item) => sum + (Number(item.hargaModal) || 0), 0);

    return {
      total,
      availableCount,
      soldCount,
      totalCapitalValue,
      soldCapitalValue,
    };
  }, [items, availableItems, soldItems]);

  const addItem = useCallback(
    async (itemData) => {
      try {
        const author = user?.username || 'admin';
        const newItem = await addInventoryItem(itemData, author);
        toast.success(`Barang ${newItem.kodeBarang} berhasil didata!`);
        return newItem;
      } catch (err) {
        toast.error(err.message || 'Gagal menambahkan barang ke inventaris');
        throw err;
      }
    },
    [user]
  );

  const updateItem = useCallback(async (id, updateData) => {
    try {
      const updated = await updateInventoryItem(id, updateData);
      toast.success('Data barang berhasil diperbarui!');
      return updated;
    } catch (err) {
      toast.error('Gagal memperbarui data barang');
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    try {
      await deleteInventoryItem(id);
      toast.success('Barang berhasil dihapus dari inventaris');
    } catch (err) {
      toast.error('Gagal menghapus barang');
      throw err;
    }
  }, []);

  const markAsSold = useCallback(async (id, transactionId) => {
    try {
      await markItemAsSold(id, transactionId);
    } catch (err) {
      console.warn('Failed to mark item as sold:', err);
    }
  }, []);

  const restoreToUnsold = useCallback(async (id) => {
    try {
      await restoreItemToUnsold(id);
    } catch (err) {
      console.warn('Failed to restore item to unsold:', err);
    }
  }, []);

  const getItemByCode = useCallback(
    (code) => {
      if (!code) return null;
      return items.find((i) => i.kodeBarang?.toLowerCase() === code.trim().toLowerCase()) || null;
    },
    [items]
  );

  const getItemById = useCallback(
    (id) => {
      if (!id) return null;
      return items.find((i) => i.id === id) || null;
    },
    [items]
  );

  const value = {
    items,
    availableItems,
    soldItems,
    loading,
    stats,
    addItem,
    updateItem,
    deleteItem,
    markAsSold,
    restoreToUnsold,
    getNextItemCode,
    getItemByCode,
    getItemById,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
