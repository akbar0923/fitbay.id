import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input, { Select } from '../ui/Input';
import Button from '../ui/Button';
import { CATEGORIES } from '../../constants/profitSharingConfig';
import { useOwners } from '../../context/OwnerContext';
import { useInventory } from '../../context/InventoryContext';
import toast from 'react-hot-toast';

const initialForm = {
  kodeBarang: '',
  namaBarang: '',
  kategori: 'Baju',
  pemilikBarang: 'Akbar',
  hargaModal: '',
  catatan: '',
  status: 'Belum Terjual',
  tanggalMasuk: new Date().toISOString().split('T')[0],
};

export default function InventoryFormModal({ isOpen, onClose, onSubmit, editData }) {
  const { owners, addOwner } = useOwners();
  const { getNextItemCode } = useInventory();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState('FB-....');

  // State tambah pemilik baru cepat
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [addingOwnerLoading, setAddingOwnerLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setForm({
          kodeBarang: editData.kodeBarang || '',
          namaBarang: editData.namaBarang || '',
          kategori: editData.kategori || 'Baju',
          pemilikBarang: editData.pemilikBarang || (owners[0]?.name || 'Akbar'),
          hargaModal: String(editData.hargaModal ?? ''),
          catatan: editData.catatan || '',
          status: editData.status || 'Belum Terjual',
          tanggalMasuk: editData.tanggalMasuk || new Date().toISOString().split('T')[0],
        });
        setPreviewCode(editData.kodeBarang || '');
      } else {
        setForm({
          ...initialForm,
          pemilikBarang: owners[0]?.name || 'Akbar',
          tanggalMasuk: new Date().toISOString().split('T')[0],
        });
        getNextItemCode().then(({ nextCode }) => {
          setPreviewCode(nextCode);
          setForm((prev) => ({ ...prev, kodeBarang: nextCode }));
        });
      }
      setErrors({});
      setIsAddingOwner(false);
      setNewOwnerName('');
    }
  }, [isOpen, editData]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleQuickAddOwner = async () => {
    if (!newOwnerName.trim()) {
      toast.error('Nama pemilik tidak boleh kosong');
      return;
    }
    const cleanName = newOwnerName.trim();
    if (owners.some((o) => o.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`Pemilik "${cleanName}" sudah terdaftar`);
      handleChange('pemilikBarang', cleanName);
      setIsAddingOwner(false);
      return;
    }

    setAddingOwnerLoading(true);
    try {
      await addOwner({
        name: cleanName,
        phone: '-',
        notes: 'Dibuat cepat dari Form Barang',
      });
      handleChange('pemilikBarang', cleanName);
      setIsAddingOwner(false);
      setNewOwnerName('');
      toast.success(`Pemilik "${cleanName}" berhasil ditambahkan!`);
    } catch (err) {
      toast.error('Gagal menambahkan pemilik baru');
    } finally {
      setAddingOwnerLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.namaBarang.trim()) newErrors.namaBarang = 'Nama barang wajib diisi';
    if (!form.pemilikBarang.trim()) newErrors.pemilikBarang = 'Pemilik barang wajib dipilih';
    if (form.hargaModal === '' || form.hargaModal === undefined) {
      newErrors.hargaModal = 'Harga modal wajib diisi';
    } else if (Number(form.hargaModal) < 0) {
      newErrors.hargaModal = 'Harga modal tidak boleh negatif';
    }
    if (!form.tanggalMasuk) newErrors.tanggalMasuk = 'Tanggal masuk wajib diisi';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit({
        ...form,
        hargaModal: Number(form.hargaModal),
      });
      onClose();
    } catch (err) {
      console.error('Submit inventory item error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={editData ? `Edit Barang: ${editData.kodeBarang}` : 'Tambah Barang Baru ke Inventaris'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Kode Barang & Tanggal Masuk */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
              Kode Barang (Otomatis)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-accent/10 border border-accent/30 dark:bg-accent/15">
              <span className="text-base">🏷️</span>
              <span className="font-mono font-bold text-accent dark:text-accent tracking-wider text-sm">
                {previewCode}
              </span>
              <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                {editData ? 'Tersimpan' : 'Auto Generated'}
              </span>
            </div>
          </div>

          <Input
            label="Tanggal Masuk *"
            type="date"
            value={form.tanggalMasuk}
            onChange={(e) => handleChange('tanggalMasuk', e.target.value)}
            error={errors.tanggalMasuk}
          />
        </div>

        {/* Nama Barang */}
        <Input
          label="Nama Barang *"
          placeholder="Contoh: Nike Air Force 1 Low / Vintage Carhartt Jacket"
          value={form.namaBarang}
          onChange={(e) => handleChange('namaBarang', e.target.value)}
          error={errors.namaBarang}
        />

        {/* Kategori & Pemilik Barang */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Kategori *"
            value={form.kategori}
            onChange={(e) => handleChange('kategori', e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>

          {/* Pemilik Barang */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
                Pemilik Barang (Titipan) *
              </label>
              {!isAddingOwner ? (
                <button
                  type="button"
                  onClick={() => setIsAddingOwner(true)}
                  className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                >
                  <span>+ Tambah Baru</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingOwner(false)}
                  className="text-xs text-gray-400 hover:text-white font-medium"
                >
                  ✕ Batal
                </button>
              )}
            </div>

            {isAddingOwner ? (
              <div className="flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  placeholder="Nama pemilik baru..."
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm
                    dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
                    dark:border-white/10 border-gray-300 border
                    focus:outline-none focus:ring-2 focus:ring-accent/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAddOwner();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleQuickAddOwner}
                  loading={addingOwnerLoading}
                >
                  Simpan
                </Button>
              </div>
            ) : (
              <Select
                value={form.pemilikBarang}
                onChange={(e) => handleChange('pemilikBarang', e.target.value)}
                error={errors.pemilikBarang}
              >
                {owners.map((owner) => (
                  <option key={owner.id || owner.name} value={owner.name}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Harga Modal & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Harga Modal (Rp) *"
            type="number"
            placeholder="0"
            min="0"
            value={form.hargaModal}
            onChange={(e) => handleChange('hargaModal', e.target.value)}
            error={errors.hargaModal}
          />

          <Select
            label="Status Barang"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="Belum Terjual">Belum Terjual (Siap Dijual / Live)</option>
            <option value="Terjual">Terjual</option>
          </Select>
        </div>

        {/* Catatan / Keterangan */}
        <div>
          <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
            Catatan Tambahan (Ukuran, Kondisi, Warna, dll)
          </label>
          <textarea
            rows={3}
            placeholder="Contoh: Size L, Kondisi 9/10, Warna Biru Navy, Lengkap tag original..."
            value={form.catatan}
            onChange={(e) => handleChange('catatan', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm
              dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
              dark:border-white/10 border-gray-300 border
              dark:placeholder-gray-500 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
              transition-all duration-200 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" loading={loading}>
            {editData ? 'Simpan Perubahan' : 'Simpan ke Inventaris'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
