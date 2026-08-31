import { createContext, useContext, useState, useEffect } from 'react';
import {
  subscribeOwners,
  addOwnerDoc,
  updateOwnerDoc,
  deleteOwnerDoc,
} from '../firebase/ownerService';
import toast from 'react-hot-toast';

const OwnerContext = createContext();

export function OwnerProvider({ children }) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  // REAL-TIME LISTENER: Berlangganan data pemilik secara real-time dari Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeOwners(
      (ownersList) => {
        setOwners(ownersList);
        setLoading(false);
      },
      (err) => {
        console.error('Real-time owners listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addOwner = async (data) => {
    try {
      const saved = await addOwnerDoc(data);
      toast.success(`Pemilik "${saved.name}" berhasil disimpan!`);
      return saved;
    } catch (err) {
      console.error('Error adding owner:', err);
      toast.error('Gagal menambahkan pemilik barang');
      throw err;
    }
  };

  const updateOwner = async (id, data) => {
    try {
      const updated = await updateOwnerDoc(id, data);
      toast.success('Data pemilik berhasil diperbarui!');
      return updated;
    } catch (err) {
      console.error('Error updating owner:', err);
      toast.error('Gagal memperbarui pemilik barang');
      throw err;
    }
  };

  const deleteOwner = async (id) => {
    try {
      await deleteOwnerDoc(id);
      toast.success('Pemilik barang berhasil dihapus!');
    } catch (err) {
      console.error('Error deleting owner:', err);
      toast.error('Gagal menghapus pemilik barang');
      throw err;
    }
  };

  const value = {
    owners,
    loading,
    addOwner,
    updateOwner,
    deleteOwner,
  };

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwners() {
  const context = useContext(OwnerContext);
  if (!context) {
    throw new Error('useOwners must be used within an OwnerProvider');
  }
  return context;
}

export default OwnerContext;
