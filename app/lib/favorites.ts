import {
  collection,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface FavoriteData {
  tokoNama: string;
  kategori: string;
  harga: number;
  hargaAsli: number;
  emoji: string;
  jamPickup?: string;
  alamat?: string;
}

// Dokumen favorit pakai ID gabungan `${userId}_${bagId}` biar gampang dicek
// dan langsung anti-duplikat tanpa perlu query tambahan.
export function favoriteDocId(userId: string, bagId: string) {
  return `${userId}_${bagId}`;
}

export async function addFavorite(userId: string, bagId: string, data: FavoriteData) {
  const ref = doc(db, 'favorites', favoriteDocId(userId, bagId));
  await setDoc(ref, {
    userId,
    bagId,
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function removeFavorite(userId: string, bagId: string) {
  const ref = doc(db, 'favorites', favoriteDocId(userId, bagId));
  await deleteDoc(ref);
}

export function favoritesCollection() {
  return collection(db, 'favorites');
}
