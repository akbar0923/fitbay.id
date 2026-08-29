import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  getWithdrawals,
  addWithdrawalDoc,
  updateWithdrawalDoc,
  deleteWithdrawalDoc,
} from '../firebase/withdrawalService';
import toast from 'react-hot-toast';

const WithdrawalContext = createContext();

export function WithdrawalProvider({ children }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const data = await getWithdrawals();
      setWithdrawals(data);
    } catch (err) {
      console.error('Error loading withdrawals:', err);
    } finally {
      setLoading(false);
    }
  };

  const addWithdrawal = async (data) => {
    try {
      const saved = await addWithdrawalDoc(data);
      setWithdrawals((prev) => [saved, ...prev.filter((w) => w.id !== saved.id)]);
      toast.success(`Penarikan untuk "${saved.recipientName}" berhasil dicatat!`);
      return saved;
    } catch (err) {
      console.error('Error adding withdrawal:', err);
      toast.error('Gagal mencatat penarikan saldo');
      throw err;
    }
  };

  const updateWithdrawal = async (id, data) => {
    try {
      const updated = await updateWithdrawalDoc(id, data);
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === id ? updated : w))
      );
      toast.success('Data penarikan berhasil diperbarui!');
      return updated;
    } catch (err) {
      console.error('Error updating withdrawal:', err);
      toast.error('Gagal memperbarui penarikan');
      throw err;
    }
  };

  const deleteWithdrawal = async (id) => {
    try {
      await deleteWithdrawalDoc(id);
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      toast.success('Data penarikan berhasil dihapus!');
    } catch (err) {
      console.error('Error deleting withdrawal:', err);
      toast.error('Gagal menghapus penarikan');
      throw err;
    }
  };

  // Map total penarikan per recipientKey (nominal asli yang mengurangi saldo)
  const totalWithdrawnByRecipient = useMemo(() => {
    const map = {};
    withdrawals.forEach((w) => {
      const key = (w.recipientKey || w.recipientName || '').toLowerCase();
      map[key] = (map[key] || 0) + (Number(w.amount) || 0);

      // Jika ada ownerName spesifik, petakan juga ke owner_
      if (w.ownerName && w.ownerName !== 'Semua Pemilik') {
        const ownerK = `owner_${w.ownerName.toLowerCase().trim()}`;
        map[ownerK] = (map[ownerK] || 0) + (Number(w.amount) || 0);
      }
    });
    return map;
  }, [withdrawals]);

  /**
   * Mendapatkan total nominal yang sudah ditarik khusus oleh pemilik barang tertentu
   * @param {string} ownerName - e.g. 'Ritza', 'Nesa', 'Budi'
   * @returns {number}
   */
  const getTotalWithdrawnByOwner = (ownerName) => {
    if (!ownerName) return 0;
    const cleanName = ownerName.trim().toLowerCase();
    
    return withdrawals.reduce((sum, w) => {
      const wOwner = (w.ownerName || '').trim().toLowerCase();
      const wKey = (w.recipientKey || '').trim().toLowerCase();

      // Cek apakah penarikan ini ditujukan untuk ownerName ini
      if (
        wOwner === cleanName ||
        wKey === `owner_${cleanName}` ||
        wKey === cleanName ||
        (wKey.startsWith('owner_') && wKey.includes(cleanName))
      ) {
        return sum + (Number(w.amount) || 0);
      }
      return sum;
    }, 0);
  };

  /**
   * Mendapatkan total nominal yang sudah ditarik oleh penerima tertentu
   * @param {string} recipientKey - e.g. 'pemilikBarang', 'akbar', 'nesa', 'andin', 'ritza', 'operational'
   * @returns {number}
   */
  const getTotalWithdrawn = (recipientKey) => {
    const key = (recipientKey || '').toLowerCase();
    const teamKeys = ['akbar', 'nesa', 'andin', 'ritza'];
    
    // Jika untuk anggota tim, gabungkan seluruh penarikan akun tersebut (baik dari komisi tim maupun barang pribadi)
    if (teamKeys.includes(key)) {
      return withdrawals.reduce((sum, w) => {
        const wKey = (w.recipientKey || '').toLowerCase();
        const wOwner = (w.ownerName || '').toLowerCase();
        if (
          wKey === key ||
          wKey === `owner_${key}` ||
          wOwner === key ||
          (key === 'nesa' && (wKey === 'nessa' || wOwner === 'nessa' || wKey === 'owner_nessa')) ||
          (key === 'akbar' && (wKey === 'muhbar' || wOwner === 'muhbar' || wKey === 'owner_muhbar'))
        ) {
          return sum + (Number(w.amount) || 0);
        }
        return sum;
      }, 0);
    }

    // Jika 'pemilikBarang', hanya gabungkan penarikan untuk pemilik barang EKSTERNAL (non-tim)
    if (key === 'pemilikbarang') {
      return withdrawals.reduce((sum, w) => {
        const wKey = (w.recipientKey || '').toLowerCase();
        const wOwner = (w.ownerName || '').toLowerCase();
        const isTeam =
          teamKeys.includes(wKey) ||
          teamKeys.some((tk) => wKey === `owner_${tk}`) ||
          teamKeys.includes(wOwner) ||
          wOwner === 'nessa' ||
          wOwner === 'muhbar';

        if (isTeam || wKey === 'operational') {
          return sum;
        }

        const isOwnerCategory = 
          wKey === 'pemilikbarang' || 
          wKey.startsWith('owner_') || 
          w.recipientCategory === 'owner' ||
          (w.ownerName && w.ownerName.length > 0 && w.ownerName !== 'Semua Pemilik');
        
        if (isOwnerCategory) {
          return sum + (Number(w.amount) || 0);
        }
        return sum;
      }, 0);
    }

    return totalWithdrawnByRecipient[key] || 0;
  };

  /**
   * Menghitung sisa saldo yang tersedia
   * @param {string} recipientKey
   * @param {number} totalEarned
   * @returns {number}
   */
  const getRemainingBalance = (recipientKey, totalEarned) => {
    const withdrawn = getTotalWithdrawn(recipientKey);
    return Math.max(0, (totalEarned || 0) - withdrawn);
  };

  const value = {
    withdrawals,
    loading,
    addWithdrawal,
    updateWithdrawal,
    deleteWithdrawal,
    getTotalWithdrawn,
    getTotalWithdrawnByOwner,
    getRemainingBalance,
    totalWithdrawnByRecipient,
    refreshWithdrawals: loadWithdrawals,
  };

  return (
    <WithdrawalContext.Provider value={value}>
      {children}
    </WithdrawalContext.Provider>
  );
}

export function useWithdrawals() {
  const context = useContext(WithdrawalContext);
  if (!context) {
    throw new Error('useWithdrawals must be used within a WithdrawalProvider');
  }
  return context;
}

export default WithdrawalContext;
