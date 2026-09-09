import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('c:/Users/muhba/Downloads/Fitbay.id/.env', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.*)'/s);
const sa = JSON.parse(match[1]);
const app = initializeApp({ credential: cert(sa) }, 'check_comm');
const db = getFirestore(app);

async function run() {
  const snap = await db.collection('transactions').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log('=== TRANSACTIONS WHERE TEAM PROFIT SHARING > 0 ===\n');
  docs.forEach(t => {
    const ps = t.profitSharing || {};
    const hasTeamShare = (ps.akbar > 0) || (ps.nesa > 0) || (ps.nessa > 0) || (ps.ritza > 0) || (ps.andin > 0);
    if (hasTeamShare) {
      console.log(`[${t.id}] date=${t.date} owner="${t.ownerName}" item="${t.itemName}" price=${t.sellingPrice}`);
      console.log(`   PS: akbar=${ps.akbar} nesa=${ps.nesa || ps.nessa} ritza=${ps.ritza} andin=${ps.andin} PB=${ps.pemilikBarang} ops=${ps.operational || ps.operasional}`);
    }
  });
}

run().then(() => process.exit(0)).catch(console.error);
