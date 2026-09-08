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
 * Mendukung query langsung Firestore dengan fallback otomatis ke /api/testimonials
 * @returns {Promise<Array>}
 */
export async function getPublicTestimonials() {
  try {
    // 1. Coba query Firestore Client SDK dengan orderBy
    try {
      const q = query(
        getTestimonialsRef(),
        where('status', '==', 'disetujui'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (orderErr) {
      console.warn('Query dengan orderBy gagal, coba filter status sederhana:', orderErr);
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
  } catch (firestoreErr) {
    console.warn('Query Firestore langsung gagal (kemungkinan rules belum di-publish), fallback ke /api/testimonials:', firestoreErr);

    // 2. Fallback ke endpoint serverless Vercel /api/testimonials
    try {
      const res = await fetch('/api/testimonials');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.testimonials)) {
          return json.testimonials;
        }
      }
    } catch (apiErr) {
      console.warn('Fallback ke /api/testimonials juga gagal:', apiErr);
    }

    throw new Error('Gagal memuat daftar testimoni. Pastikan aturan keamanan Firestore sudah diperbarui di Firebase Console.');
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
 * Mendukung pengiriman melalui /api/testimonials (Firebase Admin SDK di server Vercel)
 * dengan fallback ke client-side Firestore addDoc.
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function submitPublicTestimonial({
  namaPembeli,
  isiTestimoni,
  rating,
  namaBarang = '',
  fotoUrl = '',
  honeypot = '',
}) {
  const cleanNama = (namaPembeli || '').trim().slice(0, 50);
  const cleanIsi = (isiTestimoni || '').trim().slice(0, 500);
  const cleanRating = parseInt(Math.min(5, Math.max(1, Math.round(Number(rating) || 5))), 10);
  const cleanBarang = (namaBarang || '').trim().slice(0, 100);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  if (!cleanNama || cleanNama.length < 2) {
    throw new Error('Nama pembeli minimal 2 karakter.');
  }
  if (!cleanIsi || cleanIsi.length < 10) {
    throw new Error('Isi ulasan minimal 10 karakter.');
  }

  const payload = {
    namaPembeli: cleanNama,
    isiTestimoni: cleanIsi,
    rating: cleanRating,
    namaBarang: cleanBarang,
    fotoUrl: fotoUrl || '',
    honeypot: honeypot || '',
  };

  // 1. Coba kirim via Serverless API /api/testimonials terlebih dahulu (Bypass client rules via Admin SDK)
  try {
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else if (res.status === 400 || res.status === 429) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.message || 'Gagal mengirim testimoni.');
    }
  } catch (apiErr) {
    // Jika ada error spesifik dari validasi / rate limit di serverless, teruskan errornya
    if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('404')) {
      throw apiErr;
    }
    console.warn('Kirim via /api/testimonials gagal atau tidak tersedia (misal di localhost), fallback ke client Firestore SDK:', apiErr);
  }

  // 2. Fallback ke Direct Client Firestore addDoc
  try {
    const newDoc = {
      namaPembeli: cleanNama,
      isiTestimoni: cleanIsi,
      rating: parseInt(cleanRating, 10),
      status: 'menunggu',
      sumber: 'publik',
      tanggal: dateStr,
    };

    const docRef = await addDoc(getTestimonialsRef(), newDoc);
    return { id: docRef.id, ...newDoc };
  } catch (firestoreErr) {
    console.error('Error direct client addDoc:', firestoreErr);
    if (firestoreErr.code === 'permission-denied' || firestoreErr.message?.includes('permission')) {
      throw new Error(
        'Izin pengiriman ulasan ditolak oleh database. Pastikan Firestore Security Rules sudah dipublikasikan di Firebase Console.'
      );
    }
    throw new Error(firestoreErr.message || 'Gagal mengirim ulasan ke database.');
  }
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

  try {
    const docRef = await addDoc(getTestimonialsRef(), newDoc);
    return { id: docRef.id, ...newDoc };
  } catch (err) {
    console.error('Error createAdminTestimonial:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permission')) {
      throw new Error(
        'Izin ditolak oleh Firestore. Pastikan Firestore Security Rules sudah dipublikasikan di Firebase Console untuk role admin.'
      );
    }
    throw err;
  }
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
