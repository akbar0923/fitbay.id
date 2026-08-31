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

const COLLECTION_NAME = 'withdrawals';

function getWithdrawalsRef() {
  return collection(db, COLLECTION_NAME);
}

/**
 * Real-time listener untuk data penarikan saldo dari Firestore
 * @param {Function} callback
 * @param {Function} onError
 * @returns {Function} Unsubscribe function
 */
export function subscribeWithdrawals(callback, onError) {
  try {
    const q = query(getWithdrawalsRef(), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callback(list);
      },
      (error) => {
        console.warn('Real-time withdrawals onSnapshot error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Error attaching subscribeWithdrawals listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Mengambil semua data penarikan saldo dari Firestore (One-time fetch)
 * @returns {Promise<Array>}
 */
export async function getWithdrawals() {
  try {
    const q = query(getWithdrawalsRef(), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.warn('Could not fetch withdrawals from Firestore:', err);
    return [];
  }
}

/**
 * Menambah penarikan saldo baru ke Firestore
 * @param {object} data - { recipientKey, recipientName, date, amount, roundingAmount, notes }
 * @returns {Promise<object>}
 */
export async function addWithdrawalDoc(data) {
  const amount = Number(data.amount) || 0;
  const roundingAmount = Number(data.roundingAmount) || 0;
  const totalTransferred = amount + roundingAmount;

  const newDoc = {
    recipientKey: data.recipientKey,
    recipientName: data.recipientName,
    recipientCategory: data.recipientCategory || (data.recipientKey === 'pemilikBarang' || String(data.recipientKey).startsWith('owner_') ? 'owner' : (data.recipientKey === 'operational' ? 'operational' : 'team')),
    ownerName: data.ownerName || (String(data.recipientKey).startsWith('owner_') ? String(data.recipientKey).replace('owner_', '') : (data.recipientKey === 'pemilikBarang' ? 'Semua Pemilik' : null)),
    date: data.date,
    amount: amount,
    roundingAmount: roundingAmount,
    totalTransferred: totalTransferred,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(getWithdrawalsRef(), newDoc);
  return { id: docRef.id, ...newDoc };
}

/**
 * Mengupdate data penarikan saldo di Firestore
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateWithdrawalDoc(id, data) {
  const amount = Number(data.amount) || 0;
  const roundingAmount = Number(data.roundingAmount) || 0;
  const totalTransferred = amount + roundingAmount;

  const { id: _, ...updateData } = data;
  const cleanData = {
    ...updateData,
    amount,
    roundingAmount,
    totalTransferred,
    notes: data.notes || '',
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, COLLECTION_NAME, id);
  await setDoc(docRef, cleanData, { merge: true });
  return { id, ...cleanData };
}

/**
 * Menghapus penarikan saldo dari Firestore
 * @param {string} id
 */
export async function deleteWithdrawalDoc(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
