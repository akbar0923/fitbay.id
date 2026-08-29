import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Input, { Select } from '../ui/Input';
import Button from '../ui/Button';
import { CATEGORIES, TRANSACTION_STATUSES, PAYMENT_METHODS } from '../../constants/profitSharingConfig';
import { formatCurrency } from '../../utils/formatCurrency';
import { useOwners } from '../../context/OwnerContext';
import { useSales } from '../../context/SalesContext';
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
  status: 'Terjual',
};

export default function SalesFormModal({ isOpen, onClose, onSubmit, editData }) {
  const { owners, addOwner } = useOwners();
  const { profitSharingConfig } = useSales();
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
        status: editData.status || 'Terjual',
      });

      // Cek apakah transaksi ini memiliki custom scheme tersimpan
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
  }, [editData, isOpen, owners]);

  // Cek profil pemilik yang dipilih dari master owners
  const selectedOwner = useMemo(() => {
    return owners.find(
      (o) => o.name.toLowerCase() === (form.ownerName || '').toLowerCase()
    );
  }, [owners, form.ownerName]);

  // Ketika pemilik berubah & custom scheme tidak aktif, sinkronkan nilai awal
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

  // Skema efektif yang digunakan untuk kalkulasi dan penyimpanan
  const effectiveScheme = useMemo(() => {
    // 1. Jika toggle custom aktif -> gunakan customPercentages dari form transaksi ini
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

    // 2. Jika tidak aktif -> gunakan skema default dari profil pemilik (jika ada)
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

    // 3. Fallback ke global standard profitSharingConfig
    return profitSharingConfig;
  }, [isCustomSchemeActive, customPercentages, selectedOwner, profitSharingConfig]);

  // Hitung total persentase custom saat ini
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

  const isValidPercentage = !isCustomSchemeActive || totalCustomPercentage === 100;

  const handlePercentageChange = (key, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setCustomPercentages((prev) => ({
      ...prev,
      [key]: num,
    }));
  };

  // Preset skema cepat
  const applyPreset = (preset) => {
    setCustomPercentages({
      pemilikBarang: preset.pemilikBarang || 0,
      operational: preset.operational || 0,
      akbar: preset.akbar || 0,
      nesa: preset.nesa || 0,
      andin: preset.andin || 0,
      ritza: preset.ritza || 0,
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleQuickAddOwner = async () => {
    if (!newOwnerName.trim()) return;
    try {
      setAddingOwnerLoading(true);
      const created = await addOwner({ name: newOwnerName.trim() });
      setForm((prev) => ({ ...prev, ownerName: created.name }));
      setNewOwnerName('');
      setIsAddingOwner(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingOwnerLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.date) newErrors.date = 'Tanggal wajib diisi';
    if (!form.itemName.trim()) newErrors.itemName = 'Nama barang wajib diisi';
    if (!form.ownerName) newErrors.ownerName = 'Pemilik barang wajib dipilih';
    if (form.costPrice === '' || Number(form.costPrice) < 0) newErrors.costPrice = 'Harga modal harus valid';
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) newErrors.sellingPrice = 'Harga jual harus lebih dari 0';

    if (isCustomSchemeActive && totalCustomPercentage !== 100) {
      newErrors.percentage = `Total persentase harus tepat 100% (Saat ini: ${totalCustomPercentage}%)`;
      toast.error(`Total persentase pembagian harus tepat 100% (Saat ini: ${totalCustomPercentage}%)`);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);

      const customPayload = isCustomSchemeActive
        ? {
            pemilikBarang: Number(customPercentages.pemilikBarang || 0),
            operational: Number(customPercentages.operational || 0),
            akbar: Number(customPercentages.akbar || 0),
            nesa: Number(customPercentages.nesa || 0),
            andin: Number(customPercentages.andin || 0),
            ritza: Number(customPercentages.ritza || 0),
          }
        : selectedOwner?.isCustomScheme
        ? selectedOwner.customScheme
        : null;

      await onSubmit({
        ...form,
        ownerCustomScheme: customPayload,
        skemaCustom: customPayload,
      });
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
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
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tanggal & Pemilik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tanggal Transaksi"
            type="date"
            value={form.date}
            onChange={(e) => handleChange('date', e.target.value)}
            error={errors.date}
          />

          {/* Pemilik Barang dengan tombol Tambah Cepat */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
                Pemilik Barang (Titipan)
              </label>
              <button
                type="button"
                onClick={() => setIsAddingOwner(!isAddingOwner)}
                className="text-xs text-accent hover:text-accent-light font-medium transition-colors flex items-center gap-0.5"
              >
                {isAddingOwner ? '✕ Batal' : '+ Tambah Baru'}
              </button>
            </div>

            {isAddingOwner ? (
              <div className="flex gap-2 animate-fade-in">
                <input
                  type="text"
                  placeholder="Nama pemilik baru..."
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-xl text-sm dark:bg-surface-200 bg-white 
                    dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
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

        {/* ========================================================= */}
        {/* FITUR TOGGLE PEMBAGIAN CUSTOM UNTUK TRANSAKSI INI         */}
        {/* ========================================================= */}
        <div className="p-3.5 rounded-2xl border dark:border-white/10 border-gray-200 dark:bg-surface-300/60 bg-gray-50/80 space-y-3 transition-all">
          {/* Header Toggle */}
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

            {/* Custom Toggle Switch */}
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

          {/* Form Input Persentase Custom (Muncul saat toggle aktif) */}
          {isCustomSchemeActive && (
            <div className="pt-2 border-t dark:border-white/5 border-gray-200 space-y-3 animate-fade-in">
              {/* Presets Cepat */}
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
                    className="px-2 py-0.5 rounded-md dark:bg-white/5 bg-white border dark:border-white/10 border-gray-300 hover:border-accent dark:hover:border-accent text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Grid Input Persentase */}
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

              {/* Total Persentase Validator Badge */}
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

        {/* Nama Barang & Kategori */}
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

        {/* Harga Modal & Harga Jual */}
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

        {/* Profit Preview & Rincian Bagi Hasil */}
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

            {previewProfit > 0 && (
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

        {/* Metode Pembayaran & Status Transaksi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={!isValidPercentage || submitting}
          >
            {editData ? 'Simpan Perubahan' : 'Tambah Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
