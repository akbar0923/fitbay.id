import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const COLLECTION_NAME = 'owners';

function getOwnersRef() {
  return collection(db, COLLECTION_NAME);
}

/**
 * Real-time listener untuk koleksi pemilik barang dari Firestore
 * @param {Function} callback
 * @param {Function} onError
 * @returns {Function} Unsubscribe function
 */
export function subscribeOwners(callback, onError) {
  try {
    const q = query(getOwnersRef(), orderBy('name', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const owners = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callback(owners);
      },
      (error) => {
        console.warn('Real-time owners onSnapshot error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Error attaching subscribeOwners listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Mengambil semua data pemilik barang dari Firestore (One-time fetch)
 * @returns {Promise<Array>}
 */
export async function getOwners() {
  try {
    const q = query(getOwnersRef(), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.warn('Could not fetch owners from Firestore:', err);
    return [];
  }
}

/**
 * Menambah pemilik barang baru ke Firestore
 * @param {object} data - { name, phone, notes, isCustomScheme, customScheme }
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

  const docRef = await addDoc(getOwnersRef(), newDoc);
  return { id: docRef.id, ...newDoc };
}

/**
 * Mengupdate pemilik barang di Firestore
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

  const docRef = doc(db, COLLECTION_NAME, id);
  await setDoc(docRef, cleanData, { merge: true });
  return { id, ...cleanData };
}

/**
 * Menghapus pemilik barang dari Firestore
 * @param {string} id
 */
export async function deleteOwnerDoc(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
