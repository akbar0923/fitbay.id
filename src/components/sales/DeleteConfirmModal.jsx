import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatCurrency } from '../../utils/formatCurrency';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, transaction }) {
  if (!transaction) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Konfirmasi Hapus" size="sm">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
          Hapus Transaksi?
        </h3>
        <p className="text-sm dark:text-gray-400 text-gray-600 mb-1">
          Apakah Anda yakin ingin menghapus transaksi:
        </p>
        <p className="text-sm font-semibold dark:text-white text-gray-900 mb-1">
          "{transaction.itemName}"
        </p>
        <p className="text-xs dark:text-gray-500 text-gray-400">
          {formatCurrency(transaction.sellingPrice)} · {transaction.status}
        </p>

        <p className="text-xs text-red-400 mt-4">
          Tindakan ini tidak dapat dibatalkan.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="danger" onClick={() => { onConfirm(transaction.id); onClose(); }}>
          Ya, Hapus
        </Button>
      </div>
    </Modal>
  );
}
