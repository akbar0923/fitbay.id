import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
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
 * Mencari username berdasarkan alamat email asli/kustom pengguna
 * @param {string} customEmail
 * @returns {Promise<string|null>}
 */
export async function findUsernameByCustomEmail(customEmail) {
  if (!customEmail) return null;
  const cleanEmail = customEmail.trim().toLowerCase();

  // 1. Cek dari local users cache
  const localUsers = getLocalUsers();
  const foundLocal = localUsers.find(
    (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
  );
  if (foundLocal?.username) return foundLocal.username;

  // 2. Cek langsung dari Firestore database
  try {
    const q = query(collection(db, COLLECTION_NAME), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      if (data.username) return data.username;
    }
  } catch (e) {
    console.warn('Error querying user by email:', e);
  }
  return null;
}
export function getDefaultTeamUsers() {
  return [
    {
      uid: 'user-muhbar',
      name: 'Akbar',
      username: 'muhbar',
      email: usernameToInternalEmail('muhbar'),
      role: USER_ROLES.SUPER_ADMIN,
      title: 'Founder & Super Admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-nessa',
      name: 'Nessa',
      username: 'nessa',
      email: usernameToInternalEmail('nessa'),
      role: USER_ROLES.SUPER_ADMIN,
      title: 'Co-Founder & Super Admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-andin',
      name: 'Andin',
      username: 'andin',
      email: usernameToInternalEmail('andin'),
      role: USER_ROLES.STAFF,
      title: 'Staff & Host Live',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-ritza',
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
 * Membaca cache user dari localStorage dengan merge otomatis akun tim default
 */
export function getLocalUsers() {
  const defaultUsers = getDefaultTeamUsers();
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = new Map();
        defaultUsers.forEach((u) => map.set(u.username.toLowerCase(), u));
        parsed.forEach((u) => {
          if (u.username) {
            const prev = map.get(u.username.toLowerCase()) || {};
            map.set(u.username.toLowerCase(), { ...prev, ...u });
          } else if (u.uid) {
            map.set(u.uid, u);
          }
        });
        return Array.from(map.values());
      }
    }
  } catch (e) {
    console.warn('Error reading local users cache:', e);
  }
  return defaultUsers;
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
 * Memastikan akun tim awal ada di Firestore
 */
export async function ensureInitialTeamUsersInFirestore() {
  try {
    const defaultUsers = getDefaultTeamUsers();
    for (const u of defaultUsers) {
      const q = query(collection(db, COLLECTION_NAME), where('username', '==', u.username.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        const docRef = doc(db, COLLECTION_NAME, u.uid);
        await setDoc(docRef, u, { merge: true });
      }
    }
  } catch (e) {
    console.warn('Error auto-seeding team users to Firestore:', e);
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
  const cleanUsername = (username || '').toLowerCase();
  const docRef = doc(db, COLLECTION_NAME, uid);

  try {
    // 1. Cek langsung berdasarkan UID dokumen
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { uid, status: data.status || 'active', ...data };
    }

    // 2. Cek apakah ada profil berdasarkan username di Firestore
    if (cleanUsername) {
      const q = query(collection(db, COLLECTION_NAME), where('username', '==', cleanUsername));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const foundDoc = qSnap.docs[0];
        const data = foundDoc.data();
        // Simpan juga ke doc UID agar referensi selanjutnya instan
        await setDoc(docRef, { ...data, uid }, { merge: true });
        return { uid, status: data.status || 'active', ...data };
      }
    }
  } catch (err) {
    console.warn('Could not read user profile doc from Firestore, using default profile:', err);
  }

  // 3. Fallback profil bawaan jika belum ada di database
  const isFounder = ['muhbar', 'akbar', 'nessa', 'nesa', 'admin'].includes(cleanUsername);
  const defaultProfile = DEFAULT_USER_PROFILES[cleanUsername] || {
    name: username || 'User',
    username: cleanUsername,
    role: isFounder ? USER_ROLES.SUPER_ADMIN : USER_ROLES.STAFF,
    title: isFounder ? 'Super Admin' : 'Staff Fitbay',
    status: 'active',
  };

  const newProfile = {
    ...defaultProfile,
    email: email || usernameToInternalEmail(cleanUsername),
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(docRef, newProfile, { merge: true });
  } catch (err) {
    console.warn('Could not save user profile doc to Firestore:', err);
  }

  return { uid, ...newProfile };
}

/**
 * Memastikan akun email terdaftar di Firebase Auth
 * @param {string} email
 * @param {string} defaultPassword
 * @returns {Promise<string|null>}
 */
export async function ensureAuthAccountForEmail(email, defaultPassword = 'fitbay_temp_pass_2026') {
  if (!email || !email.includes('@')) return null;
  const cleanEmail = email.trim().toLowerCase();
  const secondaryAppName = `_SyncAuth_${Date.now()}`;
  let secondaryApp = null;
  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, defaultPassword);
    await firebaseSignOut(secondaryAuth);
    return cred.user.uid;
  } catch (e) {
    // Jika email sudah ada di Firebase Auth, tidak apa-apa
    return null;
  } finally {
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch (_) {}
    }
  }
}

/**
 * Membuat User Baru langsung oleh Super Admin tanpa mengganti sesi login yang aktif.
 * @param {object} param0
 * @returns {Promise<object>} Profil user yang baru dibuat
 */
export async function createUserByAdmin({
  name,
  username,
  email: customEmail,
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

  // Gunakan email asli jika diisi, atau format internal
  const effectiveEmail = (customEmail && customEmail.includes('@'))
    ? customEmail.trim().toLowerCase()
    : usernameToInternalEmail(cleanUsername);

  const secondaryAppName = `_TempAuth_${Date.now()}`;
  let secondaryApp = null;
  let newUid = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // Gunakan in-memory persistence agar tidak mengganggu session primary app
    await setPersistence(secondaryAuth, inMemoryPersistence);

    // Buat akun baru di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, effectiveEmail, password);
    newUid = userCredential.user.uid;

    await firebaseSignOut(secondaryAuth);
  } catch (error) {
    console.error('createUserByAdmin Auth error:', error);
    let errorMsg = error.message;
    if (error.code === 'auth/email-already-in-use') {
      // Email sudah terdaftar
    } else if (error.code === 'auth/weak-password') {
      errorMsg = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
      throw new Error(errorMsg);
    } else if (error.code === 'auth/invalid-email') {
      errorMsg = 'Format email tidak valid.';
      throw new Error(errorMsg);
    }
  } finally {
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
    }
  }

  const effectiveUid = newUid || `user_${cleanUsername}`;
  const userProfileData = {
    uid: effectiveUid,
    name: name.trim(),
    username: cleanUsername,
    email: effectiveEmail,
    role: role || USER_ROLES.STAFF,
    title: title.trim() || (role === USER_ROLES.SUPER_ADMIN ? 'Super Admin' : role === USER_ROLES.ADMIN ? 'Admin' : 'Staff Fitbay'),
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

  // Simpan ke Firestore dengan setDoc merge
  try {
    const userDocRef = doc(db, COLLECTION_NAME, effectiveUid);
    await setDoc(userDocRef, userProfileData, { merge: true });
  } catch (firestoreError) {
    console.warn('Firestore setDoc failed (using local cache backup):', firestoreError);
  }

  return userProfileData;
}

/**
 * Mengupdate data profil & role pengguna di Firestore & Local Storage
 * @param {string} uid
 * @param {object} updateData - { name, role, title, status, username }
 */
export async function updateUserProfileData(uid, updateData) {
  // Update local cache
  const currentUsers = getLocalUsers();
  const updatedUsers = currentUsers.map((u) => {
    if (u.uid === uid || (updateData.username && u.username?.toLowerCase() === updateData.username.toLowerCase())) {
      return { ...u, ...updateData, updatedAt: new Date().toISOString() };
    }
    return u;
  });
  saveLocalUsers(updatedUsers);

  // Update Firestore secara andal dengan setDoc merge: true
  try {
    const payload = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    // 1. Simpan/update langsung ke dokumen dengan ID uid
    if (uid) {
      const docRef = doc(db, COLLECTION_NAME, uid);
      await setDoc(docRef, payload, { merge: true });
    }

    // 2. Jika ada username, sinkronkan juga dokumen Firestore yang memiliki username tersebut
    if (updateData.username) {
      const cleanUser = updateData.username.trim().toLowerCase();
      const q = query(collection(db, COLLECTION_NAME), where('username', '==', cleanUser));
      const querySnap = await getDocs(q);
      querySnap.forEach(async (docItem) => {
        await setDoc(doc(db, COLLECTION_NAME, docItem.id), payload, { merge: true });
      });
    }
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
 * Mengirim email reset password ke pengguna (dengan link kustom ke tampilan web Fitbay.id)
 * @param {string} email
 */
export async function sendUserPasswordReset(email) {
  if (!email) throw new Error('Alamat email tidak boleh kosong');
  const cleanEmail = email.trim().toLowerCase();

  // Pastikan email terdaftar di Firebase Auth
  await ensureAuthAccountForEmail(cleanEmail);

  const origin = window.location.origin;
  const actionCodeSettings = {
    url: `${origin}/#/reset-password`,
    handleCodeInApp: true,
  };

  try {
    await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
  } catch (err) {
    console.warn('sendPasswordResetEmail with actionCodeSettings fallback:', err);
    await sendPasswordResetEmail(auth, cleanEmail);
  }
}

/**
 * Mengambil semua user
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (!snapshot.empty) {
      const firestoreUsers = snapshot.docs.map((docItem) => ({
        uid: docItem.id,
        status: 'active',
        ...docItem.data(),
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
 * Subscribe real-time list pengguna dari Firestore dengan deduplikasi dan merge data tim
 * @param {function} callback
 * @returns {function} unsubscribe function
 */
export function subscribeUsers(callback) {
  // 1. Panggil segera dengan data lokal agar render pertama langsung instan
  const initialLocal = getLocalUsers();
  callback(initialLocal);

  // 2. Auto-seed akun tim default jika belum ada di Firestore
  ensureInitialTeamUsersInFirestore().catch(() => {});

  const usersCollection = collection(db, COLLECTION_NAME);
  try {
    return onSnapshot(
      usersCollection,
      (snapshot) => {
        const defaultUsers = getDefaultTeamUsers();
        const userMap = new Map();

        // Masukkan default users terlebih dahulu sebagai base
        defaultUsers.forEach((u) => {
          if (u.username) userMap.set(u.username.toLowerCase(), u);
        });

        // Timpa dengan data Firestore yang paling mutakhir (realtime dari server)
        if (!snapshot.empty) {
          snapshot.docs.forEach((docItem) => {
            const data = docItem.data();
            const cleanUser = (data.username || '').toLowerCase();
            if (cleanUser) {
              const prev = userMap.get(cleanUser) || {};
              userMap.set(cleanUser, { ...prev, ...data, uid: docItem.id });
            } else {
              userMap.set(docItem.id, { uid: docItem.id, ...data });
            }
          });
        }

        const finalList = Array.from(userMap.values());
        saveLocalUsers(finalList);
        callback(finalList);
      },
      (error) => {
        console.warn('Error listening to users collection, using cached local data:', error);
        callback(getLocalUsers());
      }
    );
  } catch (e) {
    console.warn('Failed to attach onSnapshot listener:', e);
    callback(getDefaultTeamUsers());
    return () => {};
  }
}
