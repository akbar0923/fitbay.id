import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Input, { Select } from '../ui/Input';
import Button from '../ui/Button';
import { CATEGORIES, TRANSACTION_STATUSES, PAYMENT_METHODS, ORDER_SOURCES, SHIPPING_COURIERS } from '../../constants/profitSharingConfig';
import { formatCurrency } from '../../utils/formatCurrency';
import { useOwners } from '../../context/OwnerContext';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { calculateProfitSharing } from '../../utils/calculateProfitSharing';
import toast from 'react-hot-toast';

const defaultCustomPercentages = {
  pemilikBarang: 70,
  operational: 10,
  akbar: 5,
  nesa: 5,
  andin: 5,
  ritza: 5,
};

const initialForm = {
  date: new Date().toISOString().split('T')[0],
  itemName: '',
  ownerName: 'Akbar',
  category: 'Baju',
  costPrice: '',
  sellingPrice: '',
  paymentMethod: 'Transfer Bank',
  sumberPesanan: 'WhatsApp',
  status: 'Terjual',
  kodeBarang: '',
  inventoryItemId: null,
  // Data Pengiriman & Penerima
  namaPenerima: '',
  noHpPenerima: '',
  alamatPenerima: '',
  ekspedisi: 'J&T Express',
  resi: '',
  catatanPengiriman: '',
};

export default function SalesFormModal({ isOpen, onClose, onSubmit, editData }) {
  const { owners, addOwner } = useOwners();
  const { profitSharingConfig } = useSales();
  const { isSuperAdmin, isAdmin } = useAuth();
  const { availableItems } = useInventory();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // State untuk Custom Pembagian Transaksi Ini
  const [isCustomSchemeActive, setIsCustomSchemeActive] = useState(false);
  const [customPercentages, setCustomPercentages] = useState(defaultCustomPercentages);

  // State untuk quick tambah pemilik baru
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [addingOwnerLoading, setAddingOwnerLoading] = useState(false);

  useEffect(() => {
    if (editData) {
      const existingOwnerName = editData.ownerName || (owners[0]?.name || 'Akbar');
      setForm({
        date: editData.date || new Date().toISOString().split('T')[0],
        itemName: editData.itemName || '',
        ownerName: existingOwnerName,
        category: editData.category || 'Baju',
        costPrice: String(editData.costPrice || 0),
        sellingPrice: String(editData.sellingPrice || ''),
        paymentMethod: editData.paymentMethod || 'Transfer Bank',
        sumberPesanan: editData.sumberPesanan || 'WhatsApp',
        status: editData.status || 'Terjual',
        kodeBarang: editData.kodeBarang || '',
        inventoryItemId: editData.inventoryItemId || null,
        // Data Pengiriman
        namaPenerima: editData.namaPenerima || '',
        noHpPenerima: editData.noHpPenerima || '',
        alamatPenerima: editData.alamatPenerima || '',
        ekspedisi: editData.ekspedisi || 'J&T Express',
        resi: editData.resi || '',
        catatanPengiriman: editData.catatanPengiriman || '',
      });

      const savedCustom = editData.skemaCustom || editData.ownerCustomScheme;
      if (savedCustom) {
        setIsCustomSchemeActive(true);
        setCustomPercentages({
          pemilikBarang: Number(savedCustom.pemilikBarang ?? 70),
          operational: Number(savedCustom.operational ?? 10),
          akbar: Number(savedCustom.akbar ?? 0),
          nesa: Number(savedCustom.nesa ?? 0),
          andin: Number(savedCustom.andin ?? 0),
          ritza: Number(savedCustom.ritza ?? 0),
        });
      } else {
        setIsCustomSchemeActive(false);
        setCustomPercentages(defaultCustomPercentages);
      }
    } else {
      setForm({
        ...initialForm,
        ownerName: owners[0]?.name || 'Akbar',
      });
      setIsCustomSchemeActive(false);
      setCustomPercentages(defaultCustomPercentages);
    }
    setErrors({});
    setIsAddingOwner(false);
    setNewOwnerName('');
  }, [editData, isOpen]);

  const selectedOwner = useMemo(() => {
    return owners.find(
      (o) => o.name.toLowerCase() === (form.ownerName || '').toLowerCase()
    );
  }, [owners, form.ownerName]);

  const handleOwnerChange = (newOwner) => {
    handleChange('ownerName', newOwner);
    const ownerObj = owners.find((o) => o.name.toLowerCase() === (newOwner || '').toLowerCase());
    if (ownerObj?.isCustomScheme && ownerObj.customScheme && !isCustomSchemeActive) {
      setCustomPercentages({
        pemilikBarang: Number(ownerObj.customScheme.pemilikBarang ?? 70),
        operational: Number(ownerObj.customScheme.operational ?? 10),
        akbar: Number(ownerObj.customScheme.akbar ?? 0),
        nesa: Number(ownerObj.customScheme.nesa ?? 0),
        andin: Number(ownerObj.customScheme.andin ?? 0),
        ritza: Number(ownerObj.customScheme.ritza ?? 0),
      });
    }
  };

  const effectiveScheme = useMemo(() => {
    if (isCustomSchemeActive) {
      const custom = {};
      Object.keys(profitSharingConfig || {}).forEach((key) => {
        custom[key] = {
          ...profitSharingConfig[key],
          percentage: Number(customPercentages[key] || 0),
        };
      });
      return custom;
    }
    if (selectedOwner?.isCustomScheme && selectedOwner.customScheme) {
      const custom = {};
      Object.keys(profitSharingConfig || {}).forEach((key) => {
        custom[key] = {
          ...profitSharingConfig[key],
          percentage: Number(selectedOwner.customScheme[key] || 0),
        };
      });
      return custom;
    }
    return profitSharingConfig;
  }, [isCustomSchemeActive, customPercentages, selectedOwner, profitSharingConfig]);

  const totalCustomPercentage = useMemo(() => {
    if (!isCustomSchemeActive) return 100;
    return (
      Number(customPercentages.pemilikBarang || 0) +
      Number(customPercentages.operational || 0) +
      Number(customPercentages.akbar || 0) +
      Number(customPercentages.nesa || 0) +
      Number(customPercentages.andin || 0) +
      Number(customPercentages.ritza || 0)
    );
  }, [isCustomSchemeActive, customPercentages]);

  const isValidPercentage = totalCustomPercentage === 100;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handlePercentageChange = (field, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setCustomPercentages((prev) => ({
      ...prev,
      [field]: num,
    }));
  };

  const applyPreset = (presetScheme) => {
    setCustomPercentages({
      pemilikBarang: presetScheme.pemilikBarang ?? 70,
      operational: presetScheme.operational ?? 10,
      akbar: presetScheme.akbar ?? 0,
      nesa: presetScheme.nesa ?? 0,
      andin: presetScheme.andin ?? 0,
      ritza: presetScheme.ritza ?? 0,
    });
  };

  const handleQuickAddOwner = async () => {
    if (!newOwnerName.trim()) {
      toast.error('Nama pemilik tidak boleh kosong');
      return;
    }
    const cleanName = newOwnerName.trim();
    if (owners.some((o) => o.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`Pemilik "${cleanName}" sudah ada di daftar`);
      handleChange('ownerName', cleanName);
      setIsAddingOwner(false);
      return;
    }

    setAddingOwnerLoading(true);
    try {
      await addOwner({
        name: cleanName,
        phone: '-',
        notes: 'Dibuat cepat dari Form Penjualan',
      });
      handleChange('ownerName', cleanName);
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
    if (!form.date) newErrors.date = 'Tanggal wajib diisi';
    if (!form.itemName.trim()) newErrors.itemName = 'Nama barang wajib diisi';
    if (!form.ownerName.trim()) newErrors.ownerName = 'Pemilik barang wajib dipilih';
    if (form.costPrice === '' || form.costPrice === undefined) {
      newErrors.costPrice = 'Harga modal wajib diisi';
    } else if (Number(form.costPrice) < 0) {
      newErrors.costPrice = 'Harga modal tidak boleh negatif';
    }
    if (!form.sellingPrice) {
      newErrors.sellingPrice = 'Harga jual wajib diisi';
    } else if (Number(form.sellingPrice) <= 0) {
      newErrors.sellingPrice = 'Harga jual harus lebih dari 0';
    }

    if (isCustomSchemeActive && !isValidPercentage) {
      newErrors.percentages = `Total persentase harus 100% (saat ini ${totalCustomPercentage}%)`;
      toast.error(`Total persentase custom harus 100% (saat ini ${totalCustomPercentage}%)`);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const customPayload = isCustomSchemeActive
        ? {
            pemilikBarang: Number(customPercentages.pemilikBarang || 0),
            operational: Number(customPercentages.operational || 0),
            akbar: Number(customPercentages.akbar || 0),
            nesa: Number(customPercentages.nesa || 0),
            andin: Number(customPercentages.andin || 0),
            ritza: Number(customPercentages.ritza || 0),
          }
        : null;

      await onSubmit({
        date: form.date,
        itemName: form.itemName.trim(),
        ownerName: form.ownerName.trim(),
        category: form.category,
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        paymentMethod: form.paymentMethod,
        status: form.status,
        isCustomScheme: isCustomSchemeActive,
        skemaCustom: customPayload,
        kodeBarang: form.kodeBarang || null,
        inventoryItemId: form.inventoryItemId || null,
      });
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectInventoryItem = (itemId) => {
    if (!itemId) return;
    const selected = (availableItems || []).find((i) => i.id === itemId);
    if (selected) {
      setForm((prev) => ({
        ...prev,
        itemName: selected.namaBarang,
        category: selected.kategori,
        ownerName: selected.pemilikBarang,
        costPrice: String(selected.hargaModal || 0),
        kodeBarang: selected.kodeBarang,
        inventoryItemId: selected.id,
      }));
      toast.success(`Data barang [${selected.kodeBarang}] ${selected.namaBarang} terisi otomatis!`);
    }
  };

  const previewSelling = Number(form.sellingPrice || 0);
  const previewCost = Number(form.costPrice || 0);
  const previewProfit = previewSelling - previewCost;
  const { sharing: previewSharing } = useMemo(() => {
    return calculateProfitSharing(previewSelling, previewCost, effectiveScheme);
  }, [previewSelling, previewCost, effectiveScheme]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editData ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner Kode Barang Terhubung jika ada */}
        {form.kodeBarang ? (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-between animate-fade-in text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🏷️</span>
              <div>
                <span className="font-semibold dark:text-white text-gray-900">
                  Terhubung dengan Kode Barang:{' '}
                  <strong className="font-mono text-accent font-bold">{form.kodeBarang}</strong>
                </span>
                <p className="text-[11px] dark:text-gray-400 text-gray-500">
                  Status di data inventaris otomatis menjadi Terjual saat transaksi disimpan.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, kodeBarang: '', inventoryItemId: null }))}
              className="text-xs text-gray-400 hover:text-red-400 p-1"
              title="Lepas keterhubungan inventaris"
            >
              ✕ Lepas
            </button>
          </div>
        ) : (
          !editData && availableItems && availableItems.length > 0 && (
            <div className="p-3 rounded-xl dark:bg-surface-300/60 bg-gray-50 border dark:border-white/5 border-gray-200 animate-fade-in">
              <label className="block text-xs font-semibold dark:text-accent text-accent-dark mb-1 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Pilih dari Data Barang Masuk (Inventaris):</span>
              </label>
              <select
                onChange={(e) => handleSelectInventoryItem(e.target.value)}
                defaultValue=""
                className="w-full px-3 py-2 rounded-xl text-xs font-medium dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                <option value="">-- Pilih barang yang siap dijual untuk auto-fill data --</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.kodeBarang}] {item.namaBarang} — {item.pemilikBarang} ({formatCurrency(item.hargaModal)})
                  </option>
                ))}
              </select>
            </div>
          )
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tanggal Transaksi"
            type="date"
            value={form.date}
            onChange={(e) => handleChange('date', e.target.value)}
            error={errors.date}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
                Pemilik Barang (Titipan)
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
                <Button type="button" size="sm" onClick={handleQuickAddOwner} loading={addingOwnerLoading}>
                  Simpan
                </Button>
              </div>
            ) : (
              <div>
                <Select
                  value={form.ownerName}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                  error={errors.ownerName}
                >
                  {owners.map((owner) => (
                    <option key={owner.id || owner.name} value={owner.name}>
                      {owner.name} {owner.isCustomScheme ? `(Profil: ${owner.customScheme?.pemilikBarang}% / ${owner.customScheme?.operational}% Ops)` : ''}
                    </option>
                  ))}
                </Select>
                {!isCustomSchemeActive && selectedOwner?.isCustomScheme && (
                  <p className="text-[11px] text-purple-400 font-semibold mt-1 flex items-center gap-1">
                    <span>⚡ Skema Default Profil:</span>
                    <span>{selectedOwner.customScheme?.pemilikBarang}% Pemilik & {selectedOwner.customScheme?.operational}% Operational</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="p-3.5 rounded-2xl border dark:border-white/10 border-gray-200 dark:bg-surface-300/60 bg-gray-50/80 space-y-3 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⚙️</span>
                <div>
                  <label className="text-xs font-bold dark:text-white text-gray-900 cursor-pointer" onClick={() => setIsCustomSchemeActive(!isCustomSchemeActive)}>
                    Gunakan Pembagian Custom Untuk Transaksi Ini
                  </label>
                  <p className="text-[11px] dark:text-gray-400 text-gray-500">
                    {isCustomSchemeActive
                      ? 'Ubah persentase bebas khusus transaksi ini (tidak mengubah profil pemilik)'
                      : 'Menggunakan skema bawaan profil pemilik / standar global'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomSchemeActive(!isCustomSchemeActive)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                  isCustomSchemeActive ? 'bg-accent' : 'dark:bg-surface-200 bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    isCustomSchemeActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isCustomSchemeActive && (
              <div className="pt-2 border-t dark:border-white/5 border-gray-200 space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="dark:text-gray-400 text-gray-500 font-medium">Pilihan Cepat:</span>
                  {[
                    { label: '70% / 10% / 20% Tim', scheme: { pemilikBarang: 70, operational: 10, akbar: 5, nesa: 5, andin: 5, ritza: 5 } },
                    { label: '85% Pemilik / 15% Ops', scheme: { pemilikBarang: 85, operational: 15, akbar: 0, nesa: 0, andin: 0, ritza: 0 } },
                    { label: '90% Pemilik / 10% Ops', scheme: { pemilikBarang: 90, operational: 10, akbar: 0, nesa: 0, andin: 0, ritza: 0 } },
                    { label: '100% Pemilik', scheme: { pemilikBarang: 100, operational: 0, akbar: 0, nesa: 0, andin: 0, ritza: 0 } },
                  ].map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => applyPreset(preset.scheme)}
                      className="px-2.5 py-1 rounded-lg dark:bg-white/5 bg-white border dark:border-white/10 border-gray-300 hover:border-accent dark:hover:border-accent text-gray-700 dark:text-gray-300 font-medium transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                      👤 Pemilik Barang (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPercentages.pemilikBarang}
                      onChange={(e) => handlePercentageChange('pemilikBarang', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-400 mb-1">
                      ⚙️ Operational (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPercentages.operational}
                      onChange={(e) => handlePercentageChange('operational', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-blue-400 mb-1">
                      👨 Akbar (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPercentages.akbar}
                      onChange={(e) => handlePercentageChange('akbar', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-pink-400 mb-1">
                      👩 Nesa (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPercentages.nesa}
                      onChange={(e) => handlePercentageChange('nesa', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                      👩 Andin (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPercentages.andin}
                      onChange={(e) => handlePercentageChange('andin', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-cyan-400 mb-1">
                      👩 Ritza (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPercentages.ritza}
                      onChange={(e) => handlePercentageChange('ritza', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                      isValidPercentage
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                    }`}
                  >
                    <span>{isValidPercentage ? '✓' : '⚠️'}</span>
                    <span>Total Persentase: {totalCustomPercentage}%</span>
                    {!isValidPercentage && (
                      <span className="font-normal text-[11px]">
                        (Harus tepat 100% — Selisih {100 - totalCustomPercentage > 0 ? `+${100 - totalCustomPercentage}` : 100 - totalCustomPercentage}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nama Barang"
              placeholder="contoh: Nike Air Force 1 / Hoodie Smith"
              value={form.itemName}
              onChange={(e) => handleChange('itemName', e.target.value)}
              error={errors.itemName}
            />
          </div>
          <Select
            label="Kategori"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Harga Modal (Rp)"
            type="number"
            placeholder="0"
            value={form.costPrice}
            onChange={(e) => handleChange('costPrice', e.target.value)}
            error={errors.costPrice}
            min="0"
          />
          <Input
            label="Harga Jual (Rp)"
            type="number"
            placeholder="0"
            value={form.sellingPrice}
            onChange={(e) => handleChange('sellingPrice', e.target.value)}
            error={errors.sellingPrice}
            min="0"
          />
        </div>

        {(form.costPrice !== '' || form.sellingPrice !== '') && (
          <div className={`p-3.5 rounded-xl text-xs font-medium animate-fade-in space-y-1.5
            ${previewProfit > 0
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : previewProfit < 0
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 border dark:border-white/5 border-gray-200'
            }`}>
            <div className="flex justify-between items-center font-bold text-sm">
              <span>Keuntungan Bersih:</span>
              <span>{formatCurrency(previewProfit)}</span>
            </div>

            {isSuperAdmin && previewProfit > 0 && (
              <div className="pt-2 border-t border-emerald-500/15 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {Object.entries(effectiveScheme || {}).map(([k, cfg]) => {
                  const pct = Number(cfg.percentage) || 0;
                  if (pct <= 0) return null;
                  return (
                    <div key={k}>
                      <span className="text-gray-300 font-medium">{cfg.label} ({pct}%):</span>
                      <p className="font-bold text-white">{formatCurrency(previewSharing[k] || 0)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Metode Pembayaran, Sumber Pesanan, & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Sumber Pesanan / Channel"
            value={form.sumberPesanan}
            onChange={(e) => handleChange('sumberPesanan', e.target.value)}
          >
            {ORDER_SOURCES.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </Select>

          <Select
            label="Metode Pembayaran"
            value={form.paymentMethod}
            onChange={(e) => handleChange('paymentMethod', e.target.value)}
          >
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>{pm}</option>
            ))}
          </Select>

          <Select
            label="Status Transaksi"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            {TRANSACTION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        {/* Data Penerima & Pengiriman (Opsional) */}
        <div className="p-4 rounded-2xl border dark:border-white/10 border-gray-200 dark:bg-surface-300/40 bg-gray-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <div>
                <h4 className="text-xs font-bold dark:text-white text-gray-900">
                  Data Penerima & Alamat Pengiriman (Opsional)
                </h4>
                <p className="text-[11px] dark:text-gray-400 text-gray-500">
                  Diisi jika barang perlu dikirimkan melalui ekspedisi (bukan COD/ambil sendiri).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Lengkap Penerima"
              placeholder="Contoh: Budi Santoso"
              value={form.namaPenerima}
              onChange={(e) => handleChange('namaPenerima', e.target.value)}
            />
            <Input
              label="No. WhatsApp / HP Penerima"
              placeholder="Contoh: 081234567890"
              value={form.noHpPenerima}
              onChange={(e) => handleChange('noHpPenerima', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
              Alamat Lengkap Pengiriman (Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Kode Pos)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Jl. Mawar No. 12, RT 04/RW 02, Kel. Menteng, Kec. Menteng, Jakarta Pusat 10310"
              value={form.alamatPenerima}
              onChange={(e) => handleChange('alamatPenerima', e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                dark:placeholder-gray-500 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                transition-all duration-200 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Pilihan Kurir / Ekspedisi"
              value={form.ekspedisi}
              onChange={(e) => handleChange('ekspedisi', e.target.value)}
            >
              {SHIPPING_COURIERS.map((cur) => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </Select>

            <Input
              label="Nomor Resi (Opsional)"
              placeholder="Contoh: JT1234567890"
              value={form.resi}
              onChange={(e) => handleChange('resi', e.target.value)}
            />
          </div>

          <Input
            label="Catatan Khusus Pengiriman (Opsional)"
            placeholder="Contoh: Tolong titipkan di pos satpam jika tidak ada orang / Fragile"
            value={form.catatanPengiriman}
            onChange={(e) => handleChange('catatanPengiriman', e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={(isCustomSchemeActive && !isValidPercentage) || submitting}
          >
            {editData ? 'Simpan Perubahan' : 'Tambah Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
