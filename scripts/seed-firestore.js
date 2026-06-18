/**
 * SEED DATA MAGIC BAG KE FIRESTORE
 * Jalankan: node scripts/seed-firestore.js
 * 
 * Install dulu: npm install firebase-admin
 * Butuh: serviceAccountKey.json (download dari Firebase Console > Project Settings > Service Accounts)
 */

const admin = require('firebase-admin');

// Ganti path ini ke service account kamu
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const magicBags = [
  {
    tokoNama: 'Bakery Roti Nusantara',
    kategori: 'Roti & Kue',
    harga: 25000,
    hargaAsli: 80000,
    stok: 5,
    jamPickup: '18.00 - 20.00',
    deskripsi: 'Kamu akan mendapatkan campuran roti dan kue sisa hari ini. Bisa berisi croissant, roti tawar, donat, atau kue bolu. Semua masih segar!',
    emoji: '🥐',
    alamat: 'Jl. Raya Soreang No. 12',
    createdAt: Date.now(),
  },
  {
    tokoNama: 'Warung Nasi Bu Tini',
    kategori: 'Makanan Berat',
    harga: 15000,
    hargaAsli: 50000,
    stok: 3,
    jamPickup: '20.00 - 21.00',
    deskripsi: 'Magic bag berisi nasi + lauk pauk sisa makan malam. Bisa berisi ayam goreng, tempe, sayur, dan sambel. Porsi cukup untuk 1-2 orang.',
    emoji: '🍱',
    alamat: 'Jl. Katapang No. 5, Soreang',
    createdAt: Date.now() - 1000,
  },
  {
    tokoNama: 'Kopi Kenangan Soreang',
    kategori: 'Minuman & Snack',
    harga: 20000,
    hargaAsli: 65000,
    stok: 7,
    jamPickup: '21.00 - 22.00',
    deskripsi: 'Dapatkan 2-3 minuman kopi atau teh pilihan + snack sisa hari ini. Bisa berisi kopi susu, matcha latte, atau thai tea.',
    emoji: '☕',
    alamat: 'Jl. Soreang-Banjaran KM 3',
    createdAt: Date.now() - 2000,
  },
  {
    tokoNama: 'Pizza Hut Soreang',
    kategori: 'Fast Food',
    harga: 35000,
    hargaAsli: 110000,
    stok: 2,
    jamPickup: '21.30 - 22.30',
    deskripsi: 'Magic bag berisi 1-2 box pizza sisa malam ini. Topping bervariasi, tidak bisa request. Semua fresh dari oven!',
    emoji: '🍕',
    alamat: 'Jl. Raya Soreang, Mall Ramayana Lt.1',
    createdAt: Date.now() - 3000,
  },
  {
    tokoNama: 'Sushi Tei Express',
    kategori: 'Japanese Food',
    harga: 40000,
    hargaAsli: 120000,
    stok: 4,
    jamPickup: '20.30 - 21.30',
    deskripsi: 'Assorted sushi dan onigiri sisa hari ini. Minimal 8 pcs per bag. Ikan selalu segar, dijamin enak!',
    emoji: '🍣',
    alamat: 'Jl. Soreang Indah No. 20',
    createdAt: Date.now() - 4000,
  },
];

async function seed() {
  console.log('Seeding magic_bags...');
  for (const bag of magicBags) {
    await db.collection('magic_bags').add(bag);
    console.log(`✅ Added: ${bag.tokoNama}`);
  }
  console.log('\nDone! Data berhasil ditambahkan ke Firestore.');
  process.exit(0);
}

seed().catch(console.error);
