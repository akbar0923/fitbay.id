import { useState, useEffect, useRef } from 'react';
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

  // Mode Tambah Cepat (Continuous / Quick Add Mode)
  const [isQuickAddMode, setIsQuickAddMode] = useState(true);
  const [lastSavedCategory, setLastSavedCategory] = useState('Baju');
  const [lastSavedOwner, setLastSavedOwner] = useState('Akbar');
  const [itemsAddedCount, setItemsAddedCount] = useState(0);

  // Ref untuk auto-focus input nama barang
  const nameInputRef = useRef(null);

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
          hargaModal: editData.hargaModal !== undefined && editData.hargaModal !== null ? String(editData.hargaModal) : '',
          catatan: editData.catatan || '',
          status: editData.status || 'Belum Terjual',
          tanggalMasuk: editData.tanggalMasuk || new Date().toISOString().split('T')[0],
        });
        setPreviewCode(editData.kodeBarang || '');
      } else {
        // Mode tambah baru: gunakan memori kategori & pemilik terakhir
        const defaultOwner = lastSavedOwner || owners[0]?.name || 'Akbar';
        const defaultCategory = lastSavedCategory || 'Baju';
        
        setForm({
          ...initialForm,
          kategori: defaultCategory,
          pemilikBarang: defaultOwner,
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

      // Auto-focus ke nama barang setelah modal terbuka
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, editData]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    // Simpan ke memori jika user mengubah kategori atau pemilik
    if (field === 'kategori') setLastSavedCategory(value);
    if (field === 'pemilikBarang') setLastSavedOwner(value);
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
    // HANYA Nama Barang, Kategori, dan Pemilik Barang yang WAJIB
    if (!form.namaBarang.trim()) newErrors.namaBarang = 'Nama barang wajib diisi';
    if (!form.pemilikBarang.trim()) newErrors.pemilikBarang = 'Pemilik barang wajib dipilih';
    if (!form.kategori) newErrors.kategori = 'Kategori barang wajib dipilih';

    // Harga modal bersifat opsional (jika diisi, tidak boleh negatif)
    if (form.hargaModal !== '' && Number(form.hargaModal) < 0) {
      newErrors.hargaModal = 'Harga modal tidak boleh negatif';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const itemNameToSave = form.namaBarang.trim();
      const payload = {
        ...form,
        namaBarang: itemNameToSave,
        hargaModal: form.hargaModal ? Number(form.hargaModal) : 0,
      };

      await onSubmit(payload);

      if (!editData && isQuickAddMode) {
        // Mode Tambah Cepat: Notifikasi sukses, reset field tertentu, pertahankan kategori & pemilik
        setItemsAddedCount((prev) => prev + 1);
        toast.success(`✓ "${itemNameToSave}" tersimpan! Siap input barang berikutnya.`, {
          duration: 2500,
          position: 'top-center',
        });

        // Ambil kode berikutnya secara otomatis
        const { nextCode } = await getNextItemCode();
        setPreviewCode(nextCode);

        // Reset form sambil mengingat kategori & pemilik
        setForm((prev) => ({
          ...prev,
          kodeBarang: nextCode,
          namaBarang: '',
          hargaModal: '',
          catatan: '',
          // Kategori, pemilikBarang, status, tanggalMasuk tetap dipertahankan
        }));

        setErrors({});

        // Otomatis fokus kembali ke nama barang
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      } else {
        // Mode biasa / edit: tutup modal
        onClose();
      }
    } catch (err) {
      console.error('Submit inventory item error:', err);
      toast.error('Gagal menyimpan barang ke inventaris');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={
        <div className="flex items-center justify-between pr-8">
          <span>{editData ? `Edit Barang: ${editData.kodeBarang}` : 'Tambah Barang ke Inventaris'}</span>
          {!editData && itemsAddedCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
              +{itemsAddedCount} Barang Tersimpan
            </span>
          )}
        </div>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode Tambah Cepat (Hanya muncul saat tambah baru) */}
        {!editData && (
          <div className="p-3 rounded-2xl dark:bg-accent/10 bg-accent/5 border border-accent/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-accent text-lg">⚡</span>
              <div>
                <p className="text-xs font-bold dark:text-white text-gray-900">
                  Mode Tambah Cepat (Input Beruntun)
                </p>
                <p className="text-[11px] dark:text-gray-400 text-gray-500">
                  Form tetap terbuka setelah simpan & otomatis mengingat pemilik/kategori terakhir.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isQuickAddMode}
                onChange={(e) => setIsQuickAddMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
        )}

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
            label="Tanggal Masuk"
            type="date"
            value={form.tanggalMasuk}
            onChange={(e) => handleChange('tanggalMasuk', e.target.value)}
            error={errors.tanggalMasuk}
          />
        </div>

        {/* Nama Barang (WAJIB & AutoFocus) */}
        <div>
          <label className="block text-xs font-medium dark:text-gray-300 text-gray-700 mb-1">
            Nama Barang <span className="text-red-400 font-bold">*</span>
          </label>
          <input
            ref={nameInputRef}
            type="text"
            placeholder="Contoh: Nike Air Force 1 Low / Vintage Carhartt Jacket"
            value={form.namaBarang}
            onChange={(e) => handleChange('namaBarang', e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm
              dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
              ${errors.namaBarang ? 'border-red-500 ring-1 ring-red-500' : 'dark:border-white/10 border-gray-300'} border
              dark:placeholder-gray-500 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
              transition-all duration-200`}
          />
          {errors.namaBarang && (
            <p className="text-[11px] text-red-400 mt-1">{errors.namaBarang}</p>
          )}
        </div>

        {/* Kategori & Pemilik Barang (WAJIB - Nilai Diingat) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Kategori *"
            value={form.kategori}
            onChange={(e) => handleChange('kategori', e.target.value)}
            error={errors.kategori}
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
                Pemilik Barang (Titipan) <span className="text-red-400 font-bold">*</span>
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

        {/* Harga Modal & Status (Harga Modal Opsional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Harga Modal (Rp) — Opsional"
              type="number"
              placeholder="0 (opsional, bisa diisi nanti)"
              min="0"
              value={form.hargaModal}
              onChange={(e) => handleChange('hargaModal', e.target.value)}
              error={errors.hargaModal}
            />
            <p className="text-[11px] dark:text-gray-400 text-gray-500 mt-0.5">
              Boleh dikosongkan jika belum diketahui.
            </p>
          </div>

          <Select
            label="Status Barang"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="Belum Terjual">Belum Terjual (Siap Dijual / Live)</option>
            <option value="Terjual">Terjual</option>
          </Select>
        </div>

        {/* Catatan / Keterangan (Opsional) */}
        <div>
          <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
            Catatan / Detail Tambahan (Opsional)
          </label>
          <textarea
            rows={2}
            placeholder="Contoh: Size L, Kondisi 9/10, Warna Biru Navy, Tag Original..."
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
        <div className="flex items-center justify-between pt-4 border-t dark:border-white/5 border-gray-200">
          <div className="text-xs dark:text-gray-400 text-gray-500">
            {!editData && isQuickAddMode ? (
              <span className="text-accent font-medium">Tekan Enter pada form untuk simpan cepat ⚡</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
              {editData || itemsAddedCount === 0 ? 'Batal' : 'Selesai'}
            </Button>
            <Button type="submit" loading={loading} className="font-bold shadow-md shadow-accent/20">
              {editData
                ? 'Simpan Perubahan'
                : isQuickAddMode
                ? 'Simpan & Lanjut Tambah ➔'
                : 'Simpan ke Inventaris'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
