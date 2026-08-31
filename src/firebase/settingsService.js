import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';

const COLLECTION_NAME = 'settings';
const DOC_ID = 'profitSharing';
const LOCAL_STORAGE_KEY = 'fitbay_profit_sharing_config';

function getLocalConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading local profit sharing config:', e);
  }
  return PROFIT_SHARING_CONFIG;
}

function saveLocalConfig(config) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Error saving local profit sharing config:', e);
  }
}

/**
 * Real-time listener untuk konfigurasi pembagian hasil dari Firestore
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export function subscribeProfitSharingSettings(callback) {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const cfg = data.config || PROFIT_SHARING_CONFIG;
          saveLocalConfig(cfg);
          callback(cfg);
        } else {
          callback(PROFIT_SHARING_CONFIG);
        }
      },
      (error) => {
        console.warn('Settings onSnapshot error:', error);
        callback(getLocalConfig());
      }
    );
  } catch (err) {
    console.warn('Error attaching subscribeProfitSharingSettings:', err);
    callback(getLocalConfig());
    return () => {};
  }
}

/**
 * Mengambil konfigurasi persentase pembagian hasil dari Firestore
 * @returns {Promise<object>}
 */
export async function getProfitSharingSettings() {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      saveLocalConfig(data.config || PROFIT_SHARING_CONFIG);
      return data.config || PROFIT_SHARING_CONFIG;
    }

    // Jika belum ada di DB, simpan default
    await setDoc(docRef, {
      config: PROFIT_SHARING_CONFIG,
      updatedAt: new Date().toISOString(),
    });
    saveLocalConfig(PROFIT_SHARING_CONFIG);
    return PROFIT_SHARING_CONFIG;
  } catch (err) {
    console.warn('Could not fetch profit sharing settings from Firestore, using local fallback:', err);
    return getLocalConfig();
  }
}

/**
 * Menyimpan konfigurasi persentase pembagian hasil ke Firestore
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function saveProfitSharingSettings(config) {
  saveLocalConfig(config);
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    await setDoc(docRef, {
      config,
      updatedAt: new Date().toISOString(),
    });
    return config;
  } catch (err) {
    console.warn('Firestore write failed for settings, saved locally:', err);
    return config;
  }
}
