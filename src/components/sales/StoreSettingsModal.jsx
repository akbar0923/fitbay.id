import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { getStoreConfig, updateStoreConfig } from '../../services/storeSettingsService';
import toast from 'react-hot-toast';

export default function StoreSettingsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    storeName: 'Fitbay.id',
    storePhone: '085121009699',
    storeCity: 'Jakarta',
    storeAddress: 'Fitbay.id Preloved & Thrift Store, Jakarta',
    storeInstagram: '@fitbay.id',
    storeTikTok: '@fitbay.id',
    footerNote: 'Terima kasih telah berbelanja di Fitbay.id! Jangan lupa unboxing video.',
  });

  useEffect(() => {
    if (isOpen) {
      getStoreConfig().then((cfg) => {
        setForm(cfg);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.storeName.trim()) {
      toast.error('Nama toko pengirim wajib diisi');
      return;
    }

    setLoading(true);
    try {
      await updateStoreConfig(form);
      toast.success('Pengaturan pengirim label toko berhasil disimpan!');
      onClose();
    } catch (err) {
      toast.error('Gagal menyimpan pengaturan toko');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title="⚙️ Pengaturan Pengirim Label Toko"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs dark:text-gray-400 text-gray-500">
          Data ini akan otomatis dicantumkan sebagai identitas <strong>Pengirim (Sender)</strong> pada setiap Label Pengiriman thermal 10x15 cm dan Struk Penjualan.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nama Toko Pengirim *"
            placeholder="Fitbay.id"
            value={form.storeName}
            onChange={(e) => setForm({ ...form, storeName: e.target.value })}
          />
          <Input
            label="No. WhatsApp / HP Toko *"
            placeholder="085121009699"
            value={form.storePhone}
            onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
            Alamat Lengkap Toko Pengirim *
          </label>
          <textarea
            rows={2}
            placeholder="Contoh: Fitbay.id Store, Jl. Boulevard Raya No. 24, Jakarta Selatan"
            value={form.storeAddress}
            onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm
              dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
              dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
              transition-all duration-200 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Instagram Toko"
            placeholder="@fitbay.id"
            value={form.storeInstagram}
            onChange={(e) => setForm({ ...form, storeInstagram: e.target.value })}
          />
          <Input
            label="TikTok Toko"
            placeholder="@fitbay.id"
            value={form.storeTikTok}
            onChange={(e) => setForm({ ...form, storeTikTok: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
            Catatan Footer Struk / Label
          </label>
          <input
            type="text"
            placeholder="Terima kasih telah berbelanja di Fitbay.id!"
            value={form.footerNote}
            onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl text-sm dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" loading={loading}>
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
