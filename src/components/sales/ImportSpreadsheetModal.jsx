import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { INITIAL_SPREADSHEET_DATA } from '../../constants/initialSalesData';
import { formatCurrency } from '../../utils/formatCurrency';
import toast from 'react-hot-toast';

export default function ImportSpreadsheetModal({ isOpen, onClose, onImportBatch }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const totalAmount = INITIAL_SPREADSHEET_DATA.reduce((sum, item) => sum + item.sellingPrice, 0);

  const handleImport = async () => {
    try {
      setLoading(true);
      setProgress(0);

      const itemsToImport = INITIAL_SPREADSHEET_DATA.map((item) => ({
        itemName: item.itemName,
        ownerName: item.owner,
        category: item.category,
        costPrice: Number(item.costPrice || 0),
        sellingPrice: Number(item.sellingPrice),
        paymentMethod: 'Transfer Bank',
        status: item.status || 'Terjual',
        date: date,
      }));

      await onImportBatch(itemsToImport, (current, total) => {
        setProgress(Math.round((current / total) * 100));
      });

      toast.success(`Berhasil mengimpor ${itemsToImport.length} transaksi!`);
      onClose();
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
      onClose={onClose}
      title="Impor Data Spreadsheet Penjualan"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm dark:text-gray-400 text-gray-600">
          Sistem akan memasukkan <span className="font-semibold text-accent">{INITIAL_SPREADSHEET_DATA.length} transaksi</span> dari catatan spreadsheet ke database Firestore dengan perhitungan pembagian hasil otomatis (70% Pemilik, 10% Operasional, 5% Akbar, Nesa, Andin, Ritza).
        </p>

        {/* Date Selector */}
        <div className="p-4 rounded-xl dark:bg-white/[0.02] bg-gray-50 border dark:border-white/5 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1">
              Tanggal Transaksi
            </label>
            <p className="text-xs dark:text-gray-500 text-gray-400">
              Semua item yang diimpor akan dicatat pada tanggal ini
            </p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-sm dark:bg-surface-200 bg-white 
              dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {/* Summary Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
            <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">Total Barang</p>
            <p className="text-base font-bold dark:text-white text-gray-900">{INITIAL_SPREADSHEET_DATA.length} item</p>
          </div>
          <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
            <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">Total Penjualan</p>
            <p className="text-base font-bold text-accent">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
            <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">70% Pemilik</p>
            <p className="text-base font-bold text-emerald-400">{formatCurrency(totalAmount * 0.7)}</p>
          </div>
          <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
            <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">10% Operational</p>
            <p className="text-base font-bold text-purple">{formatCurrency(totalAmount * 0.1)}</p>
          </div>
        </div>

        {/* Preview List */}
        <div className="max-h-60 overflow-y-auto rounded-xl border dark:border-white/5 border-gray-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 dark:bg-surface-300 bg-gray-100 border-b dark:border-white/5 border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">No</th>
                <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Pemilik</th>
                <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Nama Barang</th>
                <th className="px-3 py-2 text-left font-semibold dark:text-gray-400 text-gray-600">Kategori</th>
                <th className="px-3 py-2 text-right font-semibold dark:text-gray-400 text-gray-600">Harga Jual</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5 divide-gray-100">
              {INITIAL_SPREADSHEET_DATA.map((item, idx) => (
                <tr key={idx} className="dark:hover:bg-white/[0.02] hover:bg-gray-50">
                  <td className="px-3 py-2 dark:text-gray-500 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium dark:text-accent text-accent-dark">{item.owner}</td>
                  <td className="px-3 py-2 dark:text-white text-gray-900">{item.itemName}</td>
                  <td className="px-3 py-2 dark:text-gray-400 text-gray-600">{item.category}</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-400">{formatCurrency(item.sellingPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Progress bar during import */}
        {loading && (
          <div className="space-y-1.5 animate-fade-in">
            <div className="flex justify-between text-xs dark:text-gray-400 text-gray-600">
              <span>Mengimpor ke Firestore...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleImport} loading={loading}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Impor {INITIAL_SPREADSHEET_DATA.length} Transaksi Sekarang
          </Button>
        </div>
      </div>
    </Modal>
  );
}
