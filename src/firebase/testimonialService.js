import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const COLLECTION_NAME = 'testimonials';

function getTestimonialsRef() {
  return collection(db, COLLECTION_NAME);
}

/**
 * Mengambil daftar testimoni publik yang sudah disetujui admin
 * Dilengkapi fallback client-side sort jika composite index Firestore belum dibuat.
 * @returns {Promise<Array>}
 */
export async function getPublicTestimonials() {
  try {
    // Coba query dengan orderBy
    try {
      const q = query(
        getTestimonialsRef(),
        where('status', '==', 'disetujui'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (orderErr) {
      console.warn('Query dengan orderBy perlu index atau gagal, fallback ke filter status + client sort:', orderErr);
      const qFallback = query(
        getTestimonialsRef(),
        where('status', '==', 'disetujui')
      );
      const snapFallback = await getDocs(qFallback);
      const items = snapFallback.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Client-side sort terbaru ke terlama
      return items.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.tanggal || 0).getTime();
        const timeB = new Date(b.createdAt || b.tanggal || 0).getTime();
        return timeB - timeA;
      });
    }
  } catch (error) {
    console.error('Error fetching public testimonials:', error);
    throw error;
  }
}

/**
 * Real-time listener untuk Admin (menampilkan semua status: menunggu, disetujui, ditolak)
 * @param {Function} callback
 * @param {Function} onError
 * @returns {Function} Unsubscribe function
 */
export function subscribeAdminTestimonials(callback, onError) {
  try {
    const q = query(getTestimonialsRef());
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Urutkan dari yang terbaru
        items.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.tanggal || 0).getTime();
          const timeB = new Date(b.createdAt || b.tanggal || 0).getTime();
          return timeB - timeA;
        });
        callback(items);
      },
      (error) => {
        console.warn('Real-time admin testimonials onSnapshot error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Error attaching subscribeAdminTestimonials listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Mengirim ulasan dari publik (Unauthenticated)
 * Wajib: status='menunggu', sumber='publik'
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function submitPublicTestimonial({
  namaPembeli,
  isiTestimoni,
  rating,
  namaBarang = '',
  fotoUrl = '',
}) {
  const cleanNama = (namaPembeli || '').trim().slice(0, 50);
  const cleanIsi = (isiTestimoni || '').trim().slice(0, 500);
  const cleanRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
  const cleanBarang = (namaBarang || '').trim().slice(0, 100);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  if (!cleanNama || cleanNama.length < 2) {
    throw new Error('Nama pembeli minimal 2 karakter.');
  }
  if (!cleanIsi || cleanIsi.length < 5) {
    throw new Error('Isi ulasan minimal 5 karakter.');
  }

  const newDoc = {
    namaPembeli: cleanNama,
    isiTestimoni: cleanIsi,
    rating: cleanRating,
    namaBarang: cleanBarang,
    fotoUrl: fotoUrl || '',
    tanggal: dateStr,
    sumber: 'publik',
    status: 'menunggu', // Wajib menunggu persetujuan
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const docRef = await addDoc(getTestimonialsRef(), newDoc);
  return { id: docRef.id, ...newDoc };
}

/**
 * Menambahkan ulasan manual oleh Admin (WhatsApp, Instagram, Offline, dsb)
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function createAdminTestimonial({
  namaPembeli,
  isiTestimoni,
  rating = 5,
  namaBarang = '',
  fotoUrl = '',
  tanggal = '',
  status = 'disetujui',
  sumber = 'manual',
  catatanInternal = '',
}) {
  const now = new Date();
  const cleanDate = tanggal || now.toISOString().split('T')[0];

  const newDoc = {
    namaPembeli: (namaPembeli || '').trim(),
    isiTestimoni: (isiTestimoni || '').trim(),
    rating: Math.min(5, Math.max(1, Math.round(Number(rating) || 5))),
    namaBarang: (namaBarang || '').trim(),
    fotoUrl: fotoUrl || '',
    tanggal: cleanDate,
    sumber: sumber || 'manual',
    status: status || 'disetujui',
    catatanInternal: (catatanInternal || '').trim(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const docRef = await addDoc(getTestimonialsRef(), newDoc);
  return { id: docRef.id, ...newDoc };
}

/**
 * Mengupdate status testimoni (disetujui, ditolak, menunggu)
 * @param {string} id
 * @param {string} newStatus - 'disetujui' | 'ditolak' | 'menunggu'
 */
export async function updateTestimonialStatus(id, newStatus) {
  const validStatuses = ['disetujui', 'ditolak', 'menunggu'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Status tidak valid: ${newStatus}`);
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: now,
  });
}

/**
 * Mengupdate seluruh data testimoni oleh Admin
 * @param {string} id
 * @param {object} data
 */
export async function updateTestimonialDoc(id, data) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const { id: _, ...rest } = data;
  const updateData = {
    ...rest,
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(docRef, updateData);
  return { id, ...updateData };
}

/**
 * Menghapus testimoni secara permanen oleh Admin
 * @param {string} id
 */
export async function deleteTestimonialDoc(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
