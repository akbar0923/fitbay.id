import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const COLLECTION_NAME = 'inventory';
const COUNTER_DOC_ID = '__inventory_counter__';

function getInventoryRef() {
  return collection(db, COLLECTION_NAME);
}

/**
 * Format nomor urut menjadi string kode FB-XXXX (misal 1 -> 'FB-0001')
 * @param {number} num
 * @returns {string}
 */
export function formatItemCode(num) {
  return `FB-${String(num).padStart(4, '0')}`;
}

/**
 * Ekstrak nomor angka dari kode barang (misal 'FB-0042' -> 42)
 * @param {string} code
 * @returns {number}
 */
export function parseItemCodeNumber(code) {
  if (!code) return 0;
  const match = code.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Generate kode barang berikutnya secara otomatis dan aman dari duplikasi
 * @returns {Promise<{ nextCode: string, nextNumber: number }>}
 */
export async function getNextItemCode() {
  let highestNum = 0;

  try {
    const q = query(getInventoryRef(), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.forEach((docSnap) => {
      if (docSnap.id !== COUNTER_DOC_ID) {
        const item = docSnap.data();
        const num = item.itemNumber || parseItemCodeNumber(item.kodeBarang);
        if (num > highestNum) highestNum = num;
      }
    });

    const counterDocRef = doc(db, COLLECTION_NAME, COUNTER_DOC_ID);
    const counterSnap = await getDoc(counterDocRef);
    if (counterSnap.exists()) {
      const cloudNum = counterSnap.data().lastNumber || 0;
      highestNum = Math.max(highestNum, cloudNum);
    }
  } catch (err) {
    console.warn('Firestore counter read fallback:', err);
  }

  const nextNumber = highestNum + 1;
  return {
    nextCode: formatItemCode(nextNumber),
    nextNumber,
  };
}

/**
 * Real-time listener untuk koleksi data inventaris barang dari Firestore
 * @param {Function} callback - Menerima array barang inventaris terkini
 * @param {Function} onError - Error callback
 * @returns {Function} Unsubscribe function untuk cleanup
 */
export function subscribeInventory(callback, onError) {
  try {
    const q = query(getInventoryRef(), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const items = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.id !== COUNTER_DOC_ID) {
            items.push({ id: docSnap.id, ...docSnap.data() });
          }
        });
        callback(items);
      },
      (error) => {
        console.warn('Real-time inventory onSnapshot error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Error attaching subscribeInventory listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Mengambil semua data barang dari Firestore (One-time fetch)
 * @returns {Promise<Array>}
 */
export async function getInventoryItems() {
  try {
    const q = query(getInventoryRef(), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.id !== COUNTER_DOC_ID) {
        items.push({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return items;
  } catch (err) {
    console.warn('Failed to fetch inventory from Firestore:', err);
    return [];
  }
}

/**
 * Menambahkan data barang baru ke inventaris
 * @param {object} itemData
 * @param {string} userAuthor
 * @returns {Promise<object>}
 */
export async function addInventoryItem(itemData, userAuthor = 'admin') {
  const { nextCode, nextNumber } = await getNextItemCode();
  const assignedCode = itemData.kodeBarang || nextCode;
  const assignedNumber = itemData.itemNumber || nextNumber;

  const newItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    kodeBarang: assignedCode,
    itemNumber: assignedNumber,
    namaBarang: itemData.namaBarang?.trim() || 'Barang Tanpa Nama',
    kategori: itemData.kategori || 'Baju',
    pemilikBarang: itemData.pemilikBarang?.trim() || 'Akbar',
    hargaModal: Number(itemData.hargaModal) || 0,
    catatan: itemData.catatan?.trim() || '',
    status: itemData.status || 'Belum Terjual',
    referensiTransaksiId: itemData.referensiTransaksiId || null,
    tanggalMasuk: itemData.tanggalMasuk || new Date().toISOString().split('T')[0],
    createdBy: userAuthor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Simpan ke Firestore
  const docRef = doc(db, COLLECTION_NAME, newItem.id);
  await setDoc(docRef, newItem);

  // Update counter
  try {
    const counterDocRef = doc(db, COLLECTION_NAME, COUNTER_DOC_ID);
    await setDoc(
      counterDocRef,
      { lastNumber: assignedNumber, lastCode: assignedCode, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('Counter update warning:', err);
  }

  return newItem;
}

/**
 * Mengupdate data barang
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
export async function updateInventoryItem(id, updateData) {
  const payload = {
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, COLLECTION_NAME, id);
  await setDoc(docRef, payload, { merge: true });
  return { id, ...payload };
}

/**
 * Menandai barang menjadi Terjual dan menyimpan referensi transaksi beserta data pengiriman
 * @param {string} id
 * @param {string} transactionId
 * @param {object} extraData
 * @returns {Promise<void>}
 */
export async function markItemAsSold(id, transactionId, extraData = {}) {
  await updateInventoryItem(id, {
    status: 'Terjual',
    referensiTransaksiId: transactionId || null,
    tanggalTerjual: new Date().toISOString().split('T')[0],
    ...extraData,
  });
}

/**
 * Mengembalikan status barang menjadi Belum Terjual
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function restoreItemToUnsold(id) {
  await updateInventoryItem(id, {
    status: 'Belum Terjual',
    referensiTransaksiId: null,
    tanggalTerjual: null,
    namaPenerima: '',
    noHpPenerima: '',
    alamatPenerima: '',
    resi: '',
  });
}

/**
 * Mengembalikan seluruh barang yang terhubung dengan transaksi ke status Belum Terjual
 * @param {string} transactionId
 * @param {string} [specificItemId]
 * @returns {Promise<void>}
 */
export async function restoreItemsByTransactionRef(transactionId, specificItemId = null) {
  if (specificItemId) {
    try {
      await restoreItemToUnsold(specificItemId);
    } catch (e) {
      console.warn(`Gagal restore barang id ${specificItemId}:`, e);
    }
  }

  if (transactionId) {
    try {
      const snap = await getDocs(getInventoryRef());
      const updates = [];
      snap.forEach((d) => {
        if (d.id === COUNTER_DOC_ID) return;
        const item = d.data();
        if (item.referensiTransaksiId === transactionId) {
          updates.push(restoreItemToUnsold(d.id));
        }
      });
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (err) {
      console.warn('Gagal mencari referensi barang terkait transaksi:', err);
    }
  }
}

/**
 * Menghapus data barang dari inventaris
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteInventoryItem(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
