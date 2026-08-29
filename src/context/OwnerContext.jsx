import { createContext, useContext, useState, useEffect } from 'react';
import {
  getOwners,
  addOwnerDoc,
  updateOwnerDoc,
  deleteOwnerDoc,
} from '../firebase/ownerService';
import toast from 'react-hot-toast';

const OwnerContext = createContext();

export function OwnerProvider({ children }) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOwners();
  }, []);

  const loadOwners = async () => {
    try {
      setLoading(true);
      const data = await getOwners();
      setOwners(data);
    } catch (err) {
      console.error('Error loading owners:', err);
    } finally {
      setLoading(false);
    }
  };

  const addOwner = async (data) => {
    try {
      const saved = await addOwnerDoc(data);
      setOwners((prev) => {
        const filtered = prev.filter((o) => o.id !== saved.id);
        return [...filtered, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
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
      setOwners((prev) =>
        prev
          .map((o) => (o.id === id ? updated : o))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
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
      setOwners((prev) => prev.filter((o) => o.id !== id));
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
    refreshOwners: loadOwners,
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
