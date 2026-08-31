import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useInventory } from '../../context/InventoryContext';
import { useOwners } from '../../context/OwnerContext';
import { useSales } from '../../context/SalesContext';
import { calculateProfitSharing } from '../../utils/calculateProfitSharing';
import { updateTransactionDoc } from '../../firebase/firestoreService';
import toast from 'react-hot-toast';

export default function BulkChangeOwnerModal({
  isOpen,
  onClose,
  selectedItems = [],
  onSuccess,
}) {
  const { updateItem } = useInventory();
  const { owners, addOwner } = useOwners();
  const { transactions, profitSharingConfig } = useSales();

  const [targetOwner, setTargetOwner] = useState(owners[0]?.name || 'Akbar');
  const [submitting, setSubmitting] = useState(false);
  const [showPreviewList, setShowPreviewList] = useState(false);

  // Quick add new owner
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [addingOwnerLoading, setAddingOwnerLoading] = useState(false);

  const handleQuickAddOwner = async (e) => {
    e.preventDefault();
    if (!newOwnerName.trim()) {
      toast.error('Nama pemilik baru tidak boleh kosong.');
      return;
    }

    const cleanName = newOwnerName.trim();
    if (owners.some((o) => o.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`Pemilik "${cleanName}" sudah terdaftar.`);
      setTargetOwner(cleanName);
      setIsAddingNew(false);
      return;
    }

    setAddingOwnerLoading(true);
    try {
      await addOwner({
        name: cleanName,
        phone: '-',
        notes: 'Ditambahkan cepat dari Ubah Pemilik Massal',
      });
      setTargetOwner(cleanName);
      setIsAddingNew(false);
      setNewOwnerName('');
      toast.success(`Pemilik "${cleanName}" berhasil ditambahkan!`);
    } catch (err) {
      toast.error('Gagal menambahkan pemilik baru: ' + (err.message || 'Coba lagi'));
    } finally {
      setAddingOwnerLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!targetOwner) {
      toast.error('Pilih pemilik baru terlebih dahulu.');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Tidak ada barang yang dipilih.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(`Mengubah pemilik untuk ${selectedItems.length} barang...`);

    try {
      const targetOwnerObj = owners.find(
        (o) => (o.name || '').toLowerCase() === targetOwner.toLowerCase()
      );

      // Loop update setiap item inventory
      const updatePromises = selectedItems.map(async (item) => {
        // 1. Update data pemilik di item inventaris
        await updateItem(item.id, {
          pemilikBarang: targetOwner,
        });

        // 2. Jika barang ini sudah terjual dan memiliki referensi transaksi, update juga pemilik di transaksi
        let linkedTx = null;
        if (item.status === 'Terjual') {
          if (item.referensiTransaksiId) {
            linkedTx = transactions.find((t) => t.id === item.referensiTransaksiId);
          }
          if (!linkedTx && item.kodeBarang) {
            linkedTx = transactions.find((t) => t.kodeBarang === item.kodeBarang);
          }
        }

        if (linkedTx) {
          let schemeToUse = profitSharingConfig;
          const isCustom = targetOwnerObj?.isCustomScheme && targetOwnerObj?.customScheme;

          const updatedTxFields = {
            ownerName: targetOwner,
            updatedAt: new Date().toISOString(),
          };

          if (isCustom) {
            schemeToUse = {};
            Object.keys(profitSharingConfig).forEach((k) => {
              schemeToUse[k] = {
                ...profitSharingConfig[k],
                percentage: Number(targetOwnerObj.customScheme[k] || 0),
              };
            });
            updatedTxFields.ownerCustomScheme = targetOwnerObj.customScheme;
            updatedTxFields.skemaCustom = targetOwnerObj.customScheme;
          } else {
            updatedTxFields.ownerCustomScheme = null;
            updatedTxFields.skemaCustom = null;
          }

          const { profit, sharing } = calculateProfitSharing(
            Number(linkedTx.sellingPrice || 0),
            Number(linkedTx.costPrice || 0),
            schemeToUse
          );

          updatedTxFields.profit = profit;
          updatedTxFields.profitSharing = sharing;

          try {
            await updateTransactionDoc(linkedTx.id, updatedTxFields);
          } catch (txErr) {
            console.warn('Gagal sinkron transaksi terkait:', txErr);
          }
        }
      });

      await Promise.all(updatePromises);

      toast.success(
        `Berhasil mengubah pemilik untuk ${selectedItems.length} barang menjadi "${targetOwner}"! 🎉`,
        { id: toastId }
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error in bulk change owner:', err);
      toast.error('Gagal mengubah pemilik secara massal: ' + (err.message || 'Coba lagi'), {
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
      title={`Ubah Pemilik Massal (${selectedItems.length} Barang Dipilih)`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner Info */}
        <div className="p-3.5 rounded-2xl bg-accent/10 border border-accent/20 text-xs flex items-start gap-3">
          <span className="text-xl">👤</span>
          <div>
            <p className="font-bold text-sm dark:text-white text-gray-900">
              Pindahkan Kepemilikan {selectedItems.length} Barang
            </p>
            <p className="text-gray-400 mt-0.5">
              Seluruh barang yang dipilih akan diubah pemiliknya menjadi pemilik baru yang Anda pilih di bawah. Transaksi terkait (jika barang sudah terjual) juga akan otomatis disinkronkan.
            </p>
          </div>
        </div>

        {/* Input Pemilik Baru */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold dark:text-white text-gray-900">
              Pilih Pemilik Baru
            </label>
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="text-[11px] text-accent hover:underline font-semibold"
            >
              {isAddingNew ? '← Pilih dari Daftar' : '+ Tambah Pemilik Baru'}
            </button>
          </div>

          {!isAddingNew ? (
            <select
              value={targetOwner}
              onChange={(e) => setTargetOwner(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm dark:bg-surface-300 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {owners.map((o) => (
                <option key={o.id || o.name} value={o.name}>
                  {o.name} {o.isCustomScheme ? `(Skema Khusus ${o.customScheme?.pemilikBarang || 85}%)` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 rounded-xl dark:bg-surface-300 bg-gray-50 border dark:border-white/10 border-gray-200 space-y-2">
              <input
                type="text"
                placeholder="Ketik nama pemilik baru..."
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="w-full text-xs"
                onClick={handleQuickAddOwner}
                loading={addingOwnerLoading}
              >
                Simpan & Pilih Pemilik Ini
              </Button>
            </div>
          )}
        </div>

        {/* Ringkasan Daftar Barang Terpilih */}
        <div className="p-3 rounded-2xl dark:bg-surface-300 bg-gray-50 border dark:border-white/5 border-gray-200">
          <button
            type="button"
            onClick={() => setShowPreviewList(!showPreviewList)}
            className="w-full flex items-center justify-between text-xs font-semibold dark:text-gray-300 text-gray-700"
          >
            <span>
              📋 {selectedItems.length} Barang yang Akan Diubah Pemiliknya
            </span>
            <span className="text-accent">{showPreviewList ? 'Sembunyikan ▲' : 'Lihat Daftar ▼'}</span>
          </button>

          {showPreviewList && (
            <div className="mt-2.5 max-h-40 overflow-y-auto space-y-1.5 pt-2 border-t dark:border-white/5 border-gray-200 text-xs">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1 border-b dark:border-white/5 border-gray-200 last:border-0"
                >
                  <div className="flex items-center gap-2 truncate max-w-[220px]">
                    <span className="font-mono font-bold text-[10px] text-accent">
                      {item.kodeBarang}
                    </span>
                    <span className="dark:text-white text-gray-900 font-medium truncate">
                      {item.namaBarang}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-gray-400">
                    <span className="line-through opacity-70">{item.pemilikBarang || '-'}</span>
                    <span className="text-accent font-bold">→ {targetOwner}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            disabled={!targetOwner || submitting}
          >
            Terapkan ke {selectedItems.length} Barang
          </Button>
        </div>
      </form>
    </Modal>
  );
}
