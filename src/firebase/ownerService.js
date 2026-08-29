import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { DEFAULT_OWNER_NAMES } from '../constants/profitSharingConfig';

const COLLECTION_NAME = 'owners';
const LOCAL_STORAGE_KEY = 'fitbay_owners_cache';

function getOwnersRef() {
  return collection(db, COLLECTION_NAME);
}

function getLocalOwners() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading local owners:', e);
  }
  return DEFAULT_OWNER_NAMES.map((name, idx) => ({
    id: `local-owner-${idx + 1}`,
    name,
    phone: '-',
    notes: 'Pemilik Awal',
    createdAt: new Date().toISOString(),
  }));
}

function saveLocalOwners(owners) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(owners));
  } catch (e) {
    console.warn('Error saving local owners:', e);
  }
}

/**
 * Mengambil semua data pemilik barang dari Firestore (dengan deduplikasi dan fallback localStorage)
 * @returns {Promise<Array>}
 */
export async function getOwners() {
  try {
    const q = query(getOwnersRef(), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Inisialisasi pemilik default ke Firestore
      const seededOwners = [];
      for (const name of DEFAULT_OWNER_NAMES) {
        const newOwner = {
          name,
          phone: '-',
          notes: 'Pemilik Awal',
          createdAt: new Date().toISOString(),
        };
        const docRef = await addDoc(getOwnersRef(), newOwner);
        seededOwners.push({ id: docRef.id, ...newOwner });
      }
      saveLocalOwners(seededOwners);
      return seededOwners;
    }

    const allRemoteDocs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Deduplikasi pemilik berdasarkan nama (lowercase)
    const seenNames = new Set();
    const uniqueOwners = [];
    const duplicateIdsToDelete = [];

    for (const owner of allRemoteDocs) {
      const normalizedName = (owner.name || '').trim().toLowerCase();
      if (!normalizedName) continue;

      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueOwners.push(owner);
      } else {
        // Tandai ID duplikat untuk dihapus dari Firestore agar bersih
        duplicateIdsToDelete.push(owner.id);
      }
    }

    // Bersihkan dokumen duplikat dari Firestore di latar belakang
    if (duplicateIdsToDelete.length > 0) {
      duplicateIdsToDelete.forEach(async (dupId) => {
        try {
          await deleteDoc(doc(db, COLLECTION_NAME, dupId));
        } catch (e) {
          console.warn('Error cleaning up duplicate owner doc:', e);
        }
      });
    }

    saveLocalOwners(uniqueOwners);
    return uniqueOwners;
  } catch (err) {
    console.warn('Could not fetch owners from Firestore, using local fallback:', err);
    const local = getLocalOwners();
    const seen = new Set();
    return local.filter((o) => {
      const k = (o.name || '').trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
}

/**
 * Menambah pemilik barang baru (ke Firestore dan cache lokal)
 * @param {object} data - { name, phone, notes }
 * @returns {Promise<object>}
 */
export async function addOwnerDoc(data) {
  const newDoc = {
    name: data.name.trim(),
    phone: data.phone || '-',
    notes: data.notes || '',
    isCustomScheme: Boolean(data.isCustomScheme),
    customScheme: data.customScheme || null,
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(getOwnersRef(), newDoc);
    const saved = { id: docRef.id, ...newDoc };
    const current = getLocalOwners();
    saveLocalOwners([...current, saved]);
    return saved;
  } catch (err) {
    console.warn('Firestore write failed, saving locally:', err);
    const saved = { id: `owner-${Date.now()}`, ...newDoc };
    const current = getLocalOwners();
    saveLocalOwners([...current, saved]);
    return saved;
  }
}

/**
 * Mengupdate pemilik barang
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateOwnerDoc(id, data) {
  const { id: _, ...updateData } = data;
  const cleanData = {
    ...updateData,
    name: updateData.name ? updateData.name.trim() : updateData.name,
    isCustomScheme: Boolean(updateData.isCustomScheme),
    customScheme: updateData.customScheme || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, cleanData);
  } catch (err) {
    console.warn('Firestore update failed, updating locally:', err);
  }

  const current = getLocalOwners();
  const updatedList = current.map((o) => (o.id === id ? { ...o, ...cleanData } : o));
  saveLocalOwners(updatedList);
  return { id, ...cleanData };
}

/**
 * Menghapus pemilik barang
 * @param {string} id
 */
export async function deleteOwnerDoc(id) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore delete failed, deleting locally:', err);
  }

  const current = getLocalOwners();
  saveLocalOwners(current.filter((o) => o.id !== id));
}
