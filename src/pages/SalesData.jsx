import { useState } from 'react';
import { useSales } from '../context/SalesContext';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import SalesTable from '../components/sales/SalesTable';
import SalesFormModal from '../components/sales/SalesFormModal';
import DeleteConfirmModal from '../components/sales/DeleteConfirmModal';
import ImportSpreadsheetModal from '../components/sales/ImportSpreadsheetModal';
import StoreSettingsModal from '../components/sales/StoreSettingsModal';
import Button from '../components/ui/Button';

export default function SalesData() {
  const { addTransaction, addTransactionsBatch, updateTransaction, deleteTransaction } = useSales();
  const { markAsSold, restoreToUnsold, items } = useInventory();
  const { isAdmin } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isStoreSettingsOpen, setIsStoreSettingsOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);

  const handleAdd = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  const handleEdit = (tx) => {
    setEditingTransaction(tx);
    setIsFormOpen(true);
  };

  const handleDelete = (tx) => {
    setDeletingTransaction(tx);
    setIsDeleteOpen(true);
  };

  // Kumpulkan semua ID inventaris dari payload transaksi multi-barang / single-barang
  const resolveTargetInventoryItems = (formData) => {
    const list = [];
    if (formData.items && Array.isArray(formData.items) && formData.items.length > 0) {
      formData.items.forEach((it) => {
        let invId = it.inventoryItemId;
        if (!invId && it.kodeBarang) {
          const found = items.find(
            (i) => (i.kodeBarang || '').toLowerCase() === it.kodeBarang.trim().toLowerCase()
          );
          if (found) invId = found.id;
        }
        if (invId) {
          list.push({
            invId,
            sellingPrice: Number(it.sellingPrice || 0),
          });
        }
      });
    } else {
      let invId = formData.inventoryItemId;
      if (!invId && formData.kodeBarang) {
        const found = items.find(
          (i) => (i.kodeBarang || '').toLowerCase() === formData.kodeBarang.trim().toLowerCase()
        );
        if (found) invId = found.id;
      }
      if (invId) {
        list.push({
          invId,
          sellingPrice: Number(formData.sellingPrice || 0),
        });
      }
    }
    return list;
  };

  const handleFormSubmit = async (formData) => {
    const targetInventoryList = resolveTargetInventoryItems(formData);

    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, {
        ...editingTransaction,
        ...formData,
      });

      // Cari item lama yang dilepas saat edit agar statusnya dikembalikan ke Belum Terjual
      const oldInvIds = [];
      if (editingTransaction.items && Array.isArray(editingTransaction.items)) {
        editingTransaction.items.forEach((it) => {
          if (it.inventoryItemId) oldInvIds.push(it.inventoryItemId);
        });
      } else if (editingTransaction.inventoryItemId) {
        oldInvIds.push(editingTransaction.inventoryItemId);
      }

      const currentIdsSet = new Set(targetInventoryList.map((t) => t.invId));
      for (const oldId of oldInvIds) {
        if (!currentIdsSet.has(oldId)) {
          try {
            await restoreToUnsold(oldId);
          } catch (err) {
            console.warn('Error restoring unlinked inventory item:', err);
          }
        }
      }

      // Update seluruh item inventaris yang masih terhubung
      for (const target of targetInventoryList) {
        try {
          await markAsSold(target.invId, editingTransaction.id, {
            sellingPrice: target.sellingPrice,
            paymentMethod: formData.paymentMethod || 'Transfer Bank',
            sumberPesanan: formData.sumberPesanan || 'WhatsApp',
            namaPenerima: formData.namaPenerima || '',
            noHpPenerima: formData.noHpPenerima || '',
            alamatPenerima: formData.alamatPenerima || '',
            ekspedisi: formData.ekspedisi || 'J&T Express',
            resi: formData.resi || '',
          });
        } catch (invErr) {
          console.warn('Error updating inventory item to sold:', invErr);
        }
      }
    } else {
      const newTx = await addTransaction(formData);

      if (newTx?.id && targetInventoryList.length > 0) {
        for (const target of targetInventoryList) {
          try {
            await markAsSold(target.invId, newTx.id, {
              sellingPrice: target.sellingPrice,
              paymentMethod: formData.paymentMethod || 'Transfer Bank',
              sumberPesanan: formData.sumberPesanan || 'WhatsApp',
              namaPenerima: formData.namaPenerima || '',
              noHpPenerima: formData.noHpPenerima || '',
              alamatPenerima: formData.alamatPenerima || '',
              ekspedisi: formData.ekspedisi || 'J&T Express',
              resi: formData.resi || '',
            });
          } catch (invErr) {
            console.warn('Error marking item as sold:', invErr);
          }
        }
      }
    }
  };

  const handleDeleteConfirm = async (id) => {
    await deleteTransaction(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Data Penjualan</h1>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">Kelola transaksi penjualan, cetak label, dan pengiriman</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button variant="ghost" onClick={() => setIsStoreSettingsOpen(true)} title="Atur data pengirim untuk label paket">
              <span>⚙️ Data Pengirim</span>
            </Button>
          )}
          <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Impor Data
          </Button>
          <Button onClick={handleAdd}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah Transaksi
          </Button>
        </div>
      </div>

      {/* Table */}
      <SalesTable
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
      />

      {/* Form Modal */}
      <SalesFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        editData={editingTransaction}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        transaction={deletingTransaction}
      />

      {/* Import Spreadsheet Modal */}
      <ImportSpreadsheetModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportBatch={addTransactionsBatch}
      />

      {/* Store Settings Modal */}
      <StoreSettingsModal
        isOpen={isStoreSettingsOpen}
        onClose={() => setIsStoreSettingsOpen(false)}
      />
    </div>
  );
}
