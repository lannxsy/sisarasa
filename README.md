# Todo List (Expo Router + Firebase Auth)

Project ini adalah aplikasi Expo (React Native) dengan Expo Router (file-based routing) dan fitur autentikasi (Register/Login/Logout) menggunakan Firebase Authentication (Email/Password).

## Prasyarat

- Node.js + npm
- Android Studio (untuk emulator) atau HP Android + Expo Go
- Akun Firebase + project Firebase

## Instalasi

1. Install dependency

   Jika kamu menggunakan Windows (PowerShell) dan muncul error seperti “running scripts is disabled”, gunakan perintah `.cmd`:

   ```bash
   npm.cmd install
   ```

2. Jalankan aplikasi

   Disarankan selalu clear cache Metro saat ada perubahan dependency/config:

   ```bash
   npm.cmd start -- -c
   ```

   Atau:

   ```bash
   npx.cmd expo start --clear
   ```

## Konfigurasi Firebase

### 1) Buat project Firebase

1. Buka Firebase Console dan buat project.
2. Tambahkan app (Web app) untuk mendapatkan Firebase config (apiKey, authDomain, dst).

### 2) Aktifkan Email/Password Auth

Firebase Console → Authentication → Sign-in method → aktifkan Email/Password.

### 3) Masukkan config ke project

Copy file contoh berikut:

- [example-firebase.ts](file:///d:/AMIK/2526/genap/mobile/todo-list/lib/example-firebase.ts)

Lalu ubah namanya menjadi:

- [firebase.ts](file:///d:/AMIK/2526/genap/mobile/todo-list/lib/firebase.ts)

Terakhir, isi nilai `firebaseConfig` di `firebase.ts` menggunakan konfigurasi yang kamu dapatkan dari Firebase Console.

Catatan:
- `databaseURL` harus berupa URL valid tanpa spasi/backtick, contoh:
  `https://your-project-id.firebaseio.com`

## Struktur Halaman (Expo Router)

- Register: [register.tsx](file:///d:/AMIK/2526/genap/mobile/todo-list/app/register.tsx)
- Login: [login.tsx](file:///d:/AMIK/2526/genap/mobile/todo-list/app/login.tsx)
- Home + Logout: [index.tsx](file:///d:/AMIK/2526/genap/mobile/todo-list/app/(tabs)/index.tsx)

Route protection (wajib login untuk masuk Tabs) ada di:

- [app/(tabs)/_layout.tsx](file:///d:/AMIK/2526/genap/mobile/todo-list/app/(tabs)/_layout.tsx)

## Perintah Penting

- Start dev server:

  ```bash
  npm.cmd start
  ```

- Start + clear cache:

  ```bash
  npm.cmd start -- -c
  ```

- Lint:

  ```bash
  npm.cmd run lint
  ```

- Typecheck:

  ```bash
  .\\node_modules\\.bin\\tsc.cmd --noEmit
  ```

## Troubleshooting

### 1) Error: Unable to resolve module firebase/auth

Pastikan file Metro config sudah ada:

- [metro.config.js](file:///d:/AMIK/2526/genap/mobile/todo-list/metro.config.js)

Lalu:
1. Stop dev server
2. Clear cache:

   ```bash
   npm.cmd start -- -c
   ```

Jika port 8081 sudah dipakai, tutup proses Expo lama atau jalankan ulang dan pilih port lain.
