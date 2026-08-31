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
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const COLLECTION_NAME = 'inventory';
const COUNTER_DOC_ID = '__inventory_counter__';
const LOCAL_STORAGE_KEY = 'fitbay_inventory_cache';

// Data bawaan awal jika inventaris masih baru/kosong
const INITIAL_SAMPLE_ITEMS = [
  {
    id: 'sample_fb_0001',
    kodeBarang: 'FB-0001',
    itemNumber: 1,
    namaBarang: 'Nike Air Force 1 Low Triple White',
    kategori: 'Sepatu',
    pemilikBarang: 'Akbar',
    hargaModal: 450000,
    catatan: 'Size 42, Kondisi 9/10, Box Lengkap',
    status: 'Belum Terjual',
    referensiTransaksiId: null,
    tanggalMasuk: '2026-08-20',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample_fb_0002',
    kodeBarang: 'FB-0002',
    itemNumber: 2,
    namaBarang: 'Vintage Stussy World Tour Hoodie',
    kategori: 'Jaket',
    pemilikBarang: 'Nessa',
    hargaModal: 250000,
    catatan: 'Size L, Warna Hitam Pekat, No Defect',
    status: 'Belum Terjual',
    referensiTransaksiId: null,
    tanggalMasuk: '2026-08-22',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample_fb_0003',
    kodeBarang: 'FB-0003',
    itemNumber: 3,
    namaBarang: 'Uniqlo Kando Pants Slim Fit',
    kategori: 'Celana',
    pemilikBarang: 'Andin',
    hargaModal: 120000,
    catatan: 'Size 32, Warna Abu-abu Tua',
    status: 'Belum Terjual',
    referensiTransaksiId: null,
    tanggalMasuk: '2026-08-25',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample_fb_0004',
    kodeBarang: 'FB-0004',
    itemNumber: 4,
    namaBarang: 'Carhartt WIP Pocket Tee Black',
    kategori: 'Baju',
    pemilikBarang: 'Ritza',
    hargaModal: 150000,
    catatan: 'Size M Oversized, Like New',
    status: 'Belum Terjual',
    referensiTransaksiId: null,
    tanggalMasuk: '2026-08-28',
    createdAt: new Date().toISOString(),
  },
];

function getInventoryRef() {
  return collection(db, COLLECTION_NAME);
}

export function getLocalInventory() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading local inventory:', e);
  }
  return INITIAL_SAMPLE_ITEMS;
}

export function saveLocalInventory(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Error saving local inventory:', e);
  }
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
 * Generate kode barang berikutnya secara aman dari duplikasi
 * @returns {Promise<{ nextCode: string, nextNumber: number }>}
 */
export async function getNextItemCode() {
  const localItems = getLocalInventory();
  let highestNum = 0;

  localItems.forEach((item) => {
    const num = item.itemNumber || parseItemCodeNumber(item.kodeBarang);
    if (num > highestNum) highestNum = num;
  });

  try {
    const counterDocRef = doc(db, COLLECTION_NAME, COUNTER_DOC_ID);
    const counterSnap = await getDoc(counterDocRef);

    if (counterSnap.exists()) {
      const cloudNum = counterSnap.data().lastNumber || 0;
      highestNum = Math.max(highestNum, cloudNum);
    }
  } catch (err) {
    console.warn('Firestore counter read failed, using local max:', err);
  }

  const nextNumber = highestNum + 1;
  return {
    nextCode: formatItemCode(nextNumber),
    nextNumber,
  };
}

/**
 * Mengambil semua data barang dari Firestore / Local Cache
 * @returns {Promise<Array>}
 */
export async function getInventoryItems() {
  try {
    const q = query(getInventoryRef(), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const initial = getLocalInventory();
      return initial;
    }

    const items = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.id !== COUNTER_DOC_ID) {
        items.push({ id: docSnap.id, ...docSnap.data() });
      }
    });

    saveLocalInventory(items);
    return items;
  } catch (err) {
    console.warn('Failed to fetch inventory from Firestore, using local cache:', err);
    return getLocalInventory();
  }
}

/**
 * Real-time listener untuk data inventaris
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeInventory(callback) {
  try {
    const q = query(getInventoryRef(), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          callback(getLocalInventory());
          return;
        }
        const items = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.id !== COUNTER_DOC_ID) {
            items.push({ id: docSnap.id, ...docSnap.data() });
          }
        });
        saveLocalInventory(items);
        callback(items);
      },
      (error) => {
        console.warn('Inventory onSnapshot error (fallback to local cache):', error);
        callback(getLocalInventory());
      }
    );
  } catch (e) {
    console.warn('Could not set up onSnapshot for inventory:', e);
    callback(getLocalInventory());
    return () => {};
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

  // Simpan ke local cache terlebih dahulu
  const current = getLocalInventory();
  const updated = [newItem, ...current];
  saveLocalInventory(updated);

  // Simpan ke Firestore
  try {
    const docRef = doc(db, COLLECTION_NAME, newItem.id);
    await setDoc(docRef, newItem);

    // Update counter
    const counterDocRef = doc(db, COLLECTION_NAME, COUNTER_DOC_ID);
    await setDoc(
      counterDocRef,
      { lastNumber: assignedNumber, lastCode: assignedCode, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore setDoc for inventory failed (using local cache backup):', err);
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
  const current = getLocalInventory();
  const updated = current.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
  saveLocalInventory(updated);

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await setDoc(
      docRef,
      {
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore setDoc for inventory failed:', err);
  }

  return updated.find((i) => i.id === id);
}

/**
 * Menandai barang menjadi Terjual dan menyimpan referensi transaksi
 * @param {string} id
 * @param {string} transactionId
 * @returns {Promise<void>}
 */
export async function markItemAsSold(id, transactionId) {
  await updateInventoryItem(id, {
    status: 'Terjual',
    referensiTransaksiId: transactionId || null,
    tanggalTerjual: new Date().toISOString().split('T')[0],
  });
}

/**
 * Mengembalikan status barang menjadi Belum Terjual (misal jika transaksi penjualan dihapus)
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function restoreItemToUnsold(id) {
  await updateInventoryItem(id, {
    status: 'Belum Terjual',
    referensiTransaksiId: null,
    tanggalTerjual: null,
  });
}

/**
 * Menghapus data barang dari inventaris
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteInventoryItem(id) {
  const current = getLocalInventory();
  const updated = current.filter((item) => item.id !== id);
  saveLocalInventory(updated);

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteDoc for inventory failed:', err);
  }
}
