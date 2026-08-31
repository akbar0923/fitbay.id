const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// In-memory rate limiting storage
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 15;

/**
 * Helper: Cek rate limit sederhana berdasarkan IP / Client identifier
 */
function checkRateLimit(clientId) {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(clientId, clientData);

  // Bersihkan cache map jika terlalu besar
  if (rateLimitMap.size > 2000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  return clientData.count <= MAX_REQUESTS_PER_WINDOW;
}

/**
 * Helper: Masking nomor HP untuk privasi (misal: 085121009699 -> 0851****9699)
 */
function maskPhoneNumber(phone) {
  if (!phone || phone === '-') return '-';
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.length < 7) return clean;
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `${start}****${end}`;
}

/**
 * Cloud Function Publik: Cek Barang & Saldo untuk Penitip (Tanpa Login)
 * Menggunakan Firebase Admin SDK di sisi server sehingga Firestore tetap terkunci rapat
 */
exports.cekBarangPublik = functions.https.onCall(async (data, context) => {
  const clientIp = context.rawRequest ? (context.rawRequest.headers['x-forwarded-for'] || context.rawRequest.ip || 'unknown') : 'unknown';

  // 1. Rate Limiting Protection
  if (!checkRateLimit(clientIp)) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Terlalu banyak permintaan pencarian. Mohon tunggu 1 menit sebelum mencoba lagi.'
    );
  }

  const queryInput = (data?.query || '').trim();
  if (!queryInput || queryInput.length < 2) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Kata kunci pencarian minimal 2 karakter.'
    );
  }

  const cleanQueryLower = queryInput.toLowerCase();
  const cleanDigitsQuery = queryInput.replace(/\D/g, '');

  try {
    // 2. Cari data pemilik di koleksi 'owners'
    const ownersSnap = await db.collection('owners').get();
    let matchedOwner = null;

    for (const docSnap of ownersSnap.docs) {
      const oData = docSnap.data();
      const oName = (oData.name || '').trim().toLowerCase();
      const oPhoneDigits = (oData.phone || '').replace(/\D/g, '');

      // Cek kecocokan Nama persis / nama mengandung kata kunci
      const nameMatches = oName === cleanQueryLower || oName.includes(cleanQueryLower);
      
      // Cek kecocokan No. HP (minimal 4 digit angka yang cocok)
      const phoneMatches = cleanDigitsQuery.length >= 4 && oPhoneDigits.length >= 4 && (
        oPhoneDigits === cleanDigitsQuery ||
        oPhoneDigits.includes(cleanDigitsQuery) ||
        cleanDigitsQuery.includes(oPhoneDigits)
      );

      if (nameMatches || phoneMatches) {
        matchedOwner = { id: docSnap.id, ...oData };
        break;
      }
    }

    if (!matchedOwner) {
      return {
        found: false,
        message: `Data penitip dengan kata kunci "${queryInput}" tidak ditemukan. Pastikan Nama atau Nomor Handphone sesuai dengan yang terdaftar.`,
      };
    }

    const ownerTargetName = (matchedOwner.name || '').trim();

    // 3. Ambil data barang inventaris milik pemilik dari Firestore (Hanya field yang aman untuk publik)
    const inventorySnap = await db.collection('inventory').get();
    const ownerItems = [];

    inventorySnap.forEach((docSnap) => {
      if (docSnap.id === '__inventory_counter__') return;
      const item = docSnap.data();
      const itemOwner = (item.pemilikBarang || '').trim().toLowerCase();

      if (itemOwner === ownerTargetName.toLowerCase()) {
        // HANYA field publik yang dikembalikan (sensitif seperti hargaModal, catatan internal, & data buyer TIDAK disertakan)
        ownerItems.push({
          id: docSnap.id,
          kodeBarang: item.kodeBarang || '-',
          namaBarang: item.namaBarang || 'Barang Tanpa Nama',
          kategori: item.kategori || 'Baju',
          status: item.status || 'Belum Terjual',
          tanggalMasuk: item.tanggalMasuk || '-',
          tanggalTerjual: item.tanggalTerjual || null,
        });
      }
    });

    // Urutkan barang: Belum Terjual lebih dulu, lalu berdasarkan tanggal masuk
    ownerItems.sort((a, b) => {
      if (a.status === 'Belum Terjual' && b.status !== 'Belum Terjual') return -1;
      if (a.status !== 'Belum Terjual' && b.status === 'Belum Terjual') return 1;
      return (b.tanggalMasuk || '').localeCompare(a.tanggalMasuk || '');
    });

    // 4. Ambil data penarikan saldo milik pemilik (jika ada)
    const withdrawalsSnap = await db.collection('withdrawals').get();
    const ownerWithdrawals = [];
    let totalWithdrawn = 0;

    withdrawalsSnap.forEach((docSnap) => {
      const w = docSnap.data();
      const wOwner = (w.ownerName || '').trim().toLowerCase();
      const wKey = (w.recipientKey || '').trim().toLowerCase();

      if (
        wOwner === ownerTargetName.toLowerCase() ||
        wKey === `owner_${ownerTargetName.toLowerCase()}` ||
        wKey === ownerTargetName.toLowerCase()
      ) {
        const nominal = Number(w.amount) || 0;
        totalWithdrawn += nominal;
        ownerWithdrawals.push({
          id: docSnap.id,
          date: w.date || '-',
          amount: nominal,
          notes: w.notes || 'Pencairan Saldo',
        });
      }
    });

    // 5. Response bersih & aman
    const readyCount = ownerItems.filter((i) => i.status === 'Belum Terjual').length;
    const soldCount = ownerItems.filter((i) => i.status === 'Terjual').length;

    return {
      found: true,
      owner: {
        id: matchedOwner.id,
        name: matchedOwner.name,
        phoneMasked: maskPhoneNumber(matchedOwner.phone),
      },
      stats: {
        totalItems: ownerItems.length,
        readyCount,
        soldCount,
        totalWithdrawn,
      },
      items: ownerItems,
      withdrawals: ownerWithdrawals,
    };
  } catch (err) {
    console.error('Error in cekBarangPublik Cloud Function:', err);
    throw new functions.https.HttpsError('internal', 'Gagal memproses pencarian barang. Silakan coba beberapa saat lagi.');
  }
});

/**
 * Cloud Function: Tambah User Baru oleh Super Admin
 */
exports.createUserByAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Wajib login.');
  }

  // Verifikasi role caller di Firestore
  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || !['admin', 'superadmin'].includes(callerDoc.data().role)) {
    throw new functions.https.HttpsError('permission-denied', 'Hanya Admin/Super Admin yang diizinkan.');
  }

  const { name, username, password, role, title } = data;
  const cleanUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  
  if (!cleanUsername) {
    throw new functions.https.HttpsError('invalid-argument', 'Username wajib diisi.');
  }

  if (!password || password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password minimal 6 karakter.');
  }

  const emailDomain = process.env.VITE_AUTH_EMAIL_DOMAIN || 'fitbay.id';
  const email = `${cleanUsername}@${emailDomain}`;

  try {
    // 1. Buat user di Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name || cleanUsername,
    });

    // 2. Buat dokumen profil di Firestore
    const userProfile = {
      name: name.trim(),
      username: cleanUsername,
      email: email,
      role: role || 'staff',
      title: title?.trim() || (role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Staff Fitbay'),
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: context.auth.token.email || 'superadmin',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userRecord.uid).set(userProfile);

    return {
      success: true,
      uid: userRecord.uid,
      user: userProfile,
    };
  } catch (error) {
    console.error('Error creating user by admin:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
