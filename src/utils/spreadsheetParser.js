import * as XLSX from 'xlsx';

const KNOWN_OWNERS = ['akbar', 'nesa', 'nessa', 'ritza', 'andin', 'atun', 'bilah'];

/**
 * Cek apakah sebuah string merupakan nama pemilik yang dikenali
 */
function isKnownOwner(str) {
  if (!str) return false;
  const clean = String(str).trim().toLowerCase();
  return KNOWN_OWNERS.includes(clean);
}

/**
 * Normalisasi nama header agar fleksibel terhadap variasi penamaan di spreadsheet
 */
function normalizeHeaderKey(key) {
  if (!key) return '';
  const cleaned = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleaned.includes('namabarang') || cleaned.includes('namaitem') || cleaned.includes('itemname') || cleaned.includes('produk')) {
    return 'itemName';
  }
  if (cleaned.includes('pemilik') || cleaned.includes('owner') || cleaned.includes('penitip')) {
    return 'owner';
  }
  if (cleaned.includes('kategori') || cleaned.includes('category') || cleaned === 'kat') {
    return 'category';
  }
  if (cleaned.includes('hargamodal') || cleaned.includes('modal') || cleaned.includes('costprice') || cleaned.includes('hargabeli') || cleaned.includes('cost')) {
    return 'costPrice';
  }
  if (cleaned.includes('hargajual') || cleaned.includes('sellingprice') || cleaned.includes('jual') || cleaned.includes('harga') || cleaned === 'price') {
    return 'sellingPrice';
  }
  if (cleaned.includes('tanggal') || cleaned.includes('date') || cleaned === 'tgl') {
    return 'date';
  }
  if (cleaned.includes('metodepembayaran') || cleaned.includes('metode') || cleaned.includes('pembayaran') || cleaned.includes('paymentmethod') || cleaned === 'payment') {
    return 'paymentMethod';
  }
  if (cleaned.includes('status') || cleaned.includes('kondisi')) {
    return 'status';
  }
  if (cleaned === 'barang' || cleaned === 'nama' || cleaned === 'item') {
    return 'barangOrOwner';
  }
  return key;
}

/**
 * Membersihkan format nilai uang/angka (Mendukung format Rupiah Rp 10.000, 10.000, 10000)
 */
export function cleanCurrencyNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  // Jika formatnya memiliki koma sebagai desimal (contoh: 10.000,50)
  if (str.includes(',') && str.includes('.')) {
    // Hapus titik pemisah ribuan, ganti koma dengan titik desimal
    str = str.replace(/\./g, '').replace(',', '.');
    const numericOnly = str.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(numericOnly);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Jika format standar Indonesia (Rp 10.000 / 10.000 / 100.000)
  // Titik adalah pemisah ribuan, jadi hapus titik dan semua karakter non-angka
  const numericOnly = str.replace(/[^0-9-]/g, '');
  const parsed = parseInt(numericOnly, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format tanggal ke format YYYY-MM-DD
 */
export function parseSpreadsheetDate(rawDate, fallbackDate = new Date().toISOString().split('T')[0]) {
  if (!rawDate) return fallbackDate;

  // Jika berupa nomor serial Excel (misal 45123)
  if (typeof rawDate === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(rawDate);
      if (parsed) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      return fallbackDate;
    }
  }

  // Jika berupa string tanggal
  const str = String(rawDate).trim();
  if (!str) return fallbackDate;

  // Cek apakah sudah format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Cek format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Coba native Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return fallbackDate;
}

/**
 * Normalisasi nama pemilik
 */
function capitalizeOwner(name) {
  if (!name) return 'Akbar';
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Parse teks yang di-copy-paste langsung dari spreadsheet/excel atau tabel teks
 */
export function parsePastedText(rawText, fallbackDate = new Date().toISOString().split('T')[0]) {
  if (!rawText || !rawText.trim()) {
    throw new Error('Teks yang ditempel masih kosong.');
  }

  const lines = rawText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('Tidak ada baris data yang ditemukan.');
  }

  const parsedItems = [];

  lines.forEach((line, index) => {
    // Pisahkan baris berdasarkan tab (\t), koma (,), atau semicolon (;)
    let delimiter = '\t';
    if (line.includes('\t')) delimiter = '\t';
    else if (line.includes(';')) delimiter = ';';
    else if (line.includes(',')) delimiter = ',';

    const cols = line.split(delimiter).map(c => c.trim()).filter(c => c !== '');
    if (cols.length === 0) return;

    // Abaikan baris jika merupakan baris header (misal "barang	harga", "pemilik	harga", "no	nama")
    const firstColClean = cols[0].toLowerCase();
    const secondColClean = cols[1] ? cols[1].toLowerCase() : '';
    if (
      firstColClean === 'no' ||
      firstColClean === 'pemilik' ||
      firstColClean === 'nama barang' ||
      firstColClean === 'owner' ||
      (firstColClean === 'barang' && (secondColClean === 'harga' || secondColClean === 'harga jual' || secondColClean === 'price'))
    ) {
      return;
    }

    let owner = 'Akbar';
    let itemName = `Barang #${index + 1}`;
    let category = 'Baju';
    let costPrice = 0;
    let sellingPrice = 0;
    let paymentMethod = 'Transfer Bank';
    let status = 'Terjual';
    let date = fallbackDate;

    if (cols.length === 1) {
      sellingPrice = cleanCurrencyNumber(cols[0]);
    } else if (cols.length === 2) {
      // Pola: [Pemilik/Barang, Harga]
      const val1 = cols[0];
      const val2 = cols[1];

      const price2 = cleanCurrencyNumber(val2);
      if (price2 > 0) {
        sellingPrice = price2;
        if (isKnownOwner(val1)) {
          owner = capitalizeOwner(val1);
          itemName = `Barang ${owner}`;
        } else {
          itemName = val1;
        }
      } else {
        itemName = val1;
        sellingPrice = cleanCurrencyNumber(val2);
      }
    } else if (cols.length === 3) {
      // Pola: [Pemilik, Nama Barang, Harga] atau [No, Pemilik, Harga]
      if (!isNaN(cols[0]) && isNaN(cols[1])) {
        // [No, Pemilik, Harga]
        owner = capitalizeOwner(cols[1]);
        itemName = `Barang ${owner}`;
        sellingPrice = cleanCurrencyNumber(cols[2]);
      } else {
        // [Pemilik, Nama Barang, Harga]
        owner = capitalizeOwner(cols[0]);
        itemName = cols[1];
        sellingPrice = cleanCurrencyNumber(cols[2]);
      }
    } else if (cols.length === 4) {
      // Pola: [Pemilik, Nama Barang, Kategori, Harga]
      owner = capitalizeOwner(cols[0]);
      itemName = cols[1];
      category = cols[2] || 'Baju';
      sellingPrice = cleanCurrencyNumber(cols[3]);
    } else if (cols.length >= 5) {
      let offset = 0;
      if (!isNaN(cols[0])) {
        offset = 1;
      }
      owner = capitalizeOwner(cols[offset] || 'Akbar');
      itemName = cols[offset + 1] || `Barang ${owner}`;
      category = cols[offset + 2] || 'Baju';
      
      if (cols.length >= offset + 5) {
        costPrice = cleanCurrencyNumber(cols[offset + 3]);
        sellingPrice = cleanCurrencyNumber(cols[offset + 4]);
      } else {
        sellingPrice = cleanCurrencyNumber(cols[offset + 3]);
      }
    }

    if (sellingPrice > 0) {
      parsedItems.push({
        _rowId: index + 1,
        itemName,
        owner,
        category,
        costPrice,
        sellingPrice,
        paymentMethod,
        status,
        date,
      });
    }
  });

  if (parsedItems.length === 0) {
    throw new Error('Tidak dapat menemukan data transaksi dari teks yang ditempel.');
  }

  return parsedItems;
}

/**
 * Parse file spreadsheet (.xlsx, .xls, .csv) menjadi array of objects transaksi yang valid
 */
export async function parseSpreadsheetFile(file, fallbackDate) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('File spreadsheet tidak memiliki sheet.');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Konversi sheet ke JSON raw
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('Spreadsheet kosong atau tidak memiliki data baris.');
        }

        // Transform dan normalisasi data
        const parsedItems = [];

        rawRows.forEach((row, index) => {
          const item = {
            _rowId: index + 1,
            itemName: '',
            owner: 'Akbar',
            category: 'Baju',
            costPrice: 0,
            sellingPrice: 0,
            paymentMethod: 'Transfer Bank',
            status: 'Terjual',
            date: fallbackDate || new Date().toISOString().split('T')[0],
          };

          // Iterasi semua kunci di row
          Object.keys(row).forEach((key) => {
            const normalizedKey = normalizeHeaderKey(key);
            const val = row[key];

            if (normalizedKey === 'itemName') {
              item.itemName = String(val).trim();
            } else if (normalizedKey === 'owner') {
              item.owner = capitalizeOwner(String(val).trim());
            } else if (normalizedKey === 'barangOrOwner') {
              const strVal = String(val).trim();
              if (isKnownOwner(strVal)) {
                item.owner = capitalizeOwner(strVal);
                item.itemName = `Barang ${item.owner}`;
              } else {
                item.itemName = strVal;
              }
            } else if (normalizedKey === 'category') {
              item.category = String(val).trim() || 'Baju';
            } else if (normalizedKey === 'costPrice') {
              item.costPrice = cleanCurrencyNumber(val);
            } else if (normalizedKey === 'sellingPrice') {
              item.sellingPrice = cleanCurrencyNumber(val);
            } else if (normalizedKey === 'paymentMethod') {
              item.paymentMethod = String(val).trim() || 'Transfer Bank';
            } else if (normalizedKey === 'status') {
              item.status = String(val).trim() || 'Terjual';
            } else if (normalizedKey === 'date') {
              item.date = parseSpreadsheetDate(val, fallbackDate);
            }
          });

          // Jika harga jual valid
          if (item.sellingPrice > 0) {
            if (!item.itemName) {
              item.itemName = `Barang ${item.owner}`;
            }
            parsedItems.push(item);
          }
        });

        if (parsedItems.length === 0) {
          throw new Error('Tidak ditemukan data transaksi yang valid dalam file tersebut.');
        }

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Buat dan unduh template file Excel untuk impor data penjualan
 */
export function downloadSpreadsheetTemplate() {
  const sampleData = [
    {
      'Nama Barang': 'Cardi Abu',
      'Pemilik': 'Akbar',
      'Kategori': 'Baju',
      'Harga Modal': 0,
      'Harga Jual': 50000,
      'Tanggal': new Date().toISOString().split('T')[0],
      'Metode Pembayaran': 'Transfer Bank',
      'Status': 'Terjual',
    },
    {
      'Nama Barang': 'Celana Jeans Abu',
      'Pemilik': 'Nesa',
      'Kategori': 'Celana',
      'Harga Modal': 0,
      'Harga Jual': 60000,
      'Tanggal': new Date().toISOString().split('T')[0],
      'Metode Pembayaran': 'Transfer Bank',
      'Status': 'Terjual',
    },
    {
      'Nama Barang': 'Jaket Jeans',
      'Pemilik': 'Ritza',
      'Kategori': 'Jaket',
      'Harga Modal': 0,
      'Harga Jual': 25000,
      'Tanggal': new Date().toISOString().split('T')[0],
      'Metode Pembayaran': 'QRIS',
      'Status': 'Terjual',
    },
    {
      'Nama Barang': 'Vest Knit',
      'Pemilik': 'Andin',
      'Kategori': 'Baju',
      'Harga Modal': 0,
      'Harga Jual': 25000,
      'Tanggal': new Date().toISOString().split('T')[0],
      'Metode Pembayaran': 'Transfer Bank',
      'Status': 'Terjual',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set lebar kolom agar rapi saat dibuka di Excel
  worksheet['!cols'] = [
    { wch: 25 }, // Nama Barang
    { wch: 15 }, // Pemilik
    { wch: 15 }, // Kategori
    { wch: 15 }, // Harga Modal
    { wch: 15 }, // Harga Jual
    { wch: 15 }, // Tanggal
    { wch: 20 }, // Metode Pembayaran
    { wch: 15 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Penjualan');

  XLSX.writeFile(workbook, 'Fitbay_Template_Impor_Penjualan.xlsx');
}
