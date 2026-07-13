import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// admin-guard.js adalah versi admin dari auth-guard.js punya sisarasaweb.
// Bedanya: ini ngecek keanggotaan di collection `admins/{uid}`, BUKAN
// `stores/{uid}`. Login Firebase Auth berhasil doang gak cukup — user itu
// juga harus punya dokumen di admins/{uid}, kalau enggak dianggap bukan
// admin dan langsung ditendang balik ke login, walau akunnya sah/valid
// buat login mitra toko biasa.

const publicPages = ['login.html'];

function currentPage() {
  const last = window.location.pathname.split('/').pop();
  return last || 'index.html';
}

onAuthStateChanged(auth, async (user) => {
  const page = currentPage();

  if (user) {
    let isAdmin = false;
    let adminName = user.email || 'Admin';

    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (adminSnap.exists()) {
        isAdmin = true;
        adminName = adminSnap.data().name || adminName;
      }
    } catch (e) {
      console.error('Gagal cek status admin:', e);
    }

    if (!isAdmin) {
      // Login Firebase-nya sah, tapi bukan admin — JANGAN kasih akses.
      // Sign out paksa supaya gak nyangkut di sesi setengah-otentikasi
      // (login valid tapi ditolak terus tiap pindah halaman).
      alert('Akun ini tidak terdaftar sebagai admin Sisarasa.');
      await signOut(auth);
      window.location.href = 'login.html';
      return;
    }

    localStorage.setItem('adminUid', user.uid);
    localStorage.setItem('adminName', adminName);

    if (publicPages.includes(page)) {
      window.location.href = 'index.html';
      return;
    }

    updateProfileUI(adminName);
    document.dispatchEvent(new CustomEvent('sisarasaAdmin:authReady', { detail: { uid: user.uid } }));

  } else {
    localStorage.removeItem('adminUid');
    localStorage.removeItem('adminName');
    document.dispatchEvent(new CustomEvent('sisarasaAdmin:authReady', { detail: { uid: null } }));

    if (!publicPages.includes(page)) {
      window.location.href = 'login.html';
    }
  }
});

function updateProfileUI(name) {
  const profileElements = document.querySelectorAll('.user-profile .fw-bold');
  profileElements.forEach(el => { el.textContent = name; });
}

window.logout = function () {
  signOut(auth).catch((error) => console.error('Logout Error', error));
};

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Yakin ingin keluar dari akun admin ini?')) {
        window.logout();
      }
    });
  }
});
