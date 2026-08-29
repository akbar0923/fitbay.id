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

const COLLECTION_NAME = 'withdrawals';
const LOCAL_STORAGE_KEY = 'fitbay_withdrawals_cache';

function getWithdrawalsRef() {
  return collection(db, COLLECTION_NAME);
}

function getLocalWithdrawals() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading local withdrawals:', e);
  }
  return [];
}

function saveLocalWithdrawals(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Error saving local withdrawals:', e);
  }
}

/**
 * Mengambil semua data penarikan saldo dari Firestore (dengan fallback localStorage)
 * @returns {Promise<Array>}
 */
export async function getWithdrawals() {
  try {
    const q = query(getWithdrawalsRef(), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);

    const remoteItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    saveLocalWithdrawals(remoteItems);
    return remoteItems;
  } catch (err) {
    console.warn('Could not fetch withdrawals from Firestore, using local fallback:', err);
    return getLocalWithdrawals();
  }
}

/**
 * Menambah penarikan saldo baru
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
    amount: amount, // Nominal asli yang memotong saldo
    roundingAmount: roundingAmount, // Nominal pembulatan
    totalTransferred: totalTransferred, // Total uang yang dikirimkan
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(getWithdrawalsRef(), newDoc);
    const saved = { id: docRef.id, ...newDoc };
    const current = getLocalWithdrawals();
    saveLocalWithdrawals([saved, ...current]);
    return saved;
  } catch (err) {
    console.warn('Firestore write failed, saving locally:', err);
    const saved = { id: `withdrawal-${Date.now()}`, ...newDoc };
    const current = getLocalWithdrawals();
    saveLocalWithdrawals([saved, ...current]);
    return saved;
  }
}

/**
 * Mengupdate data penarikan saldo
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

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, cleanData);
  } catch (err) {
    console.warn('Firestore update failed, updating locally:', err);
  }

  const current = getLocalWithdrawals();
  const updatedList = current.map((w) => (w.id === id ? { ...w, ...cleanData } : w));
  saveLocalWithdrawals(updatedList);
  return { id, ...cleanData };
}

/**
 * Menghapus penarikan saldo
 * @param {string} id
 */
export async function deleteWithdrawalDoc(id) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore delete failed, deleting locally:', err);
  }

  const current = getLocalWithdrawals();
  saveLocalWithdrawals(current.filter((w) => w.id !== id));
}
