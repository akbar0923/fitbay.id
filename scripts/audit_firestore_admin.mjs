import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('c:/Users/muhba/Downloads/Fitbay.id/.env', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.*)'/s);
const sa = JSON.parse(match[1]);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

async function runAudit() {
  console.log('=== AUDITING FIRESTORE DATA VIA ADMIN SDK ===\n');

  const [txSnap, invSnap, testiSnap] = await Promise.all([
    db.collection('transactions').get(),
    db.collection('inventory').get(),
    db.collection('testimonials').get()
  ]);

  const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const inventory = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const testimonials = testiSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Total Transactions: ${transactions.length}`);
  console.log(`Total Inventory items: ${inventory.length}`);
  console.log(`Total Testimonials: ${testimonials.length}\n`);

  // 1. Audit Transactions
  console.log('--- Checking Corrupted / Suspicious Transactions ---');
  const corruptedTxs = [];
  transactions.forEach(tx => {
    const issues = [];
    if (!tx.itemName || tx.itemName.trim() === '') issues.push('itemName is empty');
    if (tx.sellingPrice === 0 || tx.sellingPrice === undefined || isNaN(tx.sellingPrice)) issues.push(`sellingPrice is ${tx.sellingPrice}`);
    if (tx.items === null && (!tx.kodeBarang && !tx.itemName)) issues.push('items is null');
    if (tx.profit === 0 && tx.sellingPrice > 0 && Number(tx.costPrice || 0) === 0) issues.push('profit is 0 despite sellingPrice');

    if (issues.length > 0) {
      corruptedTxs.push({ tx, issues });
      console.log(`❌ Tx [${tx.id}]:`);
      console.log(`   Date: ${tx.date}, Status: ${tx.status}, CreatedAt: ${tx.createdAt}, UpdatedAt: ${tx.updatedAt}`);
      console.log(`   Owner: ${tx.ownerName}, ItemName: "${tx.itemName}", Price: ${tx.sellingPrice}, Profit: ${tx.profit}`);
      console.log(`   Items: ${JSON.stringify(tx.items)}, Kode: ${tx.kodeBarang}`);
      console.log(`   Issues: ${issues.join(', ')}`);
      console.log(`   Other fields: paymentMethod=${tx.paymentMethod}, statusTestimoni=${tx.statusTestimoni}, kodeTestimoni=${tx.kodeTestimoni}`);
    }
  });

  if (corruptedTxs.length === 0) {
    console.log('✅ No corrupted transactions found.');
  }

  // 2. Cross-reference with testimonials
  console.log('\n--- Checking Testimonials referencing Transactions ---');
  const linkedTestimonials = testimonials.filter(t => t.referensiTransaksiId);
  console.log(`Testimonials with referensiTransaksiId: ${linkedTestimonials.length}`);

  linkedTestimonials.forEach(t => {
    const matchedTx = transactions.find(tx => tx.id === t.referensiTransaksiId);
    if (!matchedTx) {
      console.log(`⚠️ Testimonial [${t.id}] references non-existent Tx [${t.referensiTransaksiId}] (Buyer: ${t.namaPembeli}, Item: ${t.namaBarang})`);
    } else {
      const isCorrupted = corruptedTxs.some(c => c.tx.id === matchedTx.id);
      if (isCorrupted) {
        console.log(`🚨 Testimonial [${t.id}] is linked to CORRUPTED Tx [${matchedTx.id}]!`);
        console.log(`   Testimonial: namaPembeli="${t.namaPembeli}", namaBarang="${t.namaBarang}", status="${t.status}", rating=${t.rating}, updatedAt="${t.updatedAt}", createdAt="${t.createdAt}"`);
        console.log(`   Tx updatedAt="${matchedTx.updatedAt}"`);
      }
    }
  });

  // 3. Check Inventory items
  console.log('\n--- Checking Inventory for Corrupted or Broken Links ---');
  const corruptedInv = [];
  inventory.forEach(item => {
    const issues = [];
    if (!item.name || item.name.trim() === '') issues.push('name is empty');
    if (!item.owner || item.owner.trim() === '') issues.push('owner is empty');
    if (issues.length > 0) {
      corruptedInv.push({ item, issues });
      console.log(`⚠️ Inv [${item.id}] "${item.name}": ${issues.join(', ')}`);
    }
  });

  if (corruptedInv.length === 0) {
    console.log('✅ All inventory items have valid name and owner.');
  }

  // 4. Find all "Crop" in inventory or transactions
  console.log('\n--- Investigating "Crop" items in Inventory & Transactions ---');
  const cropInv = inventory.filter(inv => (inv.name || '').toLowerCase().includes('crop'));
  console.log(`Inventory items with "Crop": ${cropInv.length}`);
  cropInv.forEach(inv => {
    console.log(`   Inv [${inv.id}] "${inv.name}" | Owner: ${inv.owner} | Sell: ${inv.sellingPrice} | Cost: ${inv.costPrice} | Status: ${inv.status} | Kode: ${inv.kodeBarang}`);
  });

  const cropTx = transactions.filter(tx => 
    (tx.itemName || '').toLowerCase().includes('crop') ||
    (tx.items && tx.items.some(it => (it.itemName || '').toLowerCase().includes('crop')))
  );
  console.log(`Transactions with "Crop": ${cropTx.length}`);
  cropTx.forEach(tx => {
    console.log(`   Tx [${tx.id}] "${tx.itemName}" | Date: ${tx.date} | Owner: ${tx.ownerName} | Sell: ${tx.sellingPrice} | Profit: ${tx.profit} | Status: ${tx.status}`);
  });

  // Check transactions on 2026-08-16
  console.log('\n--- Transactions on 2026-08-16 ---');
  const txs16 = transactions.filter(tx => tx.date === '2026-08-16');
  console.log(`Total txs on 2026-08-16: ${txs16.length}`);
  txs16.forEach(tx => {
    console.log(`   Tx [${tx.id}] "${tx.itemName}" | Owner: ${tx.ownerName} | Sell: ${tx.sellingPrice} | Profit: ${tx.profit} | Status: ${tx.status} | Updated: ${tx.updatedAt}`);
  });

  console.log('\n=== AUDIT COMPLETE ===');
}

runAudit().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
