import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;