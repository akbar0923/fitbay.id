import { useState, useMemo } from 'react';
import { useOwners } from '../context/OwnerContext';
import { useSales } from '../context/SalesContext';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import OwnerItemsModal from '../components/owners/OwnerItemsModal';

const defaultCustomScheme = {
  pemilikBarang: 90,
  operational: 10,
  akbar: 0,
  nesa: 0,
  andin: 0,
  ritza: 0,
};

export default function Owners() {
  const { owners, loading, addOwner, updateOwner, deleteOwner } = useOwners();
  const { transactions, profitSharingConfig } = useSales();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(null);
  const [deletingOwner, setDeletingOwner] = useState(null);
  const [viewingOwner, setViewingOwner] = useState(null);

  const initialFormData = {
    name: '',
    phone: '',
    notes: '',
    isCustomScheme: false,
    customScheme: { ...defaultCustomScheme },
  };

  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  // Hitung statistik per pemilik berdasarkan transaksi penjualan riil
  const ownerStats = useMemo(() => {
    const stats = {};
    owners.forEach((o) => {
      stats[o.name.toLowerCase()] = { totalItems: 0, totalRevenue: 0, totalShare: 0 };
    });

    transactions.forEach((tx) => {
      const ownerKey = (tx.ownerName || '').toLowerCase();
      if (stats[ownerKey]) {
        stats[ownerKey].totalItems += 1;
        if (tx.status === 'Terjual') {
          stats[ownerKey].totalRevenue += tx.sellingPrice || 0;
          stats[ownerKey].totalShare += tx.profitSharing?.pemilikBarang || (tx.profit * 0.7) || 0;
        }
      }
    });

    return stats;
  }, [owners, transactions]);

  const filteredOwners = useMemo(() => {
    return owners.filter((o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.notes && o.notes.toLowerCase().includes(search.toLowerCase())) ||
      (o.phone && o.phone.includes(search))
    );
  }, [owners, search]);

  const handleOpenAdd = () => {
    setEditingOwner(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (owner) => {
    setEditingOwner(owner);
    setFormData({
      name: owner.name,
      phone: owner.phone || '',
      notes: owner.notes || '',
      isCustomScheme: Boolean(owner.isCustomScheme),
      customScheme: owner.customScheme ? { ...owner.customScheme } : { ...defaultCustomScheme },
    });
    setIsModalOpen(true);
  };

  const handleCustomSchemeChange = (key, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setFormData((prev) => ({
      ...prev,
      customScheme: {
        ...prev.customScheme,
        [key]: num,
      },
    }));
  };

  const handleApplyPreset = (scheme) => {
    setFormData((prev) => ({
      ...prev,
      isCustomScheme: true,
      customScheme: { ...scheme },
    }));
  };

  // Validasi total persentase skema kustom
  const totalCustomPercentage = useMemo(() => {
    if (!formData.isCustomScheme) return 100;
    return Object.values(formData.customScheme || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [formData.isCustomScheme, formData.customScheme]);

  const isValidCustomTotal = !formData.isCustomScheme || totalCustomPercentage === 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (formData.isCustomScheme && totalCustomPercentage !== 100) return;

    try {
      setSubmitting(true);
      if (editingOwner) {
        await updateOwner(editingOwner.id, formData);
      } else {
        await addOwner(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingOwner) return;
    try {
      setSubmitting(true);
      await deleteOwner(deletingOwner.id);
      setIsDeleteOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSoldAll = Object.values(ownerStats).reduce((sum, s) => sum + s.totalShare, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Kelola Pemilik Barang</h1>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">
            Daftar penitip barang preloved, skema bagi hasil khusus, dan rekap hak pencairan
          </p>
        </div>
        <Button onClick={handleOpenAdd}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Pemilik Baru
        </Button>
      </div>

      {/* Summary Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-400 uppercase">Total Pemilik Terdaftar</p>
          <p className="text-2xl font-bold dark:text-white text-gray-900 mt-1">{owners.length} Orang/Toko</p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-400 uppercase">Total Barang Terjual</p>
          <p className="text-2xl font-bold text-accent mt-1">
            {Object.values(ownerStats).reduce((sum, s) => sum + s.totalItems, 0)} Pcs
          </p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-400 uppercase">Total Hak Bagi Hasil Seluruh Pemilik</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalSoldAll)}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama pemilik, no hp, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm
              dark:bg-surface-200 bg-white dark:text-white text-gray-900
              dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* Owners Table */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : filteredOwners.length === 0 ? (
        <EmptyState
          title="Tidak ada data pemilik"
          description={search ? 'Tidak ada pemilik yang sesuai pencarian' : 'Tambahkan pemilik barang titipan pertama'}
          action={
            <Button onClick={handleOpenAdd}>
              Tambah Pemilik
            </Button>
          }
        />
      ) : (
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-white/[0.02] bg-gray-50 border-b dark:border-white/5 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Nama Pemilik</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Skema Bagi Hasil</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Kontak / No WA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Catatan / Rekening</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Barang Terjual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Total Hak Cair</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                {filteredOwners.map((owner) => {
                  const stat = ownerStats[owner.name.toLowerCase()] || { totalItems: 0, totalShare: 0 };
                  const isCustom = owner.isCustomScheme && owner.customScheme;

                  return (
                    <tr key={owner.id || owner.name} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-xs">
                            {owner.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold dark:text-white text-gray-900">{owner.name}</p>
                            <p className="text-[11px] dark:text-gray-500 text-gray-400">
                              Terdaftar: {owner.createdAt ? formatDate(owner.createdAt) : '-'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Skema Bagi Hasil Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isCustom ? (
                          <div className="inline-flex flex-col gap-0.5">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20">
                              ⚡ {owner.customScheme.pemilikBarang}% Pemilik / {owner.customScheme.operational}% Ops
                              {(Number(owner.customScheme.akbar || 0) + Number(owner.customScheme.nesa || 0) + Number(owner.customScheme.andin || 0) + Number(owner.customScheme.ritza || 0)) > 0
                                ? ` / ${Number(owner.customScheme.akbar || 0) + Number(owner.customScheme.nesa || 0) + Number(owner.customScheme.andin || 0) + Number(owner.customScheme.ritza || 0)}% Tim`
                                : ''}
                            </span>
                            <span className="text-[10px] text-purple-400/80 pl-1 font-medium">Skema Khusus</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            🌐 Standar Global ({profitSharingConfig?.pemilikBarang?.percentage || 70}%)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-sm dark:text-gray-300 text-gray-700 whitespace-nowrap">
                        {owner.phone && owner.phone !== '-' ? (
                          <a
                            href={`https://wa.me/${owner.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline flex items-center gap-1"
                          >
                            <span>📱</span>
                            <span>{owner.phone}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs dark:text-gray-400 text-gray-500 max-w-xs truncate">
                        {owner.notes || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-center text-sm font-semibold dark:text-white text-gray-900 whitespace-nowrap">
                        {stat.totalItems} item
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-sm text-emerald-400 whitespace-nowrap">
                        {formatCurrency(stat.totalShare)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setViewingOwner(owner); setIsItemsModalOpen(true); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold dark:bg-accent/15 bg-accent/10 dark:text-accent text-accent-dark hover:dark:bg-accent/25 hover:bg-accent/20 transition-all border dark:border-accent/20 border-accent/20"
                            title="Lihat Daftar Barang Titipan"
                          >
                            <span>📦</span>
                            <span>Lihat Barang</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(owner)}
                            className="p-1.5 rounded-lg dark:text-gray-400 text-gray-500 hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.688-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setDeletingOwner(owner); setIsDeleteOpen(true); }}
                            className="p-1.5 rounded-lg dark:text-gray-400 text-gray-500 hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                            title="Hapus"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form Tambah/Edit Pemilik */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOwner ? 'Edit Pemilik Barang' : 'Tambah Pemilik Barang'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Pemilik Barang"
            placeholder="contoh: Akbar / Nesa / Bu Nina"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />
          <Input
            label="Nomor WhatsApp / Telepon"
            placeholder="contoh: 081234567890"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
              Catatan / Info Rekening
            </label>
            <textarea
              rows={2}
              placeholder="contoh: BCA 12345678 a.n Nina, titip 10 baju"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 rounded-xl text-sm
                dark:bg-white/5 bg-gray-100 dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
            />
          </div>

          {/* Pengaturan Skema Bagi Hasil Khusus Pemilik Ini */}
          <div className="pt-3 border-t dark:border-white/5 border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold dark:text-white text-gray-900">
                Skema Pembagian Keuntungan
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isCustomScheme: false }))}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                    !formData.isCustomScheme
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'dark:bg-white/5 bg-gray-100 text-gray-400'
                  }`}
                >
                  🌐 Standar Global
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isCustomScheme: true }))}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                    formData.isCustomScheme
                      ? 'bg-purple text-white shadow-sm'
                      : 'dark:bg-white/5 bg-gray-100 text-gray-400'
                  }`}
                >
                  ⚡ Skema Khusus
                </button>
              </div>
            </div>

            {formData.isCustomScheme && (
              <div className="p-4 rounded-xl dark:bg-purple/5 bg-purple/5 border border-purple/20 space-y-3 animate-fade-in">
                {/* Preset Buttons */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold dark:text-gray-400 text-gray-500">Pilih Preset Cepat:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset({ pemilikBarang: 90, operational: 10, akbar: 0, nesa: 0, andin: 0, ritza: 0 })}
                      className="px-2.5 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-semibold transition-all"
                    >
                      90% Pemilik / 10% Ops (Akbar)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset({ pemilikBarang: 85, operational: 15, akbar: 0, nesa: 0, andin: 0, ritza: 0 })}
                      className="px-2.5 py-1 text-xs rounded-lg dark:bg-white/5 bg-gray-100 text-gray-300 hover:bg-purple-500/20 text-xs font-medium"
                    >
                      85% / 15% Ops
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset({ pemilikBarang: 80, operational: 20, akbar: 0, nesa: 0, andin: 0, ritza: 0 })}
                      className="px-2.5 py-1 text-xs rounded-lg dark:bg-white/5 bg-gray-100 text-gray-300 hover:bg-purple-500/20 text-xs font-medium"
                    >
                      80% / 20% Ops
                    </button>
                  </div>
                </div>

                {/* Input Persentase Khusus untuk Seluruh 6 Pihak */}
                <div className="space-y-2.5 pt-2 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(profitSharingConfig || {}).map(([key, item]) => (
                    <div
                      key={key}
                      className="p-2.5 rounded-xl dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-xs font-bold dark:text-white text-gray-900">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={formData.customScheme[key] || 0}
                          onChange={(e) => handleCustomSchemeChange(key, e.target.value)}
                          className="w-20 sm:w-28 accent-purple cursor-pointer"
                        />
                        <div className="relative w-16">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.customScheme[key] || 0}
                            onChange={(e) => handleCustomSchemeChange(key, e.target.value)}
                            className="w-full px-2 py-1 pr-6 rounded-lg text-xs text-right font-bold dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900 border dark:border-white/10 border-gray-300"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total meter */}
                <div className="pt-2 border-t border-purple/15 flex items-center justify-between text-xs font-bold">
                  <span className="dark:text-gray-400 text-gray-600">Total Persentase:</span>
                  <span className={totalCustomPercentage === 100 ? 'text-emerald-400' : 'text-red-400'}>
                    {totalCustomPercentage}% / 100% {totalCustomPercentage === 100 ? '✓ (Pas 100%)' : `(Selisih ${totalCustomPercentage - 100}%)`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" loading={submitting} disabled={!isValidCustomTotal}>
              {editingOwner ? 'Simpan Perubahan' : 'Tambah Pemilik'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Konfirmasi Hapus Pemilik"
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm dark:text-white text-gray-900 font-semibold mb-1">
            Hapus pemilik "{deletingOwner?.name}"?
          </p>
          <p className="text-xs dark:text-gray-400 text-gray-500">
            Nama ini tidak akan muncul lagi di opsi pilihan transaksi baru.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} disabled={submitting}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm} loading={submitting}>
            Hapus
          </Button>
        </div>
      </Modal>

      {/* Modal Lihat Barang Milik Pemilik */}
      <OwnerItemsModal
        isOpen={isItemsModalOpen}
        onClose={() => {
          setIsItemsModalOpen(false);
          setViewingOwner(null);
        }}
        owner={viewingOwner}
      />
    </div>
  );
}
