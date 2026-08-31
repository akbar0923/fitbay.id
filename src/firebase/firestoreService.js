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

const COLLECTION_NAME = 'transactions';

/**
 * Mendapatkan referensi collection transactions
 */
function getTransactionsRef() {
  return collection(db, COLLECTION_NAME);
}

/**
 * Mengambil semua transaksi dari Firestore
 * @returns {Promise<Array>} Array of transaction objects
 */
export async function getTransactions() {
  const q = query(getTransactionsRef(), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
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
  // Hapus field id dari data sebelum update
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
