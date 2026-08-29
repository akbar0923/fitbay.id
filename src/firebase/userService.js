import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  setPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import { db, auth, firebaseConfig } from './firebaseConfig';
import { DEFAULT_USER_PROFILES, USER_ROLES } from '../constants/profitSharingConfig';

const COLLECTION_NAME = 'users';
const ADMIN_USERNAMES = ['muhbar', 'nessa', 'admin', 'akbar', 'nesa'];
const EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'fitbay.id';

/**
 * Konversi username ke format email internal
 * @param {string} username 
 * @returns {string}
 */
export function usernameToInternalEmail(username) {
  const clean = (username || '').trim().toLowerCase();
  if (clean.includes('@')) return clean;
  if (clean === 'admin') return 'admin@admin.id';
  return `${clean}@${EMAIL_DOMAIN}`;
}

/**
 * Mengambil profil & role user dari Firestore
 * Jika dokumen belum ada atau role belum sinkron, otomatis memperbarui profil
 * @param {string} uid
 * @param {string} username
 * @param {string} email
 * @returns {Promise<object>}
 */
export async function getUserProfile(uid, username, email) {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const cleanUsername = (username || '').toLowerCase();
  const isAdminUser = ADMIN_USERNAMES.includes(cleanUsername);

  try {
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Jika akun seharusnya admin tetapi di DB masih staff, otomatis upgrade ke admin
      if (isAdminUser && data.role !== USER_ROLES.ADMIN) {
        const updatedData = {
          ...data,
          role: USER_ROLES.ADMIN,
          title: data.title?.includes('Admin') ? data.title : (cleanUsername === 'muhbar' ? 'Founder & Admin' : 'Co-Founder & Admin'),
          status: data.status || 'active',
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(docRef, updatedData);
        return { uid, ...updatedData };
      }
      return { uid, status: data.status || 'active', ...data };
    }
  } catch (err) {
    console.warn('Could not read user profile doc from Firestore, using default profile:', err);
  }

  // Auto-provisioning profil awal berdasarkan username
  const defaultProfile = DEFAULT_USER_PROFILES[cleanUsername] || {
    name: username || 'User',
    username: cleanUsername,
    role: isAdminUser ? USER_ROLES.ADMIN : USER_ROLES.STAFF,
    title: isAdminUser ? 'Admin' : 'Staff Fitbay',
    status: 'active',
  };

  const newProfile = {
    ...defaultProfile,
    email: email || usernameToInternalEmail(cleanUsername),
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(docRef, newProfile);
  } catch (err) {
    console.warn('Could not save user profile doc to Firestore:', err);
  }

  return { uid, ...newProfile };
}

/**
 * Membuat User Baru langsung oleh Super Admin tanpa mengganti sesi login yang aktif.
 * 
 * Strategi aman:
 * 1. Buat secondary Firebase App (terisolasi, in-memory persistence only)
 * 2. Buat akun baru di Firebase Auth via secondary Auth → ambil UID
 * 3. Sign out & hapus secondary app (bersihkan total)
 * 4. Tulis profil user ke Firestore memakai PRIMARY db (admin masih login)
 * 5. Sesi Super Admin 100% tidak terganggu
 */
export async function createUserByAdmin({
  name,
  username,
  password,
  role = USER_ROLES.STAFF,
  title = '',
  createdBy = 'admin',
}) {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (!cleanUsername) {
    throw new Error('Username tidak valid. Gunakan huruf kecil, angka, atau underscore.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password minimal 6 karakter.');
  }

  const email = usernameToInternalEmail(cleanUsername);

  // Step 1: Buat secondary Firebase App dengan nama unik
  const secondaryAppName = `_TempAuth_${Date.now()}`;
  let secondaryApp = null;
  let newUid = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // Gunakan in-memory persistence agar TIDAK menyimpan ke IndexedDB
    // dan tidak mengganggu session primary app sama sekali
    await setPersistence(secondaryAuth, inMemoryPersistence);

    // Step 2: Buat akun baru di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    newUid = userCredential.user.uid;

    // Step 3: Sign out dari secondary auth segera
    await firebaseSignOut(secondaryAuth);

  } catch (error) {
    console.error('createUserByAdmin Auth error:', error);
    let errorMsg = error.message;
    if (error.code === 'auth/email-already-in-use') {
      errorMsg = `Username "${cleanUsername}" sudah terdaftar di Firebase Auth. Gunakan username lain.`;
    } else if (error.code === 'auth/weak-password') {
      errorMsg = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    } else if (error.code === 'auth/invalid-email') {
      errorMsg = 'Format email dari username tidak valid.';
    }
    throw new Error(errorMsg);
  } finally {
    // Hapus secondary app sepenuhnya
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
    }
  }

  // Step 4: Tulis profil user ke Firestore memakai PRIMARY db
  // (Admin masih login di primary app, sehingga rule isAuthenticated() terpenuhi)
  try {
    const userProfileData = {
      name: name.trim(),
      username: cleanUsername,
      email: email,
      role: role || USER_ROLES.STAFF,
      title: title.trim() || (role === USER_ROLES.ADMIN ? 'Admin' : 'Staff Fitbay'),
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'admin',
      updatedAt: new Date().toISOString(),
    };

    const userDocRef = doc(db, COLLECTION_NAME, newUid);
    await setDoc(userDocRef, userProfileData);

    return { uid: newUid, ...userProfileData };
  } catch (firestoreError) {
    console.error('createUserByAdmin Firestore write error:', firestoreError);
    throw new Error(
      'Akun berhasil dibuat di Firebase Auth, tetapi gagal menyimpan profil ke database. ' +
      'Coba minta user login sekali agar profilnya otomatis terbuat.'
    );
  }
}

/**
 * Mengupdate data profil & role pengguna di Firestore
 * @param {string} uid
 * @param {object} updateData - { name, role, title, status }
 */
export async function updateUserProfileData(uid, updateData) {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const payload = {
    ...updateData,
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(docRef, payload);
}

/**
 * Mengupdate role pengguna (hanya bisa dilakukan Admin)
 * @param {string} uid
 * @param {string} newRole
 */
export async function updateUserRole(uid, newRole) {
  return updateUserProfileData(uid, { role: newRole });
}

/**
 * Mengubah status aktif / nonaktif pengguna
 * @param {string} uid
 * @param {string} newStatus - 'active' | 'inactive'
 */
export async function toggleUserStatus(uid, newStatus) {
  return updateUserProfileData(uid, { status: newStatus });
}

/**
 * Menghapus akun pengguna dari Firestore
 * @param {string} uid
 */
export async function deleteUserAccount(uid) {
  const docRef = doc(db, COLLECTION_NAME, uid);
  await deleteDoc(docRef);
}

/**
 * Mengirim email reset password ke pengguna
 * @param {string} email
 */
export async function sendUserPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Mengambil semua user dari Firestore secara one-time
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    status: 'active',
    ...doc.data(),
  }));
}

/**
 * Subscribe real-time list pengguna dari Firestore
 * @param {function} callback
 * @returns {function} unsubscribe function
 */
export function subscribeUsers(callback) {
  const usersCollection = collection(db, COLLECTION_NAME);
  return onSnapshot(
    usersCollection,
    (snapshot) => {
      const usersList = snapshot.docs.map((doc) => ({
        uid: doc.id,
        status: 'active',
        ...doc.data(),
      }));
      callback(usersList);
    },
    (error) => {
      console.error('Error listening to users collection:', error);
      callback([]);
    }
  );
}
