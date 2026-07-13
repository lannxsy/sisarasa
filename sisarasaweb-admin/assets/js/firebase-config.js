import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFqnmHEXWxI4Fe03cP-al1ezCU_ybFgZU",
  authDomain: "sisarasa-3f969.firebaseapp.com",
  projectId: "sisarasa-3f969",
  storageBucket: "sisarasa-3f969.firebasestorage.app",
  messagingSenderId: "849092433062",
  appId: "1:849092433062:web:3edfe5fc38f0fe930a9067",
  measurementId: "G-CG8FQ2DJTF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
