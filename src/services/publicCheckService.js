/**
 * Memanggil Vercel Serverless Endpoint /api/cek-barang
 * @param {string} query - Nama atau No. HP penitip
 * @returns {Promise<object>}
 */
export async function searchOwnerItemsPublic(query) {
  const clean = (query || '').trim();
  if (!clean || clean.length < 2) {
    return {
      found: false,
      message: 'Masukkan minimal 2 karakter kata kunci pencarian.',
    };
  }

  try {
    const response = await fetch('/api/cek-barang', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: clean }),
    });

    if (response.status === 429) {
      throw new Error('Terlalu banyak permintaan pencarian. Mohon tunggu 1 menit sebelum mencoba lagi.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Terjadi kesalahan server (${response.status})`);
    }

    return data;
  } catch (error) {
    console.error('Error contacting /api/cek-barang endpoint:', error);
    throw new Error(error.message || 'Gagal menghubungi server untuk pencarian data.');
  }
}
