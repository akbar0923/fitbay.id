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
 * Mengambil daftar testimoni publik yang sudah disetujui admin serta statistik transaksi real-time
 * @returns {Promise<{testimonials: Array, stats: object}>}
 */
export async function getPublicTestimonialsAndStats() {
  let testimonials = [];
  let stats = {
    totalBarangTerjual: 0,
    totalPembeliUnik: 0,
    averageRating: '5.0',
    totalTestimoni: 0,
    persentasePuas: 100,
  };

  // 1. Coba panggil endpoint serverless /api/testimonials (menghitung data objektif real-time dari Firestore via Admin SDK)
  try {
    const res = await fetch('/api/testimonials');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.testimonials)) {
        testimonials = json.testimonials.filter((t) => t.isiTestimoni && t.isiTestimoni.trim().length >= 5);
        if (json.stats) {
          stats = json.stats;
        }
        return { testimonials, stats };
      }
    }
  } catch (apiErr) {
    console.warn('Query /api/testimonials gagal, fallback ke Client SDK:', apiErr);
  }

  // 2. Fallback ke Client SDK
  try {
    const q = query(
      getTestimonialsRef(),
      where('status', '==', 'disetujui')
    );
    const snap = await getDocs(q);
    testimonials = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => t.isiTestimoni && t.isiTestimoni.trim().length >= 5);

    testimonials.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.tanggal || 0).getTime();
      const timeB = new Date(b.createdAt || b.tanggal || 0).getTime();
      return timeB - timeA;
    });

    const total = testimonials.length;
    let sumRating = 0;
    let count5 = 0;
    testimonials.forEach((t) => {
      const r = Number(t.rating) || 5;
      sumRating += r;
      if (r >= 5) count5 += 1;
    });

    stats = {
      totalBarangTerjual: total,
      totalPembeliUnik: total,
      averageRating: total > 0 ? (sumRating / total).toFixed(1) : '5.0',
      totalTestimoni: total,
      persentasePuas: total > 0 ? Math.round((count5 / total) * 100) : 100,
    };
  } catch (firestoreErr) {
    console.warn('Fallback client SDK testimonials gagal:', firestoreErr);
  }

  return { testimonials, stats };
}

/**
 * Mengambil daftar testimoni publik yang sudah disetujui admin
 * @returns {Promise<Array>}
 */
export async function getPublicTestimonials() {
  const res = await getPublicTestimonialsAndStats();
  return res.testimonials;
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
  referensiTransaksiId = '',
}) {
  const cleanNama = (namaPembeli || '').trim().slice(0, 50);
  const cleanIsi = (isiTestimoni || '').trim().slice(0, 500);
  const cleanRating = parseInt(Math.min(5, Math.max(1, Math.round(Number(rating) || 5))), 10);
  const cleanBarang = (namaBarang || '').trim().slice(0, 100);
  const cleanRef = (referensiTransaksiId || '').trim().slice(0, 100);
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
    referensiTransaksiId: cleanRef,
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
    if (cleanRef) {
      newDoc.referensiTransaksiId = cleanRef;
    }

    try {
      const docRef = await addDoc(getTestimonialsRef(), newDoc);
      return { id: docRef.id, ...newDoc };
    } catch (innerErr) {
      // Jika error karena rules belum mengizinkan referensiTransaksiId (hasOnly violation), coba kirim tanpa referensiTransaksiId
      if (cleanRef && (innerErr.code === 'permission-denied' || innerErr.message?.includes('permission'))) {
        console.warn('addDoc dengan referensiTransaksiId ditolak rules, mencoba kirim ulang tanpa referensiTransaksiId...');
        delete newDoc.referensiTransaksiId;
        const fallbackDocRef = await addDoc(getTestimonialsRef(), newDoc);
        return { id: fallbackDocRef.id, ...newDoc };
      }
      throw innerErr;
    }
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

/**
 * Membuat dokumen placeholder testimoni otomatis dari transaksi yang berstatus 'Terjual'
 * Status placeholder: 'menunggu_diisi'
 * Tidak akan ditampilkan di publik sampai pembeli mengisi atau admin melengkapi
 * @param {object} tx - Transaksi penjualan
 * @returns {Promise<object|null>}
 */
export async function createPlaceholderTestimonial(tx) {
  if (!tx || !tx.id) return null;
  if (tx.status !== 'Terjual') return null;

  try {
    // 1. Cek apakah sudah ada testimoni (placeholder ataupun terisi) untuk transaksi ini
    const q = query(
      getTestimonialsRef(),
      where('referensiTransaksiId', '==', tx.id)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Sudah ada testimoni/placeholder terkait transaksi ini
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    // Juga cek by kodeTestimoni jika ada
    if (tx.kodeTestimoni) {
      const qKode = query(
        getTestimonialsRef(),
        where('kodeTestimoni', '==', tx.kodeTestimoni)
      );
      const snapKode = await getDocs(qKode);
      if (!snapKode.empty) {
        return { id: snapKode.docs[0].id, ...snapKode.docs[0].data() };
      }
    }

    const now = new Date();
    const shortId = (tx.id || '').replace(/\D/g, '').slice(-4) || '88';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const kode = tx.kodeTestimoni || `TESTI-${shortId}${rand}`;

    const placeholderDoc = {
      namaPembeli: (tx.namaPenerima || 'Pelanggan').trim(),
      namaBarang: (tx.itemName || 'Barang Preloved').trim(),
      referensiTransaksiId: tx.id,
      kodeTestimoni: kode,
      noHp: tx.noHpPenerima || '',
      tanggalTransaksi: tx.date || now.toISOString().split('T')[0],
      tanggal: tx.date || now.toISOString().split('T')[0],
      isiTestimoni: '', // Kosong karena belum ada ulasan asli
      rating: 0, // 0 menandakan belum ada rating
      fotoUrl: '',
      sumber: 'transaksi',
      status: 'menunggu_diisi', // Status khusus placeholder
      catatanInternal: `Dibuat otomatis dari transaksi ${tx.id}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const docRef = await addDoc(getTestimonialsRef(), placeholderDoc);
    return { id: docRef.id, ...placeholderDoc };
  } catch (err) {
    console.warn('Gagal membuat placeholder testimoni otomatis:', err);
    return null;
  }
}

/**
 * Memindai seluruh transaksi berstatus 'Terjual' dan membuat placeholder jika belum ada
 * Berguna untuk sinkronisasi transaksi lama yang belum ada placeholder-nya
 * @param {Array} transactions
 * @returns {Promise<number>} Jumlah placeholder baru yang berhasil dibuat
 */
export async function syncPlaceholderTestimonialsFromSales(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) return 0;

  const soldTransactions = transactions.filter((tx) => tx.status === 'Terjual');
  if (soldTransactions.length === 0) return 0;

  // Ambil semua testimoni yang ada saat ini
  let existingRefIds = new Set();
  let existingKodes = new Set();

  try {
    const snap = await getDocs(getTestimonialsRef());
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.referensiTransaksiId) existingRefIds.add(data.referensiTransaksiId);
      if (data.kodeTestimoni) existingKodes.add(data.kodeTestimoni);
    });
  } catch (e) {
    console.warn('Gagal membaca daftar testimoni yang ada:', e);
  }

  let createdCount = 0;
  for (const tx of soldTransactions) {
    if (existingRefIds.has(tx.id) || (tx.kodeTestimoni && existingKodes.has(tx.kodeTestimoni))) {
      continue;
    }

    try {
      const res = await createPlaceholderTestimonial(tx);
      if (res) {
        existingRefIds.add(tx.id);
        if (res.kodeTestimoni) existingKodes.add(res.kodeTestimoni);
        createdCount += 1;
      }
    } catch (e) {
      console.warn(`Gagal sync placeholder untuk tx ${tx.id}:`, e);
    }
  }

  return createdCount;
}

/**
 * Melengkapi dokumen placeholder testimoni secara manual oleh Admin
 * Mengubah status placeholder dari 'menunggu_diisi' menjadi 'disetujui' atau 'menunggu'
 * @param {string} id
 * @param {object} payload - { namaPembeli, namaBarang, isiTestimoni, rating, fotoUrl, status, tanggal }
 */
export async function completePlaceholderTestimonial(id, payload) {
  const docRef = doc(db, COLLECTION_NAME, id);
  const now = new Date().toISOString();

  const updateData = {
    ...payload,
    isiTestimoni: (payload.isiTestimoni || '').trim(),
    rating: Math.min(5, Math.max(1, Math.round(Number(payload.rating) || 5))),
    status: payload.status || 'disetujui',
    sumber: payload.sumber || 'manual',
    updatedAt: now,
  };

  await updateDoc(docRef, updateData);
  return { id, ...updateData };
}

