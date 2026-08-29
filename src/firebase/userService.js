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
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
 * Strategi:
 * 1. Buat secondary Firebase App instance (terisolasi dari primary app)
 * 2. Buat akun baru di Firebase Auth via secondary Auth
 * 3. Tulis profil ke Firestore via secondary Firestore 
 *    (secondary auth sudah terautentikasi sebagai user baru, 
 *     sehingga rule `allow create: if isAuthenticated()` terpenuhi)
 * 4. Sign out dari secondary Auth & hapus secondary app
 * 5. Primary app tetap login sebagai Super Admin — sesi aman!
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

  // Inisialisasi Firebase App sekunder dengan nama unik
  const secondaryAppName = `SecondaryAuthApp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let secondaryApp = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = getFirestore(secondaryApp);

    // 1. Buat user baru di Firebase Authentication via secondary auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUid = userCredential.user.uid;

    // 2. Siapkan data profil user
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

    // 3. Tulis profil ke Firestore memakai secondary Firestore
    //    (secondary auth sudah login sebagai user baru → rule isAuthenticated() terpenuhi)
    const userDocRef = doc(secondaryDb, COLLECTION_NAME, newUid);
    await setDoc(userDocRef, userProfileData);

    // 4. Sign out dari secondary auth sebelum menghapus secondary app
    await firebaseSignOut(secondaryAuth);

    return {
      uid: newUid,
      ...userProfileData,
    };
  } catch (error) {
    console.error('createUserByAdmin error:', error);
    let errorMsg = error.message;
    if (error.code === 'auth/email-already-in-use') {
      errorMsg = `Username "${cleanUsername}" sudah terdaftar. Silakan gunakan username lain.`;
    } else if (error.code === 'auth/weak-password') {
      errorMsg = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    } else if (error.code === 'auth/invalid-email') {
      errorMsg = 'Format email dari username tidak valid.';
    }
    throw new Error(errorMsg);
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (err) {
        // Ignore — secondary app cleanup is best-effort
      }
    }
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
