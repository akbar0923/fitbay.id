import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function DeleteInventoryModal({ isOpen, onClose, onConfirm, item, loading }) {
  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title="Hapus Data Barang"
      size="sm"
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 space-y-1">
          <p className="font-semibold">⚠️ Konfirmasi Penghapusan</p>
          <p className="dark:text-gray-300 text-gray-700">
            Apakah Anda yakin ingin menghapus barang{' '}
            <strong className="font-mono text-red-400">[{item.kodeBarang}] {item.namaBarang}</strong> dari inventaris?
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(item.id)}
            loading={loading}
          >
            Hapus Barang
          </Button>
        </div>
      </div>
    </Modal>
  );
}
