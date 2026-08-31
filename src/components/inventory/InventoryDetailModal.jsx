import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useSales } from '../../context/SalesContext';
import { ORDER_SOURCE_COLORS } from '../../constants/profitSharingConfig';
import ShippingLabelModal from '../sales/ShippingLabelModal';
import toast from 'react-hot-toast';

export default function InventoryDetailModal({ isOpen, onClose, item, onMarkSold, onEdit }) {
  const { transactions } = useSales();
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);

  if (!item) return null;

  const isSold = item.status === 'Terjual';
  const linkedTransaction = isSold
    ? transactions.find(
        (t) =>
          (item.referensiTransaksiId && t.id === item.referensiTransaksiId) ||
          (item.kodeBarang && t.kodeBarang === item.kodeBarang)
      )
    : null;

  // Sinkronisasi data pengiriman dari transaksi atau item inventaris
  const effectiveRecipientName = linkedTransaction?.namaPenerima || item.namaPenerima || '';
  const effectivePhone = linkedTransaction?.noHpPenerima || item.noHpPenerima || '';
  const effectiveAddress = linkedTransaction?.alamatPenerima || item.alamatPenerima || '';
  const effectiveSource = linkedTransaction?.sumberPesanan || item.sumberPesanan || 'WhatsApp';
  const effectiveCourier = linkedTransaction?.ekspedisi || item.ekspedisi || 'J&T Express';
  const effectiveResi = linkedTransaction?.resi || item.resi || '';
  const effectiveSellingPrice = linkedTransaction?.sellingPrice || item.sellingPrice || 0;
  const effectiveProfit = linkedTransaction?.profit || (effectiveSellingPrice - (item.hargaModal || 0));
  const effectiveDate = linkedTransaction?.date || item.tanggalTerjual || item.tanggalMasuk;

  const sourceColor = ORDER_SOURCE_COLORS[effectiveSource] || ORDER_SOURCE_COLORS['WhatsApp'];

  // Synthetic transaction payload for printing label directly from Inventory Modal
  const printTransactionPayload = {
    ...item,
    ...(linkedTransaction || {}),
    id: linkedTransaction?.id || item.referensiTransaksiId || `inv_${item.id}`,
    kodeBarang: item.kodeBarang,
    itemName: item.namaBarang,
    sellingPrice: effectiveSellingPrice,
    namaPenerima: effectiveRecipientName,
    noHpPenerima: effectivePhone,
    alamatPenerima: effectiveAddress,
    sumberPesanan: effectiveSource,
    ekspedisi: effectiveCourier,
    resi: effectiveResi,
    date: effectiveDate,
  };

  const handleCopyAddress = () => {
    if (!effectiveAddress) {
      toast.error('Alamat belum diinput untuk barang ini');
      return;
    }
    const text = `Penerima: ${effectiveRecipientName || '-'}\nNo. HP: ${effectivePhone || '-'}\nAlamat: ${effectiveAddress}\nEkspedisi: ${effectiveCourier || 'Reguler'}\nBarang: ${item.namaBarang} (${item.kodeBarang})`;
    navigator.clipboard.writeText(text);
    toast.success(`Alamat pengiriman untuk ${effectiveRecipientName || item.namaBarang} berhasil disalin! 📋`);
  };

  return (
    <>
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

          {/* ========================================================================= */}
          {/* INFORMASI TRANSAKSI PENJUALAN & ALAMAT PENGIRIMAN */}
          {/* ========================================================================= */}
          {isSold && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🛒</span>
                  <div>
                    <h4 className="font-bold text-emerald-400">
                      Terjual Pada Transaksi Penjualan
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      {effectiveDate ? formatDate(effectiveDate) : '-'}
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium ${sourceColor.bg} ${sourceColor.text}`}>
                  <span>{sourceColor.icon}</span>
                  <span>{effectiveSource}</span>
                </span>
              </div>

              {/* Rincian Harga & Profit */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/15">
                <div>
                  <span className="text-gray-400">Harga Jual:</span>
                  <p className="font-bold text-white text-sm">{formatCurrency(effectiveSellingPrice)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Keuntungan Bersih:</span>
                  <p className="font-bold text-emerald-400 text-sm">{formatCurrency(effectiveProfit)}</p>
                </div>
              </div>

              {/* Data Alamat & Pengiriman Penerima */}
              {effectiveRecipientName || effectiveAddress ? (
                <div className="p-3 rounded-xl dark:bg-surface-300/80 bg-white/80 border dark:border-white/5 border-gray-200 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-accent uppercase text-[10px] tracking-wider">
                      📦 Data Penerima & Pengiriman
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all flex items-center gap-1"
                    >
                      <span>📋 Salin Alamat</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold dark:text-white text-gray-900">
                      {effectiveRecipientName || 'Nama belum diisi'}{' '}
                      <span className="font-normal font-mono text-gray-400">
                        ({effectivePhone || '-'})
                      </span>
                    </p>
                    <p className="dark:text-gray-300 text-gray-700 leading-relaxed text-[11px]">
                      {effectiveAddress || 'Alamat belum diinput'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[10px] text-gray-400">
                    <span>Kurir: <strong className="text-white">{effectiveCourier}</strong></span>
                    {effectiveResi && <span>· Resi: <strong className="text-accent">{effectiveResi}</strong></span>}
                  </div>
                </div>
              ) : null}

              {/* Action Cetak Label Pengiriman Langsung dari Data Barang */}
              <div className="flex items-center justify-between pt-2 border-t border-emerald-500/15">
                <span className="text-[11px] text-gray-400">
                  {effectiveSource === 'Shopee' ? 'Label otomatis dari Shopee' : 'Siap cetak label pengiriman thermal'}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsShippingModalOpen(true)}
                  className="text-xs py-1"
                >
                  🖨️ Cetak Label (10x15)
                </Button>
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t dark:border-white/5 border-gray-200">
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>

            <div className="flex items-center gap-2">
              {onEdit && (
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
              )}

              {!isSold && onMarkSold && (
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

      {/* Modal Cetak Label Pengiriman */}
      {isShippingModalOpen && (
        <ShippingLabelModal
          isOpen={isShippingModalOpen}
          onClose={() => setIsShippingModalOpen(false)}
          transaction={printTransactionPayload}
        />
      )}
    </>
  );
}
