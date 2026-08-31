import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const SETTINGS_DOC_ID = 'store_config';
const LOCAL_STORAGE_KEY = 'fitbay_store_config_cache';

export const DEFAULT_STORE_CONFIG = {
  storeName: 'Fitbay.id',
  storePhone: '085121009699',
  storeCity: 'Jakarta',
  storeAddress: 'Fitbay.id Preloved & Thrift Store, Jakarta Selatan',
  storeInstagram: '@fitbay.id',
  storeTikTok: '@fitbay.id',
  footerNote: 'Terima kasih telah berbelanja di Fitbay.id! Jangan lupa unboxing video.',
};

export function getLocalStoreConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_STORE_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error reading local store config:', e);
  }
  return DEFAULT_STORE_CONFIG;
}

export function saveLocalStoreConfig(config) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Error saving local store config:', e);
  }
}

export async function getStoreConfig() {
  const localConfig = getLocalStoreConfig();
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const merged = { ...DEFAULT_STORE_CONFIG, ...data };
      saveLocalStoreConfig(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Error fetching store config from Firestore:', err);
  }
  return localConfig;
}

export async function updateStoreConfig(newConfig) {
  const updated = { ...DEFAULT_STORE_CONFIG, ...newConfig, updatedAt: new Date().toISOString() };
  saveLocalStoreConfig(updated);
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.warn('Error updating store config in Firestore:', err);
  }
  return updated;
}
