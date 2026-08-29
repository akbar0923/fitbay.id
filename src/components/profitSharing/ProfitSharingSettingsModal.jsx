import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useSales } from '../../context/SalesContext';

export default function ProfitSharingSettingsModal({ isOpen, onClose }) {
  const { profitSharingConfig, updateProfitSharingConfig, resetProfitSharingConfig } = useSales();
  const [configDraft, setConfigDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profitSharingConfig) {
      // Clone config
      const draft = {};
      Object.entries(profitSharingConfig).forEach(([k, v]) => {
        draft[k] = { ...v, percentage: Number(v.percentage) || 0 };
      });
      setConfigDraft(draft);
    }
  }, [profitSharingConfig, isOpen]);

  const handlePercentageChange = (key, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setConfigDraft((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        percentage: num,
      },
    }));
  };

  // Hitung total persentase
  const totalPercentage = Object.values(configDraft).reduce(
    (sum, item) => sum + (Number(item.percentage) || 0),
    0
  );

  const isValidTotal = totalPercentage === 100;
  const difference = totalPercentage - 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidTotal) return;

    try {
      setSaving(true);
      await updateProfitSharingConfig(configDraft);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      await resetProfitSharingConfig();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Persentase Bagi Hasil"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Deskripsi */}
        <p className="text-xs dark:text-gray-400 text-gray-500">
          Atur porsi pembagian keuntungan untuk masing-masing pihak. Total akumulasi seluruh persentase <strong>wajib berjumlah 100%</strong>.
        </p>

        {/* Live Total Meter Bar */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isValidTotal
            ? 'dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/30 border-emerald-200'
            : totalPercentage > 100
            ? 'dark:bg-red-500/10 bg-red-50 dark:border-red-500/30 border-red-200'
            : 'dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/30 border-amber-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold dark:text-gray-300 text-gray-700">Total Akumulasi Persentase:</span>
            <span className={`text-base font-extrabold ${
              isValidTotal
                ? 'text-emerald-400'
                : totalPercentage > 100
                ? 'text-red-400'
                : 'text-amber-400'
            }`}>
              {totalPercentage}% / 100%
            </span>
          </div>

          {/* Progress bar visual */}
          <div className="w-full h-2.5 dark:bg-black/30 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isValidTotal
                  ? 'bg-emerald-500'
                  : totalPercentage > 100
                  ? 'bg-red-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, totalPercentage)}%` }}
            />
          </div>

          <p className="text-[11px] font-medium mt-2">
            {isValidTotal ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span>✓</span> Total sudah tepat 100%. Siap disimpan!
              </span>
            ) : totalPercentage > 100 ? (
              <span className="text-red-400 flex items-center gap-1">
                <span>⚠️</span> Total melebihi 100% (Kelebihan {difference}%). Harap kurangi salah satu pihak.
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <span>⚠️</span> Total masih kurang {Math.abs(difference)}% untuk mencapai 100%.
              </span>
            )}
          </p>
        </div>

        {/* Inputs List */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {Object.entries(configDraft).map(([key, item]) => (
            <div
              key={key}
              className="dark:bg-surface-300 bg-gray-50 dark:border dark:border-white/5 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <span>{item.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold dark:text-white text-gray-900">{item.label}</p>
                  <p className="text-[10px] text-gray-400">Porsi keuntungan</p>
                </div>
              </div>

              {/* Slider & Number Input */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={item.percentage}
                  onChange={(e) => handlePercentageChange(key, e.target.value)}
                  className="flex-1 sm:w-28 accent-accent cursor-pointer"
                />
                <div className="relative w-20">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.percentage}
                    onChange={(e) => handlePercentageChange(key, e.target.value)}
                    className="w-full px-3 py-1.5 pr-7 rounded-lg text-sm text-right font-bold
                      dark:bg-surface-200 bg-white dark:text-white text-gray-900
                      dark:border-white/10 border-gray-300 border
                      focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-white/5 border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-gray-400 hover:text-white transition-colors underline"
          >
            Reset ke Default (70/10/5/5/5/5)
          </button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" loading={saving} disabled={!isValidTotal}>
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
