import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useSales } from '../../context/SalesContext';

export default function InventoryDetailModal({ isOpen, onClose, item, onMarkSold, onEdit }) {
  const { transactions } = useSales();

  if (!item) return null;

  const isSold = item.status === 'Terjual';
  const linkedTransaction = isSold && item.referensiTransaksiId
    ? transactions.find((t) => t.id === item.referensiTransaksiId)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail Barang: ${item.kodeBarang}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Header Banner */}
        <div className="p-4 rounded-2xl dark:bg-surface-300/60 bg-gray-50 border dark:border-white/5 border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center text-xl font-bold font-mono">
              🏷️
            </div>
            <div>
              <span className="font-mono font-bold text-accent text-sm tracking-wider">
                {item.kodeBarang}
              </span>
              <h3 className="font-bold text-base dark:text-white text-gray-900 leading-snug">
                {item.namaBarang}
              </h3>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isSold
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
            }`}
          >
            <span>{isSold ? '✅' : '⏳'}</span>
            <span>{item.status}</span>
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200">
            <span className="dark:text-gray-400 text-gray-500 font-medium">Kategori:</span>
            <p className="font-semibold dark:text-white text-gray-900 mt-0.5">{item.kategori}</p>
          </div>

          <div className="p-3 rounded-xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200">
            <span className="dark:text-gray-400 text-gray-500 font-medium">Pemilik Titipan:</span>
            <p className="font-semibold text-accent mt-0.5">{item.pemilikBarang}</p>
          </div>

          <div className="p-3 rounded-xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200">
            <span className="dark:text-gray-400 text-gray-500 font-medium">Harga Modal / Kesepakatan:</span>
            <p className="font-bold text-sm text-emerald-400 mt-0.5">
              {formatCurrency(item.hargaModal || 0)}
            </p>
          </div>

          <div className="p-3 rounded-xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200">
            <span className="dark:text-gray-400 text-gray-500 font-medium">Tanggal Masuk:</span>
            <p className="font-semibold dark:text-white text-gray-900 mt-0.5">
              {item.tanggalMasuk ? formatDate(item.tanggalMasuk) : '-'}
            </p>
          </div>
        </div>

        {/* Catatan / Keterangan */}
        {item.catatan && (
          <div className="p-3.5 rounded-xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200 text-xs">
            <span className="dark:text-gray-400 text-gray-500 font-medium block mb-1">
              Catatan Barang (Ukuran / Kondisi):
            </span>
            <p className="dark:text-gray-200 text-gray-800 whitespace-pre-wrap">{item.catatan}</p>
          </div>
        )}

        {/* Linked Sales Transaction Information */}
        {isSold && linkedTransaction && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span>🛒</span>
                <span>Terjual Pada Transaksi Penjualan</span>
              </span>
              <span>{formatDate(linkedTransaction.date)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/15">
              <div>
                <span className="text-gray-400">Harga Jual:</span>
                <p className="font-bold text-white text-sm">{formatCurrency(linkedTransaction.sellingPrice || 0)}</p>
              </div>
              <div>
                <span className="text-gray-400">Keuntungan Bersih:</span>
                <p className="font-bold text-emerald-400 text-sm">{formatCurrency(linkedTransaction.profit || 0)}</p>
              </div>
              <div>
                <span className="text-gray-400">Metode Pembayaran:</span>
                <p className="font-semibold text-gray-200">{linkedTransaction.paymentMethod || 'Transfer Bank'}</p>
              </div>
              <div>
                <span className="text-gray-400">Status Pembayaran:</span>
                <p className="font-semibold text-gray-200">{linkedTransaction.status || 'Terjual'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
            >
              ✏️ Edit Data
            </Button>

            {!isSold && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onMarkSold(item);
                }}
                className="shadow-md shadow-accent/25"
              >
                🏷️ Tandai Terjual
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
