import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Input, { Select } from '../ui/Input';
import Button from '../ui/Button';
import { CATEGORIES, TRANSACTION_STATUSES, PAYMENT_METHODS } from '../../constants/profitSharingConfig';
import { formatCurrency } from '../../utils/formatCurrency';
import { useOwners } from '../../context/OwnerContext';
import { useSales } from '../../context/SalesContext';
import { calculateProfitSharing } from '../../utils/calculateProfitSharing';

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

  // State untuk quick tambah pemilik baru
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [addingOwnerLoading, setAddingOwnerLoading] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        date: editData.date || new Date().toISOString().split('T')[0],
        itemName: editData.itemName || '',
        ownerName: editData.ownerName || (owners[0]?.name || 'Akbar'),
        category: editData.category || 'Baju',
        costPrice: String(editData.costPrice || 0),
        sellingPrice: String(editData.sellingPrice || ''),
        paymentMethod: editData.paymentMethod || 'Transfer Bank',
        status: editData.status || 'Terjual',
      });
    } else {
      setForm({
        ...initialForm,
        ownerName: owners[0]?.name || 'Akbar',
      });
    }
    setErrors({});
    setIsAddingOwner(false);
    setNewOwnerName('');
  }, [editData, isOpen, owners]);

  // Cek skema bagi hasil pemilik yang dipilih
  const selectedOwner = useMemo(() => {
    return owners.find(
      (o) => o.name.toLowerCase() === (form.ownerName || '').toLowerCase()
    );
  }, [owners, form.ownerName]);

  const effectiveScheme = useMemo(() => {
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
  }, [selectedOwner, profitSharingConfig]);

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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      await onSubmit({
        ...form,
        ownerCustomScheme: selectedOwner?.isCustomScheme ? selectedOwner.customScheme : null,
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
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  error={errors.ownerName}
                >
                  {owners.map((owner) => (
                    <option key={owner.id || owner.name} value={owner.name}>
                      {owner.name} {owner.isCustomScheme ? `(Khusus: ${owner.customScheme?.pemilikBarang}% / ${owner.customScheme?.operational}% Ops)` : ''}
                    </option>
                  ))}
                </Select>
                {selectedOwner?.isCustomScheme && (
                  <p className="text-[11px] text-purple-400 font-semibold mt-1 flex items-center gap-1">
                    <span>⚡ Skema Khusus:</span>
                    <span>{selectedOwner.customScheme?.pemilikBarang}% Pemilik & {selectedOwner.customScheme?.operational}% Operational</span>
                  </p>
                )}
              </div>
            )}
          </div>
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
          <Button type="submit" loading={submitting}>
            {editData ? 'Simpan Perubahan' : 'Tambah Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
