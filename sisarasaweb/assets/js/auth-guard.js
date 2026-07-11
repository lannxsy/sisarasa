import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// auth-guard.js adalah SATU-SATUNYA sumber kebenaran soal status login DAN
// status kelengkapan setup toko. Halaman lain tidak boleh redirect sendiri
// berdasarkan localStorage saja, karena localStorage bisa kosong sesaat
// (misal: baru selesai register, atau baru refresh) walaupun sesi Firebase
// Auth-nya sendiri masih valid. Sebagai gantinya, halaman lain menunggu
// event 'sisarasa:authReady' di bawah ini sebelum memutuskan redirect atau
// menjalankan query Firestore.

const publicPages = ['login.html', 'register.html'];
const setupPage = 'setup-toko.html';

function currentPage() {
  const last = window.location.pathname.split('/').pop();
  return last || 'index.html'; // root path dianggap index.html
}

onAuthStateChanged(auth, async (user) => {
  const page = currentPage();

  if (user) {
    // User sudah login di Firebase Auth.
    localStorage.setItem('userUid', user.uid);

    let storeData = null;
    try {
      const storeSnap = await getDoc(doc(db, 'stores', user.uid));
      if (storeSnap.exists()) storeData = storeSnap.data();
    } catch (e) {
      console.error('Error fetching store profile', e);
    }

    const setupComplete = storeData ? storeData.setupComplete === true : false;

    if (storeData && storeData.name) {
      localStorage.setItem('storeName', storeData.name);
    }

    // ── Gating berdasarkan kelengkapan setup toko ──────────────────────────
    if (!setupComplete && page !== setupPage) {
      // Toko belum setup lengkap, dan user sedang mencoba akses halaman lain
      // (dashboard, menu, orders, settings, dst) — paksa ke setup-toko.html
      // dulu. Ini juga berlaku kalau dia sedang di login.html/register.html
      // (kasus: tutup browser di tengah onboarding lalu login lagi nanti).
      window.location.href = 'setup-toko.html';
      return;
    }

    if (setupComplete && page === setupPage) {
      // Toko sudah lengkap tapi user entah bagaimana balik ke halaman setup
      // (misal back button) — langsung saja ke dashboard.
      window.location.href = 'index.html';
      return;
    }

    if (setupComplete && publicPages.includes(page)) {
      // Sudah login & sudah setup, tapi nyasar ke login/register — ke dashboard.
      window.location.href = 'index.html';
      return;
    }

    // Update UI
    updateProfileUI(localStorage.getItem('storeName') || 'Mitra Sisarasa');

    document.dispatchEvent(new CustomEvent('sisarasa:authReady', { detail: { uid: user.uid, setupComplete } }));

  } else {
    // Tidak ada user yang login.
    localStorage.removeItem('userUid');
    localStorage.removeItem('storeName');

    document.dispatchEvent(new CustomEvent('sisarasa:authReady', { detail: { uid: null, setupComplete: false } }));

    // Hindari redirect loop: jangan paksa redirect kalau memang sedang
    // berada di halaman publik (login/register).
    if (!publicPages.includes(page)) {
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

// Pasang listener tombol logout (id="logoutBtn") di halaman manapun yang
// memuat auth-guard.js, supaya tidak perlu duplikasi kode di setiap file.
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Yakin ingin keluar dari akun mitra ini?')) {
        window.logout();
      }
    });
  }
});
