import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  subscribeWithdrawals,
  addWithdrawalDoc,
  updateWithdrawalDoc,
  deleteWithdrawalDoc,
} from '../firebase/withdrawalService';
import toast from 'react-hot-toast';

const WithdrawalContext = createContext();

export function WithdrawalProvider({ children }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  // REAL-TIME LISTENER: Berlangganan data penarikan saldo secara real-time dari Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeWithdrawals(
      (list) => {
        setWithdrawals(list);
        setLoading(false);
      },
      (err) => {
        console.error('Real-time withdrawals listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addWithdrawal = async (data) => {
    try {
      const saved = await addWithdrawalDoc(data);
      setWithdrawals((prev) => {
        if (prev.some((w) => w.id === saved.id)) return prev;
        return [saved, ...prev];
      });
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
      setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, ...updated } : w)));
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

  // Map total penarikan per recipientKey (nominal asli yang memotong saldo)
  const totalWithdrawnByRecipient = useMemo(() => {
    const map = {};
    withdrawals.forEach((w) => {
      const key = (w.recipientKey || w.recipientName || '').toLowerCase();
      map[key] = (map[key] || 0) + (Number(w.amount) || 0);

      // Jika ada ownerName spesifik, petakan juga ke owner_
      if (w.ownerName && w.ownerName !== 'Semua Pemilik' && w.ownerName !== 'Semua Penitip Eksternal') {
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
    const isAkbar = cleanName === 'akbar' || cleanName === 'muhbar';
    const isNesa = cleanName === 'nesa' || cleanName === 'nessa';
    
    return withdrawals.reduce((sum, w) => {
      const wOwner = (w.ownerName || '').trim().toLowerCase();
      const wKey = (w.recipientKey || '').trim().toLowerCase();

      let match = (
        wOwner === cleanName ||
        wKey === `owner_${cleanName}` ||
        wKey === cleanName ||
        (wKey.startsWith('owner_') && wKey.includes(cleanName))
      );

      if (isAkbar && (
        wOwner === 'akbar' || wOwner === 'muhbar' ||
        wKey === 'akbar' || wKey === 'muhbar' ||
        wKey === 'owner_akbar' || wKey === 'owner_muhbar'
      )) {
        match = true;
      }
      if (isNesa && (
        wOwner === 'nesa' || wOwner === 'nessa' ||
        wKey === 'nesa' || wKey === 'nessa' ||
        wKey === 'owner_nesa' || wKey === 'owner_nessa'
      )) {
        match = true;
      }

      if (match) {
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
    const rawKey = (recipientKey || '').toLowerCase().trim();
    let key = rawKey;
    if (key === 'nessa') key = 'nesa';
    if (key === 'muhbar') key = 'akbar';
    if (key === 'operasional') key = 'operational';

    const teamKeys = ['akbar', 'nesa', 'andin', 'ritza'];
    
    // Jika untuk anggota tim, gabungkan seluruh penarikan akun tersebut
    if (teamKeys.includes(key)) {
      return withdrawals.reduce((sum, w) => {
        const wKey = (w.recipientKey || '').toLowerCase().trim();
        const wOwner = (w.ownerName || '').toLowerCase().trim();
        const wRecName = (w.recipientName || '').toLowerCase().trim();

        const matchTeam =
          wKey === key ||
          wKey === `owner_${key}` ||
          wOwner === key ||
          wRecName === key ||
          (key === 'nesa' && (
            wKey === 'nessa' || wOwner === 'nessa' || wKey === 'owner_nessa' ||
            wOwner === 'nesa' || wKey === 'owner_nesa' || wRecName.includes('nesa') || wRecName.includes('nessa')
          )) ||
          (key === 'akbar' && (
            wKey === 'muhbar' || wOwner === 'muhbar' || wKey === 'owner_muhbar' ||
            wOwner === 'akbar' || wKey === 'owner_akbar' || wRecName.includes('akbar') || wRecName.includes('muhbar')
          )) ||
          (key === 'andin' && (
            wKey === 'andin' || wOwner === 'andin' || wKey === 'owner_andin' || wRecName.includes('andin')
          )) ||
          (key === 'ritza' && (
            wKey === 'ritza' || wOwner === 'ritza' || wKey === 'owner_ritza' || wRecName.includes('ritza')
          ));

        if (matchTeam) {
          return sum + (Number(w.amount) || 0);
        }
        return sum;
      }, 0);
    }

    // Jika 'pemilikBarang', hanya gabungkan penarikan untuk pemilik barang EKSTERNAL (non-tim)
    if (key === 'pemilikbarang') {
      return withdrawals.reduce((sum, w) => {
        const wKey = (w.recipientKey || '').toLowerCase().trim();
        const wOwner = (w.ownerName || '').toLowerCase().trim();
        const isTeam =
          teamKeys.includes(wKey) ||
          teamKeys.some((tk) => wKey === `owner_${tk}`) ||
          wKey === 'nessa' || wKey === 'owner_nessa' ||
          wKey === 'muhbar' || wKey === 'owner_muhbar' ||
          teamKeys.includes(wOwner) ||
          wOwner === 'nessa' ||
          wOwner === 'muhbar';

        if (isTeam || wKey === 'operational' || wKey === 'operasional') {
          return sum;
        }

        const isOwnerCategory = 
          wKey === 'pemilikbarang' || 
          wKey.startsWith('owner_') || 
          w.recipientCategory === 'owner' ||
          w.recipientCategory === 'external_owner' ||
          (w.ownerName && w.ownerName.length > 0 && w.ownerName !== 'Semua Pemilik' && w.ownerName !== 'Semua Penitip Eksternal');
        
        if (isOwnerCategory) {
          return sum + (Number(w.amount) || 0);
        }
        return sum;
      }, 0);
    }

    // Operasional
    if (key === 'operational' || key === 'operasional') {
      return withdrawals.reduce((sum, w) => {
        const wKey = (w.recipientKey || '').toLowerCase().trim();
        if (wKey === 'operational' || wKey === 'operasional') {
          return sum + (Number(w.amount) || 0);
        }
        return sum;
      }, 0);
    }

    return totalWithdrawnByRecipient[key] || totalWithdrawnByRecipient[rawKey] || 0;
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
