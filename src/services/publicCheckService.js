import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/firebaseConfig';

/**
 * Memanggil Cloud Function cekBarangPublik di server
 * @param {string} query - Nama atau No. HP penitip
 * @returns {Promise<object>}
 */
export async function searchOwnerItemsPublic(query) {
  if (!query || query.trim().length < 2) {
    return {
      found: false,
      message: 'Masukkan minimal 2 karakter kata kunci pencarian.',
    };
  }

  try {
    const cekBarangFn = httpsCallable(functions, 'cekBarangPublik');
    const result = await cekBarangFn({ query: query.trim() });
    return result.data;
  } catch (error) {
    console.error('Cloud function search error:', error);
    if (error.code === 'functions/resource-exhausted') {
      throw new Error('Terlalu banyak permintaan pencarian. Mohon tunggu 1 menit sebelum mencoba lagi.');
    }
    throw new Error(error.message || 'Gagal menghubungi server untuk pencarian data.');
  }
}
