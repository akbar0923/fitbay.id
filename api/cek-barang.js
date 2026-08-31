import admin from 'firebase-admin';

// In-memory rate limiting storage di serverless instance
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(clientIp) {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIp) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(clientIp, clientData);

  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  return clientData.count <= MAX_REQUESTS_PER_WINDOW;
}

function maskPhoneNumber(phone) {
  if (!phone || phone === '-') return '-';
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.length < 7) return clean;
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `${start}****${end}`;
}

/**
 * Inisialisasi Firebase Admin SDK secara aman dari Environment Variables
 */
function getAdminDb() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let credential = null;

  // 1. Cek dari FIREBASE_SERVICE_ACCOUNT (JSON String atau Base64)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(jsonStr);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.warn('Gagal mem-parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
    }
  }

  // 2. Cek dari variabel terpisah
  if (!credential && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      });
    } catch (e) {
      console.warn('Gagal inisialisasi credential dari env individual:', e.message);
    }
  }

  if (credential) {
    admin.initializeApp({ credential });
  } else {
    // Fallback default credentials jika berjalan di GCP / Google Cloud environment
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }

  return admin.firestore();
}

export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

  // 1. Rate Limiting
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      found: false,
      message: 'Terlalu banyak permintaan. Mohon tunggu 1 menit sebelum mencoba lagi.',
    });
  }

  // Ekstrak query dari Body (POST) atau Query String (GET)
  const queryInput = (req.body?.query || req.query?.query || '').trim();

  if (!queryInput || queryInput.length < 2) {
    return res.status(400).json({
      success: false,
      found: false,
      message: 'Kata kunci pencarian minimal 2 karakter.',
    });
  }

  try {
    const db = getAdminDb();
    const cleanQueryLower = queryInput.toLowerCase();
    const cleanDigitsQuery = queryInput.replace(/\D/g, '');

    // 2. Cari pemilik di koleksi 'owners'
    const ownersSnap = await db.collection('owners').get();
    let matchedOwner = null;

    for (const docSnap of ownersSnap.docs) {
      const oData = docSnap.data();
      const oName = (oData.name || '').trim().toLowerCase();
      const oPhoneDigits = (oData.phone || '').replace(/\D/g, '');

      const nameMatches = oName === cleanQueryLower || oName.includes(cleanQueryLower);
      const phoneMatches =
        cleanDigitsQuery.length >= 4 &&
        oPhoneDigits.length >= 4 &&
        (oPhoneDigits === cleanDigitsQuery ||
          oPhoneDigits.includes(cleanDigitsQuery) ||
          cleanDigitsQuery.includes(oPhoneDigits));

      if (nameMatches || phoneMatches) {
        matchedOwner = { id: docSnap.id, ...oData };
        break;
      }
    }

    if (!matchedOwner) {
      return res.status(200).json({
        success: true,
        found: false,
        message: `Data penitip dengan kata kunci "${queryInput}" tidak ditemukan. Pastikan Nama atau Nomor Handphone sesuai dengan yang terdaftar.`,
      });
    }

    const ownerTargetName = (matchedOwner.name || '').trim();

    // 3. Ambil data inventaris barang penitip (Sanitasi Total: Tanpa field sensitif internal)
    const inventorySnap = await db.collection('inventory').get();
    const ownerItems = [];

    inventorySnap.forEach((docSnap) => {
      if (docSnap.id === '__inventory_counter__') return;
      const item = docSnap.data();
      const itemOwner = (item.pemilikBarang || '').trim().toLowerCase();

      if (itemOwner === ownerTargetName.toLowerCase()) {
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

    ownerItems.sort((a, b) => {
      if (a.status === 'Belum Terjual' && b.status !== 'Belum Terjual') return -1;
      if (a.status !== 'Belum Terjual' && b.status === 'Belum Terjual') return 1;
      return (b.tanggalMasuk || '').localeCompare(a.tanggalMasuk || '');
    });

    // 4. Ambil data pencairan saldo penitip (jika ada)
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

    const readyCount = ownerItems.filter((i) => i.status === 'Belum Terjual').length;
    const soldCount = ownerItems.filter((i) => i.status === 'Terjual').length;

    return res.status(200).json({
      success: true,
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
    });
  } catch (error) {
    console.error('Error in /api/cek-barang serverless function:', error);
    return res.status(500).json({
      success: false,
      found: false,
      message: 'Gagal memproses pencarian barang di server. Periksa konfigurasi kredensial Firebase Service Account.',
      error: error.message,
    });
  }
}
