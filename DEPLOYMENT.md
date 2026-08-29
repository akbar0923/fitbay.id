# Fitbay.id — Panduan Deployment

## 📋 Prasyarat

### 1. Setup Firebase Project
1. Buka [Firebase Console](https://console.firebase.google.com)
2. Klik **Add project** → beri nama (misal: `fitbay-id`)
3. **Aktifkan Firestore Database:**
   - Sidebar → Build → Firestore Database → Create Database
   - Pilih lokasi (asia-southeast2 untuk Indonesia)
   - Mulai dalam **Production mode**
4. **Aktifkan Authentication:**
   - Sidebar → Build → Authentication → Get Started
   - Tab **Sign-in method** → aktifkan **Email/Password**
5. **Buat akun user:**
   - Tab **Users** → **Add user**
   - Email: `akbar@fitbay.internal` (username + @fitbay.internal)
   - Password: (password yang diinginkan)
   - Ulangi untuk user lain: `nesa@fitbay.internal`, `andin@fitbay.internal`, dll.
6. **Setup Firestore Security Rules:**
   - Firestore Database → Tab **Rules**
   - Copy isi file `firestore.rules` dari project ini
   - Klik **Publish**

### 2. Dapatkan Firebase Config
1. Firebase Console → Project Settings (⚙️) → General
2. Scroll ke **Your apps** → klik **Web** (ikon `</>`)
3. Register app → copy konfigurasi Firebase SDK

---

## 🔧 Environment Variables

Buat file `.env` di root project (JANGAN commit ke Git):

```bash
VITE_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=fitbay-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fitbay-id
VITE_FIREBASE_STORAGE_BUCKET=fitbay-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop
VITE_AUTH_EMAIL_DOMAIN=fitbay.internal
```

> ⚠️ **PENTING:** Prefix `VITE_` wajib agar Vite bisa membaca variabel ini di browser.

---

## 🚀 Deploy ke Vercel

### Setup
1. Push kode ke GitHub (pastikan `.env` sudah di `.gitignore`)
2. Buka [vercel.com](https://vercel.com) → **Import Git Repository**
3. Pilih repository Fitbay.id

### Environment Variables
- Di Vercel dashboard → **Settings** → **Environment Variables**
- Tambahkan semua variabel dari `.env`:

| Key | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `fitbay-id.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `fitbay-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `fitbay-id.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` |
| `VITE_FIREBASE_APP_ID` | `1:123456789012:web:...` |
| `VITE_AUTH_EMAIL_DOMAIN` | `fitbay.internal` |

### Build Settings
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Domain Firebase Auth
Setelah deploy, tambahkan domain Vercel ke Firebase:
1. Firebase Console → Authentication → Settings → **Authorized domains**
2. Tambahkan: `your-project.vercel.app`

---

## 🚀 Deploy ke Netlify

### Setup
1. Buka [netlify.com](https://netlify.com) → **Import an existing project**
2. Connect ke GitHub → pilih repository

### Environment Variables
- **Site settings** → **Build & deploy** → **Environment** → **Environment variables**
- Tambahkan semua variabel yang sama seperti di atas

### Build Settings
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`

### Redirects (untuk React Router)
Buat file `public/_redirects`:
```
/*    /index.html   200
```

### Domain Firebase Auth
Tambahkan domain Netlify ke Firebase Authorized domains (sama seperti Vercel).

---

## 🚀 Deploy ke GitHub Pages

> ⚠️ GitHub Pages tidak mendukung environment variables di build time.
> Gunakan **GitHub Actions** untuk build dengan secrets.

### Setup GitHub Actions
1. Repository → **Settings** → **Secrets and variables** → **Actions**
2. Tambahkan setiap variabel sebagai Repository Secret

### Workflow File (`.github/workflows/deploy.yml`)
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - run: npm ci
      
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_AUTH_EMAIL_DOMAIN: ${{ secrets.VITE_AUTH_EMAIL_DOMAIN }}
      
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

> ⚠️ Untuk GitHub Pages, perlu atur `base` di `vite.config.js`:
> ```js
> export default defineConfig({ base: '/repo-name/' })
> ```

---

## 🔒 Catatan Keamanan

1. **API Key Firebase bersifat publik** — ini normal. Firebase API key hanya mengidentifikasi project, bukan mengotorisasi akses. Keamanan dijaga oleh **Firestore Security Rules** dan **Firebase Auth**.

2. **Firestore Security Rules** memastikan:
   - Hanya user yang sudah login (`request.auth != null`) bisa read/write data
   - User anonim TIDAK bisa mengakses data apapun

3. **Tidak ada fitur registrasi publik** — akun hanya bisa dibuat melalui Firebase Console oleh admin.

4. **`.env` file** tidak pernah di-commit ke Git. Gunakan `.env.example` sebagai referensi variabel.
