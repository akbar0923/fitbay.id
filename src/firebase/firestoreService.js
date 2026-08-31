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

const COLLECTION_NAME = 'transactions';

/**
 * Mendapatkan referensi collection transactions
 */
function getTransactionsRef() {
  return collection(db, COLLECTION_NAME);
}

/**
 * Real-time listener untuk koleksi transaksi dari Firestore
 * @param {Function} callback - Menerima array transaksi terbaru setiap kali ada perubahan
 * @param {Function} onError - Callback jika terjadi error
 * @returns {Function} Unsubscribe function untuk cleanup
 */
export function subscribeTransactions(callback, onError) {
  try {
    const q = query(getTransactionsRef(), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callback(transactions);
      },
      (error) => {
        console.warn('Real-time transactions onSnapshot error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Error attaching subscribeTransactions listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Mengambil semua transaksi dari Firestore (One-time fetch)
 * @returns {Promise<Array>} Array of transaction objects
 */
export async function getTransactions() {
  const q = query(getTransactionsRef(), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

/**
 * Menambah transaksi baru ke Firestore
 * @param {object} data - Transaction data (tanpa id, id dihasilkan Firestore)
 * @returns {Promise<object>} Transaction dengan id dari Firestore
 */
export async function addTransactionDoc(data) {
  const docRef = await addDoc(getTransactionsRef(), data);
  return { id: docRef.id, ...data };
}

/**
 * Mengupdate transaksi di Firestore
 * @param {string} id - Document ID
 * @param {object} data - Updated fields
 * @returns {Promise<object>} Updated transaction
 */
export async function updateTransactionDoc(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const { id: _, ...updateData } = data;
  await setDoc(docRef, updateData, { merge: true });
  return { id, ...updateData };
}

/**
 * Menghapus transaksi dari Firestore
 * @param {string} id - Document ID
 */
export async function deleteTransactionDoc(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
