import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useSales } from '../../context/SalesContext';
import { useOwners } from '../../context/OwnerContext';
import { calculateProfitSharing } from '../../utils/calculateProfitSharing';
import { updateTransactionDoc } from '../../firebase/firestoreService';
import {
  CATEGORIES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  ORDER_SOURCES,
  SHIPPING_COURIERS,
} from '../../constants/profitSharingConfig';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import toast from 'react-hot-toast';

export default function BulkEditSalesModal({
  isOpen,
  onClose,
  selectedTransactions = [],
  onSuccess,
}) {
  const { profitSharingConfig } = useSales();
  const { owners } = useOwners();

  // Active fields toggles (which fields to apply to selected transactions)
  const [activeFields, setActiveFields] = useState({
    status: false,
    sumberPesanan: false,
    paymentMethod: false,
    ekspedisi: false,
    category: false,
    ownerName: false,
    date: false,
    notes: false,
  });

  // Form values for bulk edit
  const [formValues, setFormValues] = useState({
    status: 'Terjual',
    sumberPesanan: 'WhatsApp',
    paymentMethod: 'Transfer Bank',
    ekspedisi: 'J&T Express',
    category: 'Baju',
    ownerName: owners[0]?.name || 'Akbar',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    notesMode: 'append', // 'replace' | 'append'
  });

  const [submitting, setSubmitting] = useState(false);
  const [showPreviewList, setShowPreviewList] = useState(false);

  const toggleField = (field) => {
    setActiveFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleValueChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isAnyFieldActive = Object.values(activeFields).some(Boolean);
  const activeCount = Object.values(activeFields).filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAnyFieldActive) {
      toast.error('Pilih setidaknya satu bidang (field) yang ingin diperbarui secara massal.');
      return;
    }

    if (selectedTransactions.length === 0) {
      toast.error('Tidak ada transaksi yang dipilih.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(`Memperbarui ${selectedTransactions.length} transaksi...`);

    try {
      // Cari data pemilik baru jika field ownerName diaktifkan
      let targetOwnerObj = null;
      if (activeFields.ownerName) {
        targetOwnerObj = owners.find(
          (o) => (o.name || '').toLowerCase() === formValues.ownerName.toLowerCase()
        );
      }

      const updatePromises = selectedTransactions.map(async (tx) => {
        const updatedFields = {};

        // 1. Status
        if (activeFields.status) {
          updatedFields.status = formValues.status;
        }

        // 2. Sumber Pesanan
        if (activeFields.sumberPesanan) {
          updatedFields.sumberPesanan = formValues.sumberPesanan;
        }

        // 3. Metode Pembayaran
        if (activeFields.paymentMethod) {
          updatedFields.paymentMethod = formValues.paymentMethod;
        }

        // 4. Ekspedisi
        if (activeFields.ekspedisi) {
          updatedFields.ekspedisi = formValues.ekspedisi;
        }

        // 5. Kategori
        if (activeFields.category) {
          updatedFields.category = formValues.category;
        }

        // 6. Tanggal Transaksi
        if (activeFields.date) {
          updatedFields.date = formValues.date;
        }

        // 7. Catatan
        if (activeFields.notes) {
          if (formValues.notesMode === 'replace') {
            updatedFields.notes = formValues.notes;
          } else {
            const existingNotes = tx.notes ? `${tx.notes} | ` : '';
            updatedFields.notes = `${existingNotes}${formValues.notes}`.trim();
          }
        }

        // 8. Pemilik Barang & Kalkulasi Ulang Bagi Hasil
        if (activeFields.ownerName) {
          updatedFields.ownerName = formValues.ownerName;

          let schemeToUse = profitSharingConfig;
          const isCustom = targetOwnerObj?.isCustomScheme && targetOwnerObj?.customScheme;

          if (isCustom) {
            schemeToUse = {};
            Object.keys(profitSharingConfig).forEach((k) => {
              schemeToUse[k] = {
                ...profitSharingConfig[k],
                percentage: Number(targetOwnerObj.customScheme[k] || 0),
              };
            });
            updatedFields.ownerCustomScheme = targetOwnerObj.customScheme;
            updatedFields.skemaCustom = targetOwnerObj.customScheme;
          } else {
            updatedFields.ownerCustomScheme = null;
            updatedFields.skemaCustom = null;
          }

          const { profit, sharing } = calculateProfitSharing(
            Number(tx.sellingPrice || 0),
            Number(tx.costPrice || 0),
            schemeToUse
          );

          updatedFields.profit = profit;
          updatedFields.profitSharing = sharing;
        }

        updatedFields.updatedAt = new Date().toISOString();

        // Update ke Firestore
        await updateTransactionDoc(tx.id, updatedFields);
        return { id: tx.id, ...tx, ...updatedFields };
      });

      await Promise.all(updatePromises);

      toast.success(
        `Berhasil memperbarui ${selectedTransactions.length} transaksi penjualan! 🎉`,
        { id: toastId }
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error during bulk edit sales:', err);
      toast.error('Gagal memperbarui transaksi secara massal: ' + (err.message || 'Coba lagi'), {
        id: toastId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Massal Transaksi Penjualan (${selectedTransactions.length} Dipilih)`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Banner Info & Petunjuk */}
        <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 text-xs dark:text-accent text-accent-dark flex items-start gap-3">
          <span className="text-xl">✏️</span>
          <div>
            <p className="font-bold text-sm dark:text-white text-gray-900">
              Ubah Data {selectedTransactions.length} Transaksi Sekaligus
            </p>
            <p className="text-gray-400 mt-0.5">
              Centang kotak pada field yang ingin diubah. Field yang tidak dicentang akan tetap mempertahankan nilai aslinya pada setiap transaksi.
            </p>
          </div>
        </div>

        {/* Form Controls Grid */}
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
          {/* 1. Status Transaksi */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.status
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.status}
                  onChange={() => toggleField('status')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Status Transaksi</span>
              </label>
              {activeFields.status && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif
                </span>
              )}
            </div>

            {activeFields.status && (
              <select
                value={formValues.status}
                onChange={(e) => handleValueChange('status', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              >
                {TRANSACTION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st === 'Terjual' ? '✅ Terjual / Lunas' : st === 'Pending' ? '⏳ Pending' : '↩️ Retur / Batal'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Sumber Pesanan (Channel Penjualan) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.sumberPesanan
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.sumberPesanan}
                  onChange={() => toggleField('sumberPesanan')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Sumber Pesanan (Channel)</span>
              </label>
              {activeFields.sumberPesanan && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif
                </span>
              )}
            </div>

            {activeFields.sumberPesanan && (
              <select
                value={formValues.sumberPesanan}
                onChange={(e) => handleValueChange('sumberPesanan', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              >
                {ORDER_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3. Metode Pembayaran */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.paymentMethod
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.paymentMethod}
                  onChange={() => toggleField('paymentMethod')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Metode Pembayaran</span>
              </label>
              {activeFields.paymentMethod && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif
                </span>
              )}
            </div>

            {activeFields.paymentMethod && (
              <select
                value={formValues.paymentMethod}
                onChange={(e) => handleValueChange('paymentMethod', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 4. Ekspedisi / Kurir Pengiriman */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.ekspedisi
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.ekspedisi}
                  onChange={() => toggleField('ekspedisi')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Ekspedisi Pengiriman</span>
              </label>
              {activeFields.ekspedisi && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif
                </span>
              )}
            </div>

            {activeFields.ekspedisi && (
              <select
                value={formValues.ekspedisi}
                onChange={(e) => handleValueChange('ekspedisi', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              >
                {SHIPPING_COURIERS.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 5. Kategori Barang */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.category
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.category}
                  onChange={() => toggleField('category')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Kategori Barang</span>
              </label>
              {activeFields.category && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif
                </span>
              )}
            </div>

            {activeFields.category && (
              <select
                value={formValues.category}
                onChange={(e) => handleValueChange('category', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 6. Pemilik Barang (Penitip / Anggota Tim) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.ownerName
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.ownerName}
                  onChange={() => toggleField('ownerName')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Pemilik Barang</span>
              </label>
              {activeFields.ownerName && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif (Bagi Hasil Disesuaikan)
                </span>
              )}
            </div>

            {activeFields.ownerName && (
              <select
                value={formValues.ownerName}
                onChange={(e) => handleValueChange('ownerName', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              >
                {owners.map((o) => (
                  <option key={o.id || o.name} value={o.name}>
                    {o.name} {o.isCustomScheme ? `(Skema Khusus ${o.customScheme?.pemilikBarang || 85}%)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 7. Tanggal Transaksi */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.date
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.date}
                  onChange={() => toggleField('date')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Tanggal Transaksi</span>
              </label>
              {activeFields.date && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                  Aktif
                </span>
              )}
            </div>

            {activeFields.date && (
              <input
                type="date"
                value={formValues.date}
                onChange={(e) => handleValueChange('date', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1"
              />
            )}
          </div>

          {/* 8. Catatan Transaksi */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              activeFields.notes
                ? 'dark:bg-surface-300 bg-gray-50 dark:border-accent/40 border-accent'
                : 'dark:bg-surface-200/50 bg-white dark:border-white/5 border-gray-200 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs dark:text-white text-gray-900 select-none">
                <input
                  type="checkbox"
                  checked={activeFields.notes}
                  onChange={() => toggleField('notes')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                <span>Ubah Catatan Transaksi</span>
              </label>
              {activeFields.notes && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="notesMode"
                      checked={formValues.notesMode === 'append'}
                      onChange={() => handleValueChange('notesMode', 'append')}
                      className="accent-accent"
                    />
                    <span>Tambahkan</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="notesMode"
                      checked={formValues.notesMode === 'replace'}
                      onChange={() => handleValueChange('notesMode', 'replace')}
                      className="accent-accent"
                    />
                    <span>Gantikan</span>
                  </label>
                </div>
              )}
            </div>

            {activeFields.notes && (
              <textarea
                rows={2}
                placeholder="Tulis catatan yang akan diterapkan ke seluruh transaksi terpilih..."
                value={formValues.notes}
                onChange={(e) => handleValueChange('notes', e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1 resize-none"
              />
            )}
          </div>
        </div>

        {/* Ringkasan Daftar Transaksi Terpilih (Collapsible) */}
        <div className="p-3 rounded-2xl dark:bg-surface-300 bg-gray-50 border dark:border-white/5 border-gray-200">
          <button
            type="button"
            onClick={() => setShowPreviewList(!showPreviewList)}
            className="w-full flex items-center justify-between text-xs font-semibold dark:text-gray-300 text-gray-700"
          >
            <span>
              📋 {selectedTransactions.length} Transaksi Terpilih yang Akan Diperbarui
            </span>
            <span className="text-accent">{showPreviewList ? 'Sembunyikan ▲' : 'Lihat Daftar ▼'}</span>
          </button>

          {showPreviewList && (
            <div className="mt-2.5 max-h-36 overflow-y-auto space-y-1.5 pt-2 border-t dark:border-white/5 border-gray-200 text-xs">
              {selectedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-1 border-b dark:border-white/5 border-gray-200 last:border-0"
                >
                  <div className="flex items-center gap-2 truncate max-w-[240px]">
                    {tx.kodeBarang && (
                      <span className="font-mono font-bold text-[10px] text-accent">
                        {tx.kodeBarang}
                      </span>
                    )}
                    <span className="dark:text-white text-gray-900 font-medium truncate">
                      {tx.itemName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-gray-400">
                    <span>{formatCurrency(tx.sellingPrice)}</span>
                    <span className="text-accent font-medium">({tx.ownerName || 'Akbar'})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t dark:border-white/5 border-gray-200">
          <span className="text-xs dark:text-gray-400 text-gray-500">
            {activeCount > 0
              ? `⚡ ${activeCount} bidang siap diterapkan`
              : 'Pilih bidang yang ingin diubah di atas'}
          </span>

          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={submitting}
              disabled={!isAnyFieldActive || submitting}
            >
              Simpan Perubahan ({selectedTransactions.length} Transaksi)
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
