import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore — getReactNativePersistence memang ada & jalan di build React Native
// (lewat field "react-native" di package.json firebase), tapi definisi TypeScript
// yang dibaca editor/tsc nunjuk ke build web yang nggak nge-export fungsi ini.
// Ini bukan bug logic, cuma keterbatasan type resolution — aman diabaikan.
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDFqnmHEXWxI4Fe03cP-al1ezCU_ybFgZU",
  authDomain: "sisarasa-3f969.firebaseapp.com",
  projectId: "sisarasa-3f969",
  storageBucket: "sisarasa-3f969.firebasestorage.app",
  messagingSenderId: "849092433062",
  appId: "1:849092433062:web:3edfe5fc38f0fe930a9067",
};

// Perbaikan: Cek apakah Firebase sudah jalan untuk mencegah error "duplicate app"
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Perbaikan utama: pakai initializeAuth + AsyncStorage persistence (bukan
// getAuth() polos). Tanpa ini, Firebase Auth di React Native tidak tahu cara
// nyimpen/restore sesi login dengan benar, dan auth.currentUser butuh waktu
// (async) buat ke-restore tiap kali app dibuka.
//
// initializeAuth cuma boleh dipanggil SEKALI per app, makanya dibungkus
// try/catch: kalau modul ini ke-reload (Fast Refresh / Hot Reload saat dev),
// initializeAuth akan throw karena auth instance-nya udah ada — fallback ke
// getAuth(app) yang ngambil instance yang sudah ada.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export default app;