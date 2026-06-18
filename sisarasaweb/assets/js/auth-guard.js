import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// auth-guard.js adalah SATU-SATUNYA sumber kebenaran soal status login.
// Halaman lain tidak boleh redirect sendiri berdasarkan localStorage saja,
// karena localStorage bisa kosong sesaat (misal: baru selesai register,
// atau baru refresh) walaupun sesi Firebase Auth-nya sendiri masih valid.
// Sebagai gantinya, halaman lain menunggu event 'sisarasa:authReady' di
// bawah ini sebelum memutuskan redirect atau menjalankan query Firestore.

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in.
    localStorage.setItem('userUid', user.uid);
    
    // Fetch store profile if not in localStorage or if we want to ensure it's fresh
    let storeName = localStorage.getItem('storeName');
    
    if (!storeName) {
        try {
            const storeRef = doc(db, 'stores', user.uid);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists()) {
                const data = storeSnap.data();
                storeName = data.name || "Toko Baru";
                localStorage.setItem('storeName', storeName);
            }
        } catch(e) {
            console.error("Error fetching store profile", e);
        }
    }
    
    // Update UI
    updateProfileUI(storeName || "Mitra Sisarasa");

    document.dispatchEvent(new CustomEvent('sisarasa:authReady', { detail: { uid: user.uid } }));

  } else {
    // No user is signed in.
    localStorage.removeItem('userUid');
    localStorage.removeItem('storeName');

    document.dispatchEvent(new CustomEvent('sisarasa:authReady', { detail: { uid: null } }));

    // Hindari redirect loop: jangan paksa redirect kalau kita memang
    // sedang berada di login.html atau register.html.
    const publicPages = ['login.html', 'register.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (!publicPages.includes(currentPage)) {
      window.location.href = 'login.html';
    }
  }
});

function updateProfileUI(storeName) {
    const profileElements = document.querySelectorAll('.user-profile .fw-bold');
    profileElements.forEach(el => {
        el.textContent = storeName;
    });
}

// Global Logout Function
window.logout = function() {
    signOut(auth).then(() => {
        // Sign-out successful.
        // Redirect handled by onAuthStateChanged
    }).catch((error) => {
        console.error("Logout Error", error);
    });
};
