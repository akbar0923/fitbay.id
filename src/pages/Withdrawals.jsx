import { useState, useMemo } from 'react';
import { useSales } from '../context/SalesContext';
import { useWithdrawals } from '../context/WithdrawalContext';
import { useOwners } from '../context/OwnerContext';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { calculateTotalSharing } from '../utils/calculateProfitSharing';
import { PROFIT_SHARING_CONFIG } from '../constants/profitSharingConfig';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable, SkeletonCard } from '../components/ui/Skeleton';
import * as XLSX from 'xlsx';

export default function Withdrawals() {
  const { transactions, profitSharingConfig } = useSales();
  const { withdrawals, loading, addWithdrawal, updateWithdrawal, deleteWithdrawal, getTotalWithdrawn } = useWithdrawals();
  const { owners } = useOwners();

  // Hitung total hak bagi hasil per penerima dari transaksi yang terjual dengan config dinamis
  const totalEarnedSharing = useMemo(() => {
    const soldTxs = transactions.filter((tx) => tx.status === 'Terjual');
    return calculateTotalSharing(soldTxs, profitSharingConfig);
  }, [transactions, profitSharingConfig]);

  // Daftar opsi penerima penarikan dari profitSharingConfig dinamis
  const recipientOptions = useMemo(() => {
    if (!profitSharingConfig) return [];
    return Object.entries(profitSharingConfig).map(([key, cfg]) => ({
      key,
      label: cfg.label,
      color: cfg.color,
      icon: cfg.icon,
      percentage: cfg.percentage,
    }));
  }, [profitSharingConfig]);

  // State Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  const initialForm = {
    recipientKey: 'akbar',
    recipientName: 'Akbar',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    roundingAmount: '0',
    notes: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // State Filters
  const [filterRecipient, setFilterRecipient] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [search, setSearch] = useState('');

  const handleOpenAdd = (defaultRecipientKey) => {
    setEditingItem(null);
    const rec = recipientOptions.find((r) => r.key === defaultRecipientKey) || recipientOptions[0];
    setFormData({
      ...initialForm,
      recipientKey: rec.key,
      recipientName: rec.label,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      recipientKey: item.recipientKey,
      recipientName: item.recipientName,
      date: item.date,
      amount: String(item.amount),
      roundingAmount: String(item.roundingAmount || 0),
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleRecipientChange = (key) => {
    const rec = recipientOptions.find((r) => r.key === key);
    setFormData((prev) => ({
      ...prev,
      recipientKey: key,
      recipientName: rec ? rec.label : key,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(formData.amount);
    if (!amountNum || amountNum <= 0) return;

    try {
      setSubmitting(true);
      if (editingItem) {
        await updateWithdrawal(editingItem.id, formData);
      } else {
        await addWithdrawal(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      setSubmitting(true);
      await deleteWithdrawal(deletingItem.id);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Data Riwayat
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (filterRecipient && (w.recipientKey || '').toLowerCase() !== filterRecipient.toLowerCase()) {
        return false;
      }
      if (filterDateStart && w.date < filterDateStart) return false;
      if (filterDateEnd && w.date > filterDateEnd) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.recipientName.toLowerCase().includes(q) ||
          (w.notes && w.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [withdrawals, filterRecipient, filterDateStart, filterDateEnd, search]);

  // Perhitungan live preview pada modal form
  const previewAmount = Number(formData.amount) || 0;
  const previewRounding = Number(formData.roundingAmount) || 0;
  const previewTotalTransferred = previewAmount + previewRounding;

  const currentRecipientEarned = totalEarnedSharing[formData.recipientKey] || 0;
  const currentRecipientWithdrawn = getTotalWithdrawn(formData.recipientKey) - (editingItem && editingItem.recipientKey === formData.recipientKey ? Number(editingItem.amount) : 0);
  const currentRecipientRemaining = Math.max(0, currentRecipientEarned - currentRecipientWithdrawn);
  const previewRemainingAfter = Math.max(0, currentRecipientRemaining - previewAmount);

  // Total summary seluruh penarikan
  const totalAllWithdrawn = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const totalAllTransferred = withdrawals.reduce((sum, w) => sum + (Number(w.totalTransferred) || (Number(w.amount) + (Number(w.roundingAmount) || 0))), 0);
  const totalAllRounding = withdrawals.reduce((sum, w) => sum + (Number(w.roundingAmount) || 0), 0);

  const exportToExcel = () => {
    const rows = filteredWithdrawals.map((w) => ({
      Tanggal: formatDate(w.date),
      Penerima: w.recipientName,
      'Nominal Ditarik (Potong Saldo)': w.amount,
      'Pembulatan Nominal': w.roundingAmount || 0,
      'Total Uang Ditransfer': w.totalTransferred || (w.amount + (w.roundingAmount || 0)),
      Catatan: w.notes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penarikan_Saldo');
    XLSX.writeFile(wb, `Fitbay_Riwayat_Penarikan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Penarikan Saldo</h1>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">
            Pencatatan pencairan bagi hasil dengan fitur pembulatan nominal dan pelacakan sisa saldo
          </p>
        </div>
        <Button onClick={() => handleOpenAdd('akbar')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Catat Penarikan Baru
        </Button>
      </div>

      {/* Recipient Balance Cards (6 Pihak) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold dark:text-gray-300 text-gray-700 uppercase tracking-wider">
            Status Saldo Penerima Bagi Hasil
          </h2>
          <span className="text-xs dark:text-gray-500 text-gray-400">
            Sisa Saldo = Total Hak − Total Ditarik
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipientOptions.map((rec) => {
            const earned = totalEarnedSharing[rec.key] || 0;
            const withdrawn = getTotalWithdrawn(rec.key);
            const remaining = Math.max(0, earned - withdrawn);
            const isZero = remaining <= 0;

            return (
              <div
                key={rec.key}
                className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all hover:border-accent/30 flex flex-col justify-between"
              >
                {/* Top bar with percentage color */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 opacity-80"
                  style={{ backgroundColor: rec.color }}
                />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{rec.icon}</span>
                      <div>
                        <h3 className="text-sm font-bold dark:text-white text-gray-900">{rec.label}</h3>
                        <p className="text-[11px] font-medium" style={{ color: rec.color }}>
                          {PROFIT_SHARING_CONFIG[rec.key]?.percentage || 70}% dari keuntungan
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isZero ? 'bg-gray-500/10 text-gray-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                      {isZero ? 'Saldo Habis' : 'Ada Saldo'}
                    </span>
                  </div>

                  {/* Sisa Saldo Tersedia */}
                  <div className="p-3.5 rounded-xl dark:bg-white/[0.02] bg-gray-50 border dark:border-white/5 border-gray-100 my-2">
                    <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-semibold">
                      Sisa Saldo Tersedia
                    </p>
                    <p className="text-xl font-extrabold text-emerald-400 tracking-tight mt-0.5">
                      {formatCurrency(remaining)}
                    </p>
                  </div>

                  {/* Detail Hak & Sudah Ditarik */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    <div>
                      <p className="text-[10px] dark:text-gray-500 text-gray-400">Total Hak Didapat:</p>
                      <p className="font-semibold dark:text-gray-200 text-gray-800">{formatCurrency(earned)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] dark:text-gray-500 text-gray-400">Sudah Ditarik:</p>
                      <p className="font-semibold text-purple">{formatCurrency(withdrawn)}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="pt-4 mt-2 border-t dark:border-white/5 border-gray-100">
                  <button
                    onClick={() => handleOpenAdd(rec.key)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold dark:bg-white/5 bg-gray-100 dark:hover:bg-accent/15 hover:bg-accent/10 dark:text-gray-300 text-gray-700 hover:text-accent dark:hover:text-accent transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>💸</span>
                    <span>Tarik Saldo {rec.label.split(' ')[0]}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Summary Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-400 uppercase">Total Nominal Ditarik (Potong Saldo)</p>
          <p className="text-xl font-bold text-accent mt-1">{formatCurrency(totalAllWithdrawn)}</p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-400 uppercase">Total Selisih Pembulatan</p>
          <p className={`text-xl font-bold mt-1 ${totalAllRounding >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
            {totalAllRounding >= 0 ? `+${formatCurrency(totalAllRounding)}` : formatCurrency(totalAllRounding)}
          </p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-400 uppercase">Total Dana Ditransfer Keluar</p>
          <p className="text-xl font-bold text-purple mt-1">{formatCurrency(totalAllTransferred)}</p>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Cari penerima atau catatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm
                  dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
                  dark:border-white/10 border-gray-300 border
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Filter Penerima */}
            <select
              value={filterRecipient}
              onChange={(e) => setFilterRecipient(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm dark:bg-surface-300 bg-white 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
            >
              <option value="">Semua Penerima</option>
              {recipientOptions.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>

            {/* Filter Tanggal */}
            <input
              type="date"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm dark:bg-surface-300 bg-gray-100 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none"
            />
            <span className="text-xs dark:text-gray-500 text-gray-400">—</span>
            <input
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm dark:bg-surface-300 bg-gray-100 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none"
            />

            {(filterRecipient || filterDateStart || filterDateEnd || search) && (
              <button
                onClick={() => { setFilterRecipient(''); setFilterDateStart(''); setFilterDateEnd(''); setSearch(''); }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                ✕ Reset
              </button>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={exportToExcel}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Excel
          </Button>
        </div>
      </div>

      {/* Riwayat Penarikan Table */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : filteredWithdrawals.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat penarikan"
          description="Catat penarikan bagi hasil pertama untuk pihak penerima"
          action={
            <Button onClick={() => handleOpenAdd('akbar')}>
              Catat Penarikan Pertama
            </Button>
          }
        />
      ) : (
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-white/[0.02] bg-gray-50 border-b dark:border-white/5 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Penerima</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Nominal Ditarik (Potong Saldo)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Pembulatan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Total Ditransfer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Catatan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                {filteredWithdrawals.map((w) => {
                  const recInfo = recipientOptions.find((r) => r.key === w.recipientKey) || { color: '#10B981', icon: '👤' };
                  const rounding = Number(w.roundingAmount) || 0;
                  const totalTf = Number(w.totalTransferred) || (Number(w.amount) + rounding);

                  return (
                    <tr key={w.id} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 text-sm dark:text-gray-300 text-gray-700 whitespace-nowrap">
                        {formatDate(w.date)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: `${recInfo.color}15`, color: recInfo.color }}>
                          <span>{recInfo.icon}</span>
                          <span>{w.recipientName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-sm text-accent whitespace-nowrap">
                        {formatCurrency(w.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs whitespace-nowrap">
                        {rounding !== 0 ? (
                          <span className={`px-2 py-0.5 rounded font-medium ${rounding > 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {rounding > 0 ? `+${formatCurrency(rounding)}` : formatCurrency(rounding)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-sm text-purple whitespace-nowrap">
                        {formatCurrency(totalTf)}
                      </td>
                      <td className="px-4 py-3.5 text-xs dark:text-gray-400 text-gray-500 max-w-xs truncate">
                        {w.notes || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(w)}
                            className="p-1.5 rounded-lg dark:text-gray-400 text-gray-500 hover:text-blue-400 dark:hover:bg-blue-500/10"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setDeletingItem(w); setIsDeleteOpen(true); }}
                            className="p-1.5 rounded-lg dark:text-gray-400 text-gray-500 hover:text-red-400 dark:hover:bg-red-500/10"
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

      {/* Form Modal Catat Penarikan */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Penarikan Saldo' : 'Catat Penarikan Saldo Baru'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilihan Penerima & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Pihak Penerima Saldo"
              value={formData.recipientKey}
              onChange={(e) => handleRecipientChange(e.target.value)}
            >
              {recipientOptions.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </Select>

            <Input
              label="Tanggal Penarikan"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Info Saldo Tersedia Saat Ini */}
          <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200 flex justify-between items-center text-xs">
            <span className="dark:text-gray-400 text-gray-600">Saldo Tersedia {formData.recipientName}:</span>
            <span className="font-bold text-sm text-emerald-400">{formatCurrency(currentRecipientRemaining)}</span>
          </div>

          {/* Nominal Penarikan Asli */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
                Nominal Ditarik (Potong Saldo) (Rp)
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, amount: String(currentRecipientRemaining) })}
                className="text-xs text-accent hover:underline font-medium"
              >
                Tarik Semua ({formatCurrency(currentRecipientRemaining)})
              </button>
            </div>
            <Input
              type="number"
              placeholder="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              min="1"
              required
              autoFocus
            />
          </div>

          {/* Input Pembulatan Nominal */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
              Pembulatan Nominal (Rp) <span className="text-xs font-normal text-gray-400">(Opsional / Tidak memotong saldo)</span>
            </label>
            <Input
              type="number"
              placeholder="0"
              value={formData.roundingAmount}
              onChange={(e) => setFormData({ ...formData, roundingAmount: e.target.value })}
            />
            {/* Quick Rounding Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] dark:text-gray-500 text-gray-400">Pilih Cepat:</span>
              {[0, 500, 1000, 1500, 2000, 2500, 5000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setFormData({ ...formData, roundingAmount: String(val) })}
                  className="px-2 py-0.5 text-xs rounded-lg dark:bg-white/5 bg-gray-100 hover:bg-accent/15 dark:hover:bg-accent/15 hover:text-accent text-gray-600 dark:text-gray-300"
                >
                  +{val.toLocaleString('id-ID')}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Box Perhitungan */}
          <div className="p-4 rounded-xl dark:bg-purple/5 bg-purple/5 border border-purple/20 space-y-2 text-xs">
            <div className="flex justify-between items-center dark:text-gray-300 text-gray-700">
              <span>Nominal Asli (Memotong Saldo):</span>
              <span className="font-semibold">{formatCurrency(previewAmount)}</span>
            </div>
            <div className="flex justify-between items-center dark:text-gray-300 text-gray-700">
              <span>Selisih Pembulatan:</span>
              <span className="font-semibold text-blue-400">
                {previewRounding >= 0 ? `+${formatCurrency(previewRounding)}` : formatCurrency(previewRounding)}
              </span>
            </div>
            <div className="pt-2 border-t border-purple/15 flex justify-between items-center text-sm">
              <span className="font-bold dark:text-white text-gray-900">Total Uang yang Ditransfer:</span>
              <span className="font-extrabold text-base text-purple">{formatCurrency(previewTotalTransferred)}</span>
            </div>
            <div className="pt-1 flex justify-between items-center text-[11px] text-gray-400">
              <span>Sisa Saldo Setelah Penarikan Ini:</span>
              <span className="font-bold text-emerald-400">{formatCurrency(previewRemainingAfter)}</span>
            </div>
          </div>

          {/* Catatan */}
          <Input
            label="Catatan / Info Rekening Penerima"
            placeholder="contoh: Transfer via BCA 12345678 a.n Akbar"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" loading={submitting}>
              {editingItem ? 'Simpan Perubahan' : 'Catat Penarikan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Konfirmasi Hapus Penarikan"
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm dark:text-white text-gray-900 font-semibold mb-1">
            Hapus riwayat penarikan {formatCurrency(deletingItem?.amount)}?
          </p>
          <p className="text-xs dark:text-gray-400 text-gray-500">
            Saldo {deletingItem?.recipientName} akan otomatis dikembalikan bertambah sebesar {formatCurrency(deletingItem?.amount)}.
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
    </div>
  );
}
