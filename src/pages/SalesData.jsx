import { useState } from 'react';
import { useSales } from '../context/SalesContext';
import SalesTable from '../components/sales/SalesTable';
import SalesFormModal from '../components/sales/SalesFormModal';
import DeleteConfirmModal from '../components/sales/DeleteConfirmModal';
import ImportSpreadsheetModal from '../components/sales/ImportSpreadsheetModal';
import Button from '../components/ui/Button';

export default function SalesData() {
  const { addTransaction, addTransactionsBatch, updateTransaction, deleteTransaction } = useSales();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
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

  const handleFormSubmit = async (formData) => {
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, {
        ...editingTransaction,
        ...formData,
      });
    } else {
      await addTransaction(formData);
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
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">Kelola semua transaksi penjualan</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Impor Data Spreadsheet
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
    </div>
  );
}
