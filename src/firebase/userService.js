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
const LOCAL_STORAGE_KEY = 'fitbay_users_cache';
const SUPER_ADMIN_USERNAMES = ['muhbar', 'nessa', 'admin', 'akbar', 'nesa'];
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
 * Mendapatkan daftar user default tim Fitbay.id
 */
export function getDefaultTeamUsers() {
  return [
    {
      uid: 'user-akbar-default',
      name: 'Akbar',
      username: 'akbar',
      email: usernameToInternalEmail('akbar'),
      role: USER_ROLES.SUPER_ADMIN,
      title: 'Founder & Super Admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-nesa-default',
      name: 'Nessa',
      username: 'nesa',
      email: usernameToInternalEmail('nesa'),
      role: USER_ROLES.SUPER_ADMIN,
      title: 'Co-Founder & Super Admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-andin-default',
      name: 'Andin',
      username: 'andin',
      email: usernameToInternalEmail('andin'),
      role: USER_ROLES.STAFF,
      title: 'Staff & Host Live',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-ritza-default',
      name: 'Ritza',
      username: 'ritza',
      email: usernameToInternalEmail('ritza'),
      role: USER_ROLES.STAFF,
      title: 'Staff & Host Live',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

/**
 * Membaca cache user dari localStorage dengan fallback data tim default
 */
export function getLocalUsers() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading local users cache:', e);
  }
  return getDefaultTeamUsers();
}

/**
 * Menyimpan daftar user ke cache localStorage
 */
export function saveLocalUsers(users) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Error saving local users cache:', e);
  }
}

/**
 * Mengambil profil & role user dari Firestore
 * @param {string} uid
 * @param {string} username
 * @param {string} email
 * @returns {Promise<object>}
 */
export async function getUserProfile(uid, username, email) {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const cleanUsername = (username || '').toLowerCase();

  try {
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return { uid, status: data.status || 'active', ...data };
    }
  } catch (err) {
    console.warn('Could not read user profile doc from Firestore, using default profile:', err);
  }

  // Auto-provisioning profil awal hanya jika dokumen belum pernah ada di database
  const isFounder = ['muhbar', 'akbar'].includes(cleanUsername);
  const defaultProfile = DEFAULT_USER_PROFILES[cleanUsername] || {
    name: username || 'User',
    username: cleanUsername,
    role: isFounder ? USER_ROLES.SUPER_ADMIN : USER_ROLES.STAFF,
    title: isFounder ? 'Founder & Super Admin' : 'Staff Fitbay',
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
 * @param {object} param0
 * @returns {Promise<object>} Profil user yang baru dibuat
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
  const secondaryAppName = `_TempAuth_${Date.now()}`;
  let secondaryApp = null;
  let newUid = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // Gunakan in-memory persistence agar tidak mengganggu session primary app
    await setPersistence(secondaryAuth, inMemoryPersistence);

    // Buat akun baru di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    newUid = userCredential.user.uid;

    await firebaseSignOut(secondaryAuth);
  } catch (error) {
    console.error('createUserByAdmin Auth error:', error);
    let errorMsg = error.message;
    if (error.code === 'auth/email-already-in-use') {
      errorMsg = `Username "${cleanUsername}" sudah terdaftar di sistem. Silakan gunakan username lain.`;
    } else if (error.code === 'auth/weak-password') {
      errorMsg = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    } else if (error.code === 'auth/invalid-email') {
      errorMsg = 'Format email dari username tidak valid.';
    }
    throw new Error(errorMsg);
  } finally {
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
    }
  }

  const userProfileData = {
    uid: newUid || `user_${cleanUsername}_${Date.now()}`,
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

  // Simpan ke cache lokal agar langsung tampil di antarmuka
  const currentUsers = getLocalUsers();
  const existingIdx = currentUsers.findIndex((u) => u.username?.toLowerCase() === cleanUsername);
  let updatedLocalUsers;
  if (existingIdx >= 0) {
    updatedLocalUsers = [...currentUsers];
    updatedLocalUsers[existingIdx] = { ...currentUsers[existingIdx], ...userProfileData };
  } else {
    updatedLocalUsers = [userProfileData, ...currentUsers];
  }
  saveLocalUsers(updatedLocalUsers);

  // Simpan ke Firestore
  if (newUid) {
    try {
      const userDocRef = doc(db, COLLECTION_NAME, newUid);
      await setDoc(userDocRef, userProfileData);
    } catch (firestoreError) {
      console.warn('Firestore setDoc failed (using local cache backup):', firestoreError);
    }
  }

  return userProfileData;
}

/**
 * Mengupdate data profil & role pengguna di Firestore & Local Storage
 * @param {string} uid
 * @param {object} updateData - { name, role, title, status }
 */
export async function updateUserProfileData(uid, updateData) {
  // Update local cache
  const currentUsers = getLocalUsers();
  const updatedUsers = currentUsers.map((u) => {
    if (u.uid === uid || u.username === updateData.username) {
      return { ...u, ...updateData, updatedAt: new Date().toISOString() };
    }
    return u;
  });
  saveLocalUsers(updatedUsers);

  // Update Firestore
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const payload = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, payload);
  } catch (err) {
    console.warn('Could not update user in Firestore (saved locally):', err);
  }
}

/**
 * Mengupdate role pengguna
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
 * Menghapus akun pengguna dari Firestore & Local Storage
 * @param {string} uid
 */
export async function deleteUserAccount(uid) {
  // Hapus dari local cache
  const currentUsers = getLocalUsers();
  const filteredUsers = currentUsers.filter((u) => u.uid !== uid);
  saveLocalUsers(filteredUsers);

  // Hapus dari Firestore
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Could not delete user doc from Firestore:', err);
  }
}

/**
 * Mengirim email reset password ke pengguna
 * @param {string} email
 */
export async function sendUserPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Mengambil semua user
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (!snapshot.empty) {
      const firestoreUsers = snapshot.docs.map((doc) => ({
        uid: doc.id,
        status: 'active',
        ...doc.data(),
      }));
      saveLocalUsers(firestoreUsers);
      return firestoreUsers;
    }
  } catch (err) {
    console.warn('Could not fetch users from Firestore:', err);
  }
  return getLocalUsers();
}

/**
 * Subscribe real-time list pengguna dari Firestore dengan fallback lokal instan
 * @param {function} callback
 * @returns {function} unsubscribe function
 */
export function subscribeUsers(callback) {
  // Panggil callback segera dengan data lokal agar tabel tidak kosong (0 user)
  const initialLocal = getLocalUsers();
  callback(initialLocal);

  const usersCollection = collection(db, COLLECTION_NAME);
  try {
    return onSnapshot(
      usersCollection,
      (snapshot) => {
        if (!snapshot.empty) {
          const firestoreUsers = snapshot.docs.map((doc) => ({
            uid: doc.id,
            status: 'active',
            ...doc.data(),
          }));

          // Merge dengan default team users agar akun pendiri tidak pernah hilang
          const mergedMap = new Map();
          initialLocal.forEach((u) => {
            if (u.username) mergedMap.set(u.username.toLowerCase(), u);
          });
          firestoreUsers.forEach((u) => {
            if (u.username) mergedMap.set(u.username.toLowerCase(), u);
            else mergedMap.set(u.uid, u);
          });

          const finalList = Array.from(mergedMap.values());
          saveLocalUsers(finalList);
          callback(finalList);
        } else {
          // Jika Firestore kosong, gunakan data lokal
          callback(initialLocal);
        }
      },
      (error) => {
        console.warn('Error listening to users collection, using cached local data:', error);
        callback(getLocalUsers());
      }
    );
  } catch (e) {
    console.warn('Failed to attach onSnapshot listener:', e);
    callback(initialLocal);
    return () => {};
  }
}
