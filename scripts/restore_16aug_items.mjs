import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('c:/Users/muhba/Downloads/Fitbay.id/.env', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.*)'/s);
const sa = JSON.parse(match[1]);
const app = initializeApp({ credential: cert(sa) }, 'restore_16aug');
const db = getFirestore(app);

async function restore() {
  console.log('=== MEMULIHKAN 2 TRANSAKSI TANGGAL 16 AGUSTUS 2026 ===\n');

  const now = new Date().toISOString();

  // 1. Pulihkan Item 1 (yWlTzUW1fudZxNJzXbSG) -> Ritza, Crop, Rp 10.000
  const item1Id = 'yWlTzUW1fudZxNJzXbSG';
  const item1Payload = {
    itemName: 'Crop',
    ownerName: 'Ritza',
    category: 'Baju',
    date: '2026-08-16',
    sellingPrice: 10000,
    costPrice: 0,
    profit: 10000,
    profitSharing: {
      pemilikBarang: 10000,
      operational: 0,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
    skemaCustom: {
      pemilikBarang: 100,
      operational: 0,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
    ownerCustomScheme: {
      pemilikBarang: 100,
      operational: 0,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
    status: 'Terjual',
    paymentMethod: 'Transfer Bank',
    updatedAt: now,
  };

  await db.collection('transactions').doc(item1Id).update(item1Payload);
  console.log(`✅ Item 1 [${item1Id}] dipulihkan: "${item1Payload.itemName}" - ${item1Payload.ownerName} - Rp ${item1Payload.sellingPrice}`);

  // 2. Pulihkan Item 2 (raH8UGhrePiOTS2VR9QO) -> Ritza, Crop, Rp 10.000
  const item2Id = 'raH8UGhrePiOTS2VR9QO';
  const item2Payload = {
    itemName: 'Crop',
    ownerName: 'Ritza',
    category: 'Baju',
    date: '2026-08-16',
    sellingPrice: 10000,
    costPrice: 0,
    profit: 10000,
    profitSharing: {
      pemilikBarang: 10000,
      operational: 0,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
    skemaCustom: {
      pemilikBarang: 100,
      operational: 0,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
    ownerCustomScheme: {
      pemilikBarang: 100,
      operational: 0,
      akbar: 0,
      nesa: 0,
      andin: 0,
      ritza: 0,
    },
    status: 'Terjual',
    paymentMethod: 'Transfer Bank',
    updatedAt: now,
  };

  await db.collection('transactions').doc(item2Id).update(item2Payload);
  console.log(`✅ Item 2 [${item2Id}] dipulihkan: "${item2Payload.itemName}" - ${item2Payload.ownerName} - Rp ${item2Payload.sellingPrice}`);

  console.log('\n=== VERIFIKASI TRANSAKSI 16 AGUSTUS SETELAH PEMULIHAN ===');
  const snap = await db.collection('transactions').where('date', '==', '2026-08-16').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  docs.sort((a,b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  docs.forEach((d, idx) => {
    console.log(`${idx + 1}. [${d.id}] ${d.ownerName} - "${d.itemName}" : Rp ${d.sellingPrice}`);
  });

  console.log('\n🎉 PEMULIHAN 100% SELESAI!');
}

restore().then(() => process.exit(0)).catch(err => {
  console.error('Error saat restore:', err);
  process.exit(1);
});
