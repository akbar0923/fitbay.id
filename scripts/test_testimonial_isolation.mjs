import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('c:/Users/muhba/Downloads/Fitbay.id/.env', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.*)'/s);
const sa = JSON.parse(match[1]);
const app = initializeApp({ credential: cert(sa) }, 'test_isolation');
const db = getFirestore(app);

async function runTest() {
  console.log('=== MEMULAI PENGUJIAN ISOLASI FITUR TESTIMONI ===\n');

  const now = new Date().toISOString();
  const testInvId = `test_inv_${Date.now()}`;
  const testTx1Id = `test_tx1_${Date.now()}`;
  const testTx2Id = `test_tx2_${Date.now()}`;
  const createdTestiIds = [];

  try {
    // 1. Buat data uji coba di koleksi inventory (Data Barang)
    console.log('1. Membuat barang uji coba di koleksi inventory...');
    const invData = {
      namaBarang: 'Kemeja Linen Test Audit',
      kodeBarang: 'TEST-FB-99',
      kategori: 'Baju',
      pemilikBarang: 'Ritza',
      sellingPrice: 75000,
      hargaModal: 25000,
      status: 'Terjual',
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('inventory').doc(testInvId).set(invData);
    console.log(`   ✅ Inventory created: [${testInvId}] "${invData.namaBarang}"`);

    // 2. Buat 2 transaksi uji coba berstatus 'Terjual' (Data Penjualan & Barang Saya)
    console.log('\n2. Membuat 2 transaksi uji coba berstatus Terjual...');
    const tx1Data = {
      date: '2026-09-09',
      itemName: 'Kemeja Linen Test Audit',
      ownerName: 'Ritza',
      category: 'Baju',
      kodeBarang: 'TEST-FB-99',
      inventoryItemId: testInvId,
      sellingPrice: 75000,
      costPrice: 25000,
      profit: 50000,
      profitSharing: {
        pemilikBarang: 42500,
        operational: 7500,
        akbar: 0,
        nesa: 0,
        andin: 0,
        ritza: 0,
      },
      status: 'Terjual',
      statusTestimoni: 'belum_diminta',
      namaPenerima: 'Budi Santoso',
      noHpPenerima: '081234567890',
      paymentMethod: 'Transfer Bank',
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('transactions').doc(testTx1Id).set(tx1Data);

    const tx2Data = {
      date: '2026-09-09',
      itemName: 'Blouse Pastel, Rok Denim (2 Barang)',
      ownerName: 'Nessa',
      category: 'Campuran',
      sellingPrice: 120000,
      costPrice: 40000,
      profit: 80000,
      profitSharing: {
        pemilikBarang: 68000,
        operational: 12000,
        akbar: 0,
        nesa: 0,
        andin: 0,
        ritza: 0,
      },
      items: [
        {
          itemName: 'Blouse Pastel',
          ownerName: 'Nessa',
          category: 'Baju',
          sellingPrice: 60000,
          costPrice: 20000,
          profit: 40000,
        },
        {
          itemName: 'Rok Denim',
          ownerName: 'Nessa',
          category: 'Rok',
          sellingPrice: 60000,
          costPrice: 20000,
          profit: 40000,
        }
      ],
      status: 'Terjual',
      statusTestimoni: 'belum_diminta',
      namaPenerima: 'Siti Rahma',
      noHpPenerima: '089876543210',
      paymentMethod: 'QRIS',
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('transactions').doc(testTx2Id).set(tx2Data);
    console.log(`   ✅ Tx1 created: [${testTx1Id}] "${tx1Data.itemName}" - Rp ${tx1Data.sellingPrice}`);
    console.log(`   ✅ Tx2 created: [${testTx2Id}] "${tx2Data.itemName}" - Rp ${tx2Data.sellingPrice}`);

    // Helper untuk memverifikasi keutuhan data
    async function verifyDataIntegrity(stageDescription) {
      console.log(`\n🔍 Verifikasi Keutuhan Data [${stageDescription}]:`);
      const [tx1Snap, tx2Snap, invSnap] = await Promise.all([
        db.collection('transactions').doc(testTx1Id).get(),
        db.collection('transactions').doc(testTx2Id).get(),
        db.collection('inventory').doc(testInvId).get(),
      ]);

      if (!tx1Snap.exists) throw new Error(`Tx1 terhapus secara tidak sengaja di tahap ${stageDescription}!`);
      if (!tx2Snap.exists) throw new Error(`Tx2 terhapus secara tidak sengaja di tahap ${stageDescription}!`);
      if (!invSnap.exists) throw new Error(`Inventory item terhapus secara tidak sengaja di tahap ${stageDescription}!`);

      const currentTx1 = tx1Snap.data();
      const currentTx2 = tx2Snap.data();
      const currentInv = invSnap.data();

      // Check Tx1 critical fields
      if (currentTx1.itemName !== tx1Data.itemName) throw new Error(`Tx1 itemName berubah: "${currentTx1.itemName}" vs "${tx1Data.itemName}"`);
      if (currentTx1.sellingPrice !== tx1Data.sellingPrice) throw new Error(`Tx1 sellingPrice berubah: ${currentTx1.sellingPrice} vs ${tx1Data.sellingPrice}`);
      if (currentTx1.profit !== tx1Data.profit) throw new Error(`Tx1 profit berubah: ${currentTx1.profit} vs ${tx1Data.profit}`);
      if (currentTx1.ownerName !== tx1Data.ownerName) throw new Error(`Tx1 ownerName berubah: "${currentTx1.ownerName}" vs "${tx1Data.ownerName}"`);

      // Check Tx2 critical fields
      if (currentTx2.itemName !== tx2Data.itemName) throw new Error(`Tx2 itemName berubah: "${currentTx2.itemName}" vs "${tx2Data.itemName}"`);
      if (currentTx2.sellingPrice !== tx2Data.sellingPrice) throw new Error(`Tx2 sellingPrice berubah: ${currentTx2.sellingPrice} vs ${tx2Data.sellingPrice}`);
      if (currentTx2.profit !== tx2Data.profit) throw new Error(`Tx2 profit berubah: ${currentTx2.profit} vs ${tx2Data.profit}`);
      if (!currentTx2.items || currentTx2.items.length !== 2) throw new Error(`Tx2 items rusak atau hilang! items: ${JSON.stringify(currentTx2.items)}`);

      // Check Inventory critical fields
      if (currentInv.namaBarang !== invData.namaBarang) throw new Error(`Inventory namaBarang berubah: "${currentInv.namaBarang}"`);
      if (currentInv.sellingPrice !== invData.sellingPrice) throw new Error(`Inventory sellingPrice berubah: ${currentInv.sellingPrice}`);
      if (currentInv.pemilikBarang !== invData.pemilikBarang) throw new Error(`Inventory pemilikBarang berubah: "${currentInv.pemilikBarang}"`);

      console.log(`   ✅ 100% UTUH: Tx1, Tx2, dan Barang Inventaris TIDAK BERUBAH sama sekali.`);
    }

    // 3. Simulasi Pembuatan Testimoni Baru (Placeholder & Manual)
    console.log('\n3. Simulasi Pembuatan Dokumen Baru di Koleksi Testimonials...');
    const testi1Ref = await db.collection('testimonials').add({
      namaPembeli: 'Budi Santoso',
      namaBarang: 'Kemeja Linen Test Audit',
      referensiTransaksiId: testTx1Id,
      kodeTestimoni: 'TESTI-TEST01',
      sumber: 'transaksi',
      status: 'menunggu_diisi',
      isiTestimoni: '',
      rating: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createdTestiIds.push(testi1Ref.id);
    console.log(`   ✅ Testimoni Placeholder 1 dibuat: [${testi1Ref.id}]`);
    await verifyDataIntegrity('Setelah Pembuatan Testimoni 1');

    const testi2Ref = await db.collection('testimonials').add({
      namaPembeli: 'Siti Rahma',
      namaBarang: 'Blouse Pastel',
      referensiTransaksiId: testTx2Id,
      kodeTestimoni: 'TESTI-TEST02',
      sumber: 'manual',
      status: 'disetujui',
      isiTestimoni: 'Bagus banget bahannya adem dan pengiriman cepat!',
      rating: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createdTestiIds.push(testi2Ref.id);
    console.log(`   ✅ Testimoni Manual 2 dibuat: [${testi2Ref.id}]`);
    await verifyDataIntegrity('Setelah Pembuatan Testimoni 2');

    // 4. Simulasi Pengeditan / Pelengkapan Testimoni Berulang Kali
    console.log('\n4. Simulasi Pengeditan dan Update Status Testimoni Berulang Kali (Loop 3x)...');
    for (let i = 1; i <= 3; i++) {
      console.log(`   --- Iterasi Edit #${i} ---`);
      await db.collection('testimonials').doc(testi1Ref.id).update({
        isiTestimoni: `Ulasan diperbarui ke-${i}: Kualitas luar biasa memuaskan!`,
        rating: 5,
        status: 'disetujui',
        updatedAt: new Date().toISOString(),
      });

      await db.collection('testimonials').doc(testi2Ref.id).update({
        isiTestimoni: `Ulasan 2 diperbarui ke-${i}: Sangat recommended belanja di Fitbay.id!`,
        rating: 5,
        catatanInternal: `Catatan admin revisi ${i}`,
        updatedAt: new Date().toISOString(),
      });

      await verifyDataIntegrity(`Setelah Iterasi Edit #${i}`);
    }

    // 5. Simulasi Penghapusan Testimoni Berulang Kali
    console.log('\n5. Simulasi Penghapusan Dokumen Testimoni...');
    await db.collection('testimonials').doc(testi1Ref.id).delete();
    console.log(`   ✅ Testimoni 1 [${testi1Ref.id}] berhasil dihapus`);
    await verifyDataIntegrity('Setelah Penghapusan Testimoni 1');

    await db.collection('testimonials').doc(testi2Ref.id).delete();
    console.log(`   ✅ Testimoni 2 [${testi2Ref.id}] berhasil dihapus`);
    await verifyDataIntegrity('Setelah Penghapusan Testimoni 2');

    // 6. Buat lagi testimoni baru dan hapus lagi (Siklus Berulang)
    console.log('\n6. Siklus Ulang: Buat Testimoni Baru Lagi lalu Langsung Dihapus...');
    const testi3Ref = await db.collection('testimonials').add({
      namaPembeli: 'Pelanggan Uji Coba Lagi',
      namaBarang: 'Kemeja Linen Test Audit',
      referensiTransaksiId: testTx1Id,
      isiTestimoni: 'Ulasan siklus kedua untuk menguji ketahanan isolasi data.',
      rating: 5,
      status: 'disetujui',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createdTestiIds.push(testi3Ref.id);
    await verifyDataIntegrity('Setelah Pembuatan Ulang Testimoni 3');

    await db.collection('testimonials').doc(testi3Ref.id).delete();
    console.log(`   ✅ Testimoni 3 [${testi3Ref.id}] dihapus`);
    await verifyDataIntegrity('Setelah Penghapusan Testimoni 3');

    console.log('\n🎉 SEMUA PENGUJIAN ISOLASI SELESAI DENGAN STATUS: 100% SUKSES!');
    console.log('Koleksi transactions dan inventory terbukti tidak tersentuh atau berubah sama sekali selama seluruh siklus CRUD testimoni berlangsung.');

  } finally {
    // 7. Cleanup dokumen uji coba
    console.log('\n7. Membersihkan seluruh dokumen uji coba dari Firestore...');
    await Promise.allSettled([
      db.collection('inventory').doc(testInvId).delete(),
      db.collection('transactions').doc(testTx1Id).delete(),
      db.collection('transactions').doc(testTx2Id).delete(),
      ...createdTestiIds.map(id => db.collection('testimonials').doc(id).delete())
    ]);
    console.log('   ✅ Dokumen uji coba berhasil dibersihkan.');
  }
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
