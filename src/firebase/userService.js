import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { DEFAULT_USER_PROFILES, USER_ROLES } from '../constants/profitSharingConfig';

const COLLECTION_NAME = 'users';

const ADMIN_USERNAMES = ['muhbar', 'nessa', 'admin', 'akbar', 'nesa'];

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
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(docRef, updatedData);
        return { uid, ...updatedData };
      }
      return { uid, ...data };
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
  };

  const newProfile = {
    ...defaultProfile,
    email: email || '',
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
 * Mengupdate role pengguna (hanya bisa dilakukan Admin)
 * @param {string} uid
 * @param {string} newRole
 */
export async function updateUserRole(uid, newRole) {
  const docRef = doc(db, COLLECTION_NAME, uid);
  await updateDoc(docRef, {
    role: newRole,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Mengambil semua user dari Firestore
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  }));
}
