import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ReviewData {
  storeId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
}

export interface Review extends ReviewData {
  id: string;
  createdAt: any;
}

// Dokumen review pakai orderId sebagai ID (bukan auto-id) — konsisten sama
// aturan di firestore.rules: 1 orderId cuma boleh sekali `create`, submit
// kedua ke ID yang sama otomatis ketolak security rules. Jadi "1 pesanan
// cuma bisa direview sekali" ditegakkan di server, bukan cuma di UI.
export function reviewDocId(orderId: string) {
  return orderId;
}

export function reviewsCollection() {
  return collection(db, 'reviews');
}

// Cek apakah order tertentu sudah pernah direview, dipakai buat mutusin
// tombol di orders.tsx: tampilin "Beri Rating" atau "Rating Terkirim ✓".
export async function getReviewByOrderId(orderId: string): Promise<Review | null> {
  const snap = await getDoc(doc(db, 'reviews', reviewDocId(orderId)));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as ReviewData & { createdAt: any }) };
}

// Submit review baru SEKALIGUS update agregat rating di stores/{storeId}
// (ratingAvg & ratingCount) dalam satu transaksi atomik — supaya kalau ada
// 2 pembeli submit review bersamaan, hitungan rata-ratanya tetap benar
// (nggak ada race condition kayak "read lama, tulis telat").
export async function submitReview(orderId: string, data: ReviewData) {
  const reviewRef = doc(db, 'reviews', reviewDocId(orderId));
  const storeRef = doc(db, 'stores', data.storeId);

  await runTransaction(db, async (tx) => {
    // Firestore mewajibkan SEMUA get() dilakukan sebelum write manapun
    // di dalam transaksi yang sama.
    const reviewSnap = await tx.get(reviewRef);
    if (reviewSnap.exists()) {
      throw new Error('Pesanan ini sudah pernah diberi rating.');
    }
    const storeSnap = await tx.get(storeRef);
    const storeData = storeSnap.exists() ? storeSnap.data() : {};
    const ratingCountLama = (storeData.ratingCount as number) ?? 0;
    const ratingAvgLama = (storeData.ratingAvg as number) ?? 0;

    const ratingCountBaru = ratingCountLama + 1;
    // Rata-rata baru = (rata-rata lama * jumlah lama + rating baru) / jumlah baru
    const ratingAvgBaru =
      (ratingAvgLama * ratingCountLama + data.rating) / ratingCountBaru;

    tx.set(reviewRef, {
      ...data,
      createdAt: serverTimestamp(),
    });

    tx.update(storeRef, {
      ratingAvg: ratingAvgBaru,
      ratingCount: ratingCountBaru,
    });
  });
}
