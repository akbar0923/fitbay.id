import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// In-memory rate limiting di instance serverless
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 15;

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

/**
 * Inisialisasi Firebase Admin SDK secara aman dari Environment Variables
 */
function getAdminDb() {
  const apps = getApps();
  if (apps && apps.length > 0) {
    return getFirestore(apps[0]);
  }

  let credential = null;
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (rawEnv) {
    try {
      let raw = rawEnv.trim();
      if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
        raw = raw.slice(1, -1).trim();
      }

      let serviceAccount;
      if (raw.startsWith('{')) {
        serviceAccount = JSON.parse(raw);
      } else {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      }

      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      credential = cert(serviceAccount);
    } catch (e) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', e);
      throw new Error(`Format FIREBASE_SERVICE_ACCOUNT tidak valid: ${e.message}`);
    }
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      });
    } catch (e) {
      console.error('Error in individual env vars:', e);
      throw new Error(`Kredensial individual tidak valid: ${e.message}`);
    }
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT belum diset di Vercel Environment Variables.');
  }

  const app = initializeApp({
    credential,
    projectId: 'fitbayid',
  });

  return getFirestore(app);
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
      message: 'Terlalu banyak permintaan. Mohon tunggu 1 menit sebelum mencoba lagi.',
    });
  }

  // 2. GET: Mengambil testimoni berstatus disetujui untuk publik
  if (req.method === 'GET') {
    try {
      const db = getAdminDb();
      const snapshot = await db
        .collection('testimonials')
        .where('status', '==', 'disetujui')
        .get();

      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Urutkan terbaru ke terlama
      items.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.tanggal || 0).getTime();
        const timeB = new Date(b.createdAt || b.tanggal || 0).getTime();
        return timeB - timeA;
      });

      return res.status(200).json({
        success: true,
        testimonials: items,
      });
    } catch (err) {
      console.error('Error fetching testimonials via Admin SDK:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Gagal memuat testimoni.',
      });
    }
  }

  // 3. POST: Mengirim ulasan publik baru
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // Honeypot check
      if (body.honeypot) {
        return res.status(200).json({ success: true, message: 'OK' });
      }

      const nama = (body.namaPembeli || '').trim().slice(0, 50);
      const isi = (body.isiTestimoni || '').trim().slice(0, 500);
      const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 5)));
      const barang = (body.namaBarang || '').trim().slice(0, 100);
      const fotoUrl = body.fotoUrl || '';

      if (!nama || nama.length < 2) {
        return res.status(400).json({ success: false, message: 'Nama pembeli minimal 2 karakter.' });
      }
      if (!isi || isi.length < 5) {
        return res.status(400).json({ success: false, message: 'Isi ulasan minimal 5 karakter.' });
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      const newDoc = {
        namaPembeli: nama,
        isiTestimoni: isi,
        rating: rating,
        tanggal: dateStr,
        sumber: 'publik',
        status: 'menunggu',
      };

      const db = getAdminDb();
      const docRef = await db.collection('testimonials').add(newDoc);

      return res.status(201).json({
        success: true,
        id: docRef.id,
        message: 'Testimoni berhasil dikirim dan menunggu persetujuan admin.',
        data: { id: docRef.id, ...newDoc },
      });
    } catch (err) {
      console.error('Error saving testimonial via Admin SDK:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Gagal menyimpan ulasan di server.',
      });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
