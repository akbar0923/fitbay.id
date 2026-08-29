import { useState, useRef } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { INITIAL_SPREADSHEET_DATA } from '../../constants/initialSalesData';
import { formatCurrency } from '../../utils/formatCurrency';
import { parseSpreadsheetFile, parsePastedText, downloadSpreadsheetTemplate } from '../../utils/spreadsheetParser';
import toast from 'react-hot-toast';

export default function ImportSpreadsheetModal({ isOpen, onClose, onImportBatch }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste'
  const [items, setItems] = useState([]);
  const [fileInfo, setFileInfo] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef(null);

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0);

  // Reset state when closing or opening
  const handleClose = () => {
    if (loading) return;
    setItems([]);
    setFileInfo(null);
    setPastedText('');
    setProgress(0);
    onClose();
  };

  // Load static initial data (24 items)
  const handleLoadInitialData = () => {
    const defaultData = INITIAL_SPREADSHEET_DATA.map((item, idx) => ({
      _rowId: idx + 1,
      itemName: item.itemName,
      owner: item.owner,
      category: item.category,
      costPrice: Number(item.costPrice || 0),
      sellingPrice: Number(item.sellingPrice),
      paymentMethod: 'Transfer Bank',
      status: item.status || 'Terjual',
      date: date,
    }));

    setItems(defaultData);
    setFileInfo({
      name: 'Data Bawaan Fitbay.id (Seed Data)',
      size: '24 item',
      isDefault: true,
    });
    toast.success('24 data contoh berhasil dimuat!');
  };

  // Process uploaded file
  const handleFileProcess = async (file) => {
    if (!file) return;

    // Check extension
    const validExts = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExts.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      toast.error('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv');
      return;
    }

    try {
      setParsing(true);
      const parsed = await parseSpreadsheetFile(file, date);
      setItems(parsed);
      setFileInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        isDefault: false,
      });
      toast.success(`Berhasil membaca ${parsed.length} transaksi dari file!`);
    } catch (err) {
      console.error('Error parsing spreadsheet:', err);
      toast.error(err.message || 'Gagal membaca file spreadsheet.');
    } finally {
      setParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Process pasted text
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      toast.error('Silakan tempel teks data spreadsheet terlebih dahulu.');
      return;
    }

    try {
      setParsing(true);
      const parsed = parsePastedText(pastedText, date);
      setItems(parsed);
      setFileInfo({
        name: 'Data Teks yang Ditempel (Copy-Paste)',
        size: `${parsed.length} transaksi`,
        isDefault: false,
      });
      toast.success(`Berhasil memproses ${parsed.length} transaksi dari teks!`);
    } catch (err) {
      console.error('Error parsing pasted text:', err);
      toast.error(err.message || 'Format teks tidak dapat dibaca.');
    } finally {
      setParsing(false);
    }
  };

  // File input change handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  // Delete a row from preview
  const handleDeleteRow = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Clear loaded file / data
  const handleClearData = () => {
    setItems([]);
    setFileInfo(null);
  };

  // Execute batch import to Firestore
  const handleImport = async () => {
    if (items.length === 0) {
      toast.error('Tidak ada data transaksi untuk diimpor.');
      return;
    }

    try {
      setLoading(true);
      setProgress(0);

      const itemsToImport = items.map((item) => ({
        itemName: item.itemName,
        ownerName: item.owner || 'Akbar',
        category: item.category || 'Baju',
        costPrice: Number(item.costPrice || 0),
        sellingPrice: Number(item.sellingPrice || 0),
        paymentMethod: item.paymentMethod || 'Transfer Bank',
        status: item.status || 'Terjual',
        date: item.date || date,
      }));

      await onImportBatch(itemsToImport, (current, total) => {
        setProgress(Math.round((current / total) * 100));
      });

      toast.success(`Berhasil mengimpor ${itemsToImport.length} transaksi ke Firestore!`);
      handleClose();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Gagal mengimpor beberapa transaksi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Impor Data Spreadsheet Penjualan"
      size="xl"
    >
      <div className="space-y-4">
        {/* Top Control: Quick Actions & Date */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl dark:bg-white/[0.02] bg-gray-50 border dark:border-white/5 border-gray-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider dark:text-gray-400 text-gray-500">
                Pilih atau Unggah File
              </span>
            </div>
            <p className="text-xs dark:text-gray-500 text-gray-500">
              Unggah file Excel/CSV, tempel teks, atau gunakan data bawaan template
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadSpreadsheetTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300 dark:text-gray-300 text-gray-700 hover:dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
              title="Unduh format spreadsheet contoh"
            >
              <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3" />
              </svg>
              Unduh Template Excel
            </button>

            <button
              type="button"
              onClick={handleLoadInitialData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300 dark:text-gray-300 text-gray-700 hover:dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5 text-purple" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Muat Data Bawaan (24 Item)
            </button>

            <div className="flex items-center gap-1.5 pl-2 border-l dark:border-white/10 border-gray-200">
              <label className="text-xs dark:text-gray-400 text-gray-500 whitespace-nowrap">Tgl Default:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
                className="px-2 py-1 rounded-lg text-xs dark:bg-surface-200 bg-white dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {/* Method Tabs if no items loaded */}
        {items.length === 0 && (
          <div className="flex items-center gap-2 border-b dark:border-white/10 border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'upload'
                  ? 'bg-accent text-dark-800 shadow-sm'
                  : 'dark:text-gray-400 text-gray-600 hover:dark:text-white hover:text-gray-900'
              }`}
            >
              📁 Unggah File (.xlsx / .csv)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'paste'
                  ? 'bg-accent text-dark-800 shadow-sm'
                  : 'dark:text-gray-400 text-gray-600 hover:dark:text-white hover:text-gray-900'
              }`}
            >
              📋 Tempel / Paste Teks Langsung
            </button>
          </div>
        )}

        {/* Upload Dropzone / Paste Area */}
        {items.length === 0 ? (
          activeTab === 'upload' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                isDragOver
                  ? 'border-accent bg-accent/5 scale-[0.99]'
                  : 'dark:border-white/10 border-gray-300 dark:bg-white/[0.01] bg-gray-50/50 hover:dark:border-accent/50 hover:border-accent/50 hover:bg-accent/[0.02]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl dark:bg-surface-300 bg-emerald-50 text-accent flex items-center justify-center shadow-inner">
                {parsing ? (
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold dark:text-white text-gray-800">
                  {parsing ? 'Membaca data spreadsheet...' : 'Klik untuk memilih file atau Drag & Drop di sini'}
                </p>
                <p className="text-xs dark:text-gray-400 text-gray-500 mt-1">
                  Mendukung format Microsoft Excel (.xlsx, .xls) dan CSV (.csv)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] dark:text-gray-500 text-gray-400">
                <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-surface-300">.XLSX</span>
                <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-surface-300">.XLS</span>
                <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-surface-300">.CSV</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Tempel data di sini dari Excel, Google Sheets, atau WhatsApp...&#10;Contoh:&#10;Ritza	Rp10.000&#10;Nesa	Rp15.000&#10;Andin	Rp60.000"
                  className="w-full p-3 rounded-xl text-xs font-mono dark:bg-surface-300 bg-gray-50 dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] dark:text-gray-500 text-gray-400">
                  Sistem mendukung format <code>[Pemilik] [Harga]</code> atau tabel multi-kolom.
                </p>
                <Button
                  size="sm"
                  onClick={handleProcessPastedText}
                  disabled={!pastedText.trim() || parsing}
                >
                  {parsing ? 'Memproses...' : 'Proses Data Teks'}
                </Button>
              </div>
            </div>
          )
        ) : (
          /* File Loaded Header & Switch Button */
          <div className="flex items-center justify-between p-3 rounded-xl dark:bg-accent/10 bg-emerald-50 border dark:border-accent/20 border-emerald-200 text-xs">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-accent text-dark-800 font-bold flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="truncate">
                <p className="font-semibold dark:text-white text-gray-900 truncate">
                  {fileInfo?.name || 'File Spreadsheet'}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  {items.length} transaksi terbaca ({fileInfo?.size})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'upload') {
                    fileInputRef.current?.click();
                  } else {
                    handleClearData();
                  }
                }}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-lg font-medium text-accent hover:bg-accent/10 transition-colors"
              >
                Ganti Data
              </button>
              <button
                type="button"
                onClick={handleClearData}
                disabled={loading}
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Hapus data dan reset"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Summary Metrics (Only when items loaded) */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-medium">Total Barang</p>
              <p className="text-base font-bold dark:text-white text-gray-900">{items.length} item</p>
            </div>
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-medium">Total Penjualan</p>
              <p className="text-base font-bold text-accent">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-medium">70% Pemilik</p>
              <p className="text-base font-bold text-emerald-400">{formatCurrency(totalAmount * 0.7)}</p>
            </div>
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-medium">10% Operational</p>
              <p className="text-base font-bold text-purple">{formatCurrency(totalAmount * 0.1)}</p>
            </div>
          </div>
        )}

        {/* Data Preview Table */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
              <span>Pratinjau Data ({items.length} Baris)</span>
              <span className="text-[11px]">Anda dapat menghapus baris yang tidak ingin diimpor</span>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border dark:border-white/5 border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 dark:bg-surface-300 bg-gray-100 border-b dark:border-white/5 border-gray-200 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">No</th>
                    <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Tanggal</th>
                    <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Pemilik</th>
                    <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Nama Barang</th>
                    <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Kategori</th>
                    <th className="px-3 py-2 text-right font-semibold dark:text-gray-400 text-gray-600">Modal</th>
                    <th className="px-3 py-2 text-right font-semibold dark:text-gray-400 text-gray-600">Harga Jual</th>
                    <th className="px-3 py-2 text-center font-semibold dark:text-gray-400 text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 group">
                      <td className="px-3 py-2 dark:text-gray-500 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 dark:text-gray-400 text-gray-500 whitespace-nowrap">{item.date}</td>
                      <td className="px-3 py-2 font-medium dark:text-accent text-accent-dark">{item.owner}</td>
                      <td className="px-3 py-2 dark:text-white text-gray-900 max-w-[160px] truncate" title={item.itemName}>
                        {item.itemName}
                      </td>
                      <td className="px-3 py-2 dark:text-gray-400 text-gray-600">
                        <span className="px-2 py-0.5 rounded text-[10px] dark:bg-surface-300 bg-gray-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right dark:text-gray-400 text-gray-600">
                        {item.costPrice > 0 ? formatCurrency(item.costPrice) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-400 whitespace-nowrap">
                        {formatCurrency(item.sellingPrice)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          disabled={loading}
                          className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Hapus baris ini"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress bar during import */}
        {loading && (
          <div className="space-y-1.5 animate-fade-in p-3 rounded-xl dark:bg-surface-300 bg-gray-50 border dark:border-white/5 border-gray-200">
            <div className="flex justify-between text-xs dark:text-gray-300 text-gray-700 font-medium">
              <span>Mengimpor transaksi ke Firestore...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-white/5 border-gray-200">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {items.length > 0 ? (
              <span>Siap mengimpor <strong className="text-accent">{items.length}</strong> transaksi</span>
            ) : (
              <span>Belum ada data dipilih</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
              Batal
            </Button>
            <Button
              onClick={handleImport}
              loading={loading}
              disabled={items.length === 0 || loading}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {items.length > 0 ? `Impor ${items.length} Transaksi` : 'Pilih / Tempel Data Terlebih Dahulu'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
