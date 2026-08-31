import { useState, useMemo } from 'react';
import { useSales } from '../context/SalesContext';
import { useWithdrawals } from '../context/WithdrawalContext';
import { useOwners } from '../context/OwnerContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { calculateTotalSharing } from '../utils/calculateProfitSharing';
import { PROFIT_SHARING_CONFIG, TEAM_MEMBER_KEYS, getTeamMemberKey } from '../constants/profitSharingConfig';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import BulkActionBar from '../components/common/BulkActionBar';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function Withdrawals() {
  const { transactions, profitSharingConfig } = useSales();
  const {
    withdrawals,
    loading,
    addWithdrawal,
    updateWithdrawal,
    deleteWithdrawal,
    getTotalWithdrawn,
    getTotalWithdrawnByOwner,
  } = useWithdrawals();
  const { owners } = useOwners();
  const { isAdmin, isSuperAdmin } = useAuth();

  // Selection states
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Hitung total komisi tim standar (5% tim / 10% ops) dari transaksi terjual
  const totalStandardSharing = useMemo(() => {
    const soldTxs = transactions.filter((tx) => tx.status === 'Terjual');
    return calculateTotalSharing(soldTxs, profitSharingConfig);
  }, [transactions, profitSharingConfig]);

  // =========================================================================
  // Perhitungan Pemisahan Saldo Barang: Tim Internal vs Penitip Eksternal
  // =========================================================================
  const { teamPersonalGoods, externalOwnerBalances, externalTotalEarned } = useMemo(() => {
    // Inisialisasi akumulasi barang pribadi anggota tim (Akbar, Nesa, Andin, Ritza)
    const teamGoods = {
      akbar: { earned: 0, totalItems: 0, totalRevenue: 0 },
      nesa: { earned: 0, totalItems: 0, totalRevenue: 0 },
      andin: { earned: 0, totalItems: 0, totalRevenue: 0 },
      ritza: { earned: 0, totalItems: 0, totalRevenue: 0 },
    };

    // Inisialisasi daftar pemilik eksternal dari master owners
    const extMap = {};
    owners.forEach((o) => {
      const cleanName = (o.name || '').trim();
      const lower = cleanName.toLowerCase();
      if (!lower) return;

      // Jika BUKAN anggota tim, masukkan ke daftar pemilik eksternal
      if (!getTeamMemberKey(lower)) {
        extMap[lower] = {
          name: cleanName,
          phone: o.phone || '-',
          notes: o.notes || '',
          totalItems: 0,
          totalRevenue: 0,
          earned: 0,
        };
      }
    });

    let extEarnedSum = 0;

    // Iterasi seluruh transaksi yang statusnya Terjual
    transactions.forEach((tx) => {
      if (tx.status !== 'Terjual') return;

      const rawOwner = (tx.ownerName || tx.owner || 'Akbar').trim();
      const lowerOwner = rawOwner.toLowerCase();
      const teamKey = getTeamMemberKey(lowerOwner);
      const defaultOwnerPct = profitSharingConfig?.pemilikBarang?.percentage || 70;
      const ownerShare = tx.profitSharing?.pemilikBarang !== undefined
        ? Number(tx.profitSharing.pemilikBarang)
        : (Number(tx.profit || 0) * defaultOwnerPct) / 100;

      if (teamKey && teamGoods[teamKey]) {
        // 1. Jika pemilik barang adalah ANGGOTA TIM -> masuk ke saldo barang pribadi tim
        teamGoods[teamKey].earned += Math.round(ownerShare);
        teamGoods[teamKey].totalItems += 1;
        teamGoods[teamKey].totalRevenue += Number(tx.sellingPrice) || 0;
      } else {
        // 2. Jika pemilik barang adalah PENITIP EKSTERNAL -> masuk ke saldo pemilik eksternal
        extEarnedSum += Math.round(ownerShare);

        if (!extMap[lowerOwner]) {
          extMap[lowerOwner] = {
            name: rawOwner.charAt(0).toUpperCase() + rawOwner.slice(1),
            phone: '-',
            notes: '',
            totalItems: 0,
            totalRevenue: 0,
            earned: 0,
          };
        }

        extMap[lowerOwner].earned += Math.round(ownerShare);
        extMap[lowerOwner].totalItems += 1;
        extMap[lowerOwner].totalRevenue += Number(tx.sellingPrice) || 0;
      }
    });

    // Format list pemilik eksternal dengan penarikan & sisa saldo
    const extList = Object.values(extMap).map((o) => {
      const withdrawn = getTotalWithdrawnByOwner(o.name);
      const remaining = Math.max(0, o.earned - withdrawn);
      return {
        ...o,
        withdrawn,
        remaining,
      };
    }).sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.name.localeCompare(b.name);
    });

    return {
      teamPersonalGoods: teamGoods,
      externalOwnerBalances: extList,
      externalTotalEarned: extEarnedSum,
    };
  }, [transactions, owners, getTotalWithdrawnByOwner]);

  // Daftar opsi penerima penarikan dari profitSharingConfig
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

  // State Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isOwnerDetailOpen, setIsOwnerDetailOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  // Form State
  const initialForm = {
    category: 'team', // 'team' | 'external_owner'
    recipientKey: 'akbar',
    recipientName: 'Akbar',
    ownerName: '',
    sourceType: 'all', // 'all' | 'commission' | 'personal_goods'
    date: new Date().toISOString().split('T')[0],
    amount: '',
    roundingAmount: '0',
    notes: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [filterRecipient, setFilterRecipient] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [search, setSearch] = useState('');

  // Owner Modal Filter State
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerTabFilter, setOwnerTabFilter] = useState('all'); // 'all' | 'has_balance' | 'zero_balance'

  // Buka modal penarikan untuk tim
  const handleOpenAddTeam = (teamKey) => {
    setEditingItem(null);
    const rec = recipientOptions.find((r) => r.key === teamKey) || recipientOptions[0];
    setFormData({
      ...initialForm,
      category: teamKey === 'pemilikBarang' ? 'external_owner' : 'team',
      recipientKey: rec.key,
      recipientName: rec.label,
      ownerName: teamKey === 'pemilikBarang' ? 'Semua Penitip Eksternal' : '',
    });
    setIsModalOpen(true);
  };

  // Buka modal penarikan untuk pemilik barang eksternal spesifik
  const handleOpenAddExternalOwner = (ownerName) => {
    setEditingItem(null);
    const cleanName = ownerName.trim();
    setFormData({
      ...initialForm,
      category: 'external_owner',
      recipientKey: `owner_${cleanName.toLowerCase()}`,
      recipientName: `Pemilik: ${cleanName}`,
      ownerName: cleanName,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const isExternalOwner =
      item.recipientCategory === 'external_owner' ||
      item.recipientCategory === 'owner' ||
      item.recipientKey === 'pemilikBarang' ||
      (Boolean(item.ownerName) && !getTeamMemberKey(item.ownerName));

    setFormData({
      category: isExternalOwner ? 'external_owner' : 'team',
      recipientKey: item.recipientKey,
      recipientName: item.recipientName,
      ownerName: item.ownerName || '',
      sourceType: item.sourceType || 'all',
      date: item.date,
      amount: String(item.amount),
      roundingAmount: String(item.roundingAmount || 0),
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  // Handler saat kategori penerima berubah
  const handleCategoryChange = (cat) => {
    if (cat === 'team') {
      const defaultTeam = recipientOptions.find((r) => r.key !== 'pemilikBarang') || recipientOptions[0];
      setFormData((prev) => ({
        ...prev,
        category: 'team',
        recipientKey: defaultTeam.key,
        recipientName: defaultTeam.label,
        ownerName: '',
      }));
    } else {
      const defaultOwner = externalOwnerBalances[0]?.name || 'Atun';
      setFormData((prev) => ({
        ...prev,
        category: 'external_owner',
        recipientKey: `owner_${defaultOwner.toLowerCase()}`,
        recipientName: `Pemilik: ${defaultOwner}`,
        ownerName: defaultOwner,
      }));
    }
  };

  const handleTeamRecipientChange = (key) => {
    const rec = recipientOptions.find((r) => r.key === key);
    setFormData((prev) => ({
      ...prev,
      recipientKey: key,
      recipientName: rec ? rec.label : key,
      ownerName: '',
    }));
  };

  const handleSpecificExternalOwnerChange = (name) => {
    const cleanName = name.trim();
    if (cleanName === 'ALL') {
      setFormData((prev) => ({
        ...prev,
        recipientKey: 'pemilikBarang',
        recipientName: 'Pemilik Barang (Penitip Eksternal)',
        ownerName: 'Semua Penitip Eksternal',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        recipientKey: `owner_${cleanName.toLowerCase()}`,
        recipientName: `Pemilik: ${cleanName}`,
        ownerName: cleanName,
      }));
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredWithdrawals.length && filteredWithdrawals.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWithdrawals.map((w) => w.id)));
    }
  };

  const handleToggleSelectOne = (id, e) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const count = selectedIds.size;
      const promises = Array.from(selectedIds).map((id) => deleteWithdrawal(id));
      await Promise.all(promises);
      toast.success(`Berhasil menghapus ${count} riwayat penarikan terpilih!`);
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus beberapa data penarikan.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(formData.amount);
    if (!amountNum || amountNum <= 0) return;

    try {
      setSubmitting(true);
      const payload = {
        recipientKey: formData.recipientKey,
        recipientName: formData.recipientName,
        recipientCategory: formData.category,
        ownerName: formData.category === 'external_owner' ? formData.ownerName : null,
        sourceType: formData.sourceType,
        date: formData.date,
        amount: amountNum,
        roundingAmount: Number(formData.roundingAmount) || 0,
        notes: formData.notes,
      };

      if (editingItem) {
        await updateWithdrawal(editingItem.id, payload);
      } else {
        await addWithdrawal(payload);
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

  // ==========================================
  // Live Preview Perhitungan pada Modal
  // ==========================================
  const previewAmount = Number(formData.amount) || 0;
  const previewRounding = Number(formData.roundingAmount) || 0;
  const previewTotalTransferred = previewAmount + previewRounding;

  // Hitung saldo tersedia untuk penerima yang sedang dipilih di form modal
  const currentRecipientDetails = useMemo(() => {
    if (formData.category === 'external_owner') {
      if (formData.ownerName && formData.ownerName !== 'Semua Penitip Eksternal') {
        const ownerObj = externalOwnerBalances.find(
          (o) => o.name.toLowerCase() === formData.ownerName.toLowerCase()
        );
        const earned = ownerObj ? ownerObj.earned : 0;
        const withdrawn = getTotalWithdrawnByOwner(formData.ownerName);
        const editingCompensation =
          editingItem && editingItem.ownerName?.toLowerCase() === formData.ownerName.toLowerCase()
            ? Number(editingItem.amount)
            : 0;
        const remaining = Math.max(0, earned - (withdrawn - editingCompensation));
        return {
          totalEarned: earned,
          commission: 0,
          personalGoods: earned,
          withdrawn,
          remaining,
          label: formData.ownerName,
        };
      }

      // General external owners
      const withdrawn = getTotalWithdrawn('pemilikBarang');
      const editingComp = editingItem && editingItem.recipientKey === 'pemilikBarang' ? Number(editingItem.amount) : 0;
      const remaining = Math.max(0, externalTotalEarned - (withdrawn - editingComp));
      return {
        totalEarned: externalTotalEarned,
        commission: 0,
        personalGoods: externalTotalEarned,
        withdrawn,
        remaining,
        label: 'Penitip Eksternal (Gabungan)',
      };
    }

    // Team Member / Operational
    const teamKey = formData.recipientKey;
    if (teamKey === 'operational') {
      const earned = totalStandardSharing.operational || 0;
      const withdrawn = getTotalWithdrawn('operational');
      const editingComp = editingItem && editingItem.recipientKey === 'operational' ? Number(editingItem.amount) : 0;
      const remaining = Math.max(0, earned - (withdrawn - editingComp));
      return {
        totalEarned: earned,
        commission: earned,
        personalGoods: 0,
        withdrawn,
        remaining,
        label: 'Operasional',
      };
    }

    // Individual Team Members (Akbar, Nesa, Andin, Ritza)
    const commissionEarned = totalStandardSharing[teamKey] || 0;
    const personalGoodsEarned = teamPersonalGoods[teamKey]?.earned || 0;
    const totalCombinedEarned = commissionEarned + personalGoodsEarned;

    const withdrawn = getTotalWithdrawn(teamKey);
    const editingComp =
      editingItem && (editingItem.recipientKey === teamKey || editingItem.recipientKey === `owner_${teamKey}`)
        ? Number(editingItem.amount)
        : 0;

    const remaining = Math.max(0, totalCombinedEarned - (withdrawn - editingComp));
    const recObj = recipientOptions.find((r) => r.key === teamKey);

    return {
      totalEarned: totalCombinedEarned,
      commission: commissionEarned,
      personalGoods: personalGoodsEarned,
      withdrawn,
      remaining,
      label: recObj ? recObj.label : teamKey,
    };
  }, [
    formData.category,
    formData.ownerName,
    formData.recipientKey,
    externalOwnerBalances,
    externalTotalEarned,
    totalStandardSharing,
    teamPersonalGoods,
    recipientOptions,
    getTotalWithdrawn,
    getTotalWithdrawnByOwner,
    editingItem,
  ]);

  const currentRecipientRemaining = currentRecipientDetails.remaining;
  const previewRemainingAfter = Math.max(0, currentRecipientRemaining - previewAmount);

  // Total summary seluruh penarikan & saldo keseluruhan
  const totalAllWithdrawn = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const totalAllTransferred = withdrawals.reduce(
    (sum, w) => sum + (Number(w.totalTransferred) || Number(w.amount) + (Number(w.roundingAmount) || 0)),
    0
  );
  const totalAllRounding = withdrawals.reduce((sum, w) => sum + (Number(w.roundingAmount) || 0), 0);

  // Total keuntungan bisnis & penitip dari transaksi terjual
  const totalOverallEarned = useMemo(() => {
    return transactions
      .filter((t) => t.status === 'Terjual')
      .reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
  }, [transactions]);

  // Total Saldo Belum Ditarik Secara Keseluruhan (Sisa Kas / Hak Belum Cair)
  const totalOverallRemaining = Math.max(0, totalOverallEarned - totalAllWithdrawn);

  // Filter Data Riwayat Penarikan
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (filterRecipient) {
        const matchRec = (w.recipientKey || '').toLowerCase() === filterRecipient.toLowerCase();
        const matchOwner = (w.ownerName || '').toLowerCase() === filterRecipient.toLowerCase();
        if (!matchRec && !matchOwner) return false;
      }
      if (filterDateStart && w.date < filterDateStart) return false;
      if (filterDateEnd && w.date > filterDateEnd) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.recipientName.toLowerCase().includes(q) ||
          (w.ownerName && w.ownerName.toLowerCase().includes(q)) ||
          (w.notes && w.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [withdrawals, filterRecipient, filterDateStart, filterDateEnd, search]);

  // Filter Data untuk Modal Rincian Pemilik Eksternal
  const filteredExternalOwnerList = useMemo(() => {
    return externalOwnerBalances.filter((o) => {
      if (ownerTabFilter === 'has_balance' && o.remaining <= 0) return false;
      if (ownerTabFilter === 'zero_balance' && o.remaining > 0) return false;

      if (ownerSearch) {
        const q = ownerSearch.toLowerCase();
        return (
          o.name.toLowerCase().includes(q) ||
          (o.notes && o.notes.toLowerCase().includes(q)) ||
          (o.phone && o.phone.includes(q))
        );
      }
      return true;
    });
  }, [externalOwnerBalances, ownerTabFilter, ownerSearch]);

  // Export Riwayat ke Excel
  const exportToExcel = () => {
    const rows = filteredWithdrawals.map((w) => ({
      Tanggal: formatDate(w.date),
      Penerima: w.recipientName,
      'Kategori Penerima': w.ownerName ? `Penitip Eksternal: ${w.ownerName}` : 'Tim Internal Fitbay',
      'Nominal Ditarik (Potong Saldo)': w.amount,
      'Pembulatan Nominal': w.roundingAmount || 0,
      'Total Uang Ditransfer': w.totalTransferred || w.amount + (w.roundingAmount || 0),
      Catatan: w.notes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penarikan_Saldo');
    XLSX.writeFile(wb, `Fitbay_Riwayat_Penarikan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export Rincian Saldo Pemilik Eksternal ke Excel
  const exportExternalOwnerBalancesToExcel = () => {
    const rows = externalOwnerBalances.map((o, idx) => ({
      No: idx + 1,
      'Nama Penitip Eksternal': o.name,
      'Barang Terjual': `${o.totalItems} item`,
      'Total Penjualan Barang': o.totalRevenue,
      'Total Hak Pemilik (70%)': o.earned,
      'Sudah Ditarik': o.withdrawn,
      'Sisa Saldo Tersedia': o.remaining,
      Kontak: o.phone || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Saldo_Penitip_Eksternal');
    XLSX.writeFile(wb, `Fitbay_Saldo_Penitip_Eksternal_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Penarikan Saldo</h1>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">
            Pencairan bagi hasil tim (gabungan komisi + barang pribadi) & pelacakan saldo penitip eksternal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsOwnerDetailOpen(true)}>
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            Rincian Penitip Eksternal ({externalOwnerBalances.length})
          </Button>
          <Button onClick={() => handleOpenAddTeam('akbar')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Catat Penarikan Baru
          </Button>
        </div>
      </div>

      {/* Ringkasan Keseluruhan: Total Saldo Belum Ditarik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Keuntungan Keseluruhan */}
        <div className="dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold dark:text-gray-400 text-gray-500 uppercase tracking-wider block mb-1">
              Total Seluruh Keuntungan
            </span>
            <p className="text-2xl lg:text-3xl font-extrabold dark:text-white text-gray-900 tracking-tight">
              {formatCurrency(totalOverallEarned)}
            </p>
          </div>
          <p className="text-xs dark:text-gray-500 text-gray-400 mt-2 flex items-center gap-1">
            <span>📈</span>
            <span>Akumulasi dari seluruh transaksi terjual</span>
          </p>
        </div>

        {/* Total Sudah Ditarik */}
        <div className="dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold dark:text-gray-400 text-gray-500 uppercase tracking-wider block mb-1">
              Total Sudah Dicairkan (Ditarik)
            </span>
            <p className="text-2xl lg:text-3xl font-extrabold text-gray-400 tracking-tight">
              {formatCurrency(totalAllWithdrawn)}
            </p>
          </div>
          <p className="text-xs dark:text-gray-500 text-gray-400 mt-2 flex items-center gap-1">
            <span>💸</span>
            <span>{withdrawals.length} riwayat pencairan saldo tercatat</span>
          </p>
        </div>

        {/* Total Saldo BELUM DITARIK Keseluruhan */}
        <div className="dark:bg-surface-200 bg-white border-2 border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-emerald-500/5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                Total Saldo Belum Ditarik (Keseluruhan)
              </span>
              <span className="text-base">💰</span>
            </div>
            <p className="text-2xl lg:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {formatCurrency(totalOverallRemaining)}
            </p>
          </div>
          <p className="text-xs text-emerald-400/80 mt-2 font-medium">
            Sisa saldo gabungan seluruh tim & penitip eksternal
          </p>
        </div>
      </div>

      {/* Recipient Balance Cards (Status Saldo) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold dark:text-gray-300 text-gray-700 uppercase tracking-wider">
            Status Saldo Penerima Bagi Hasil
          </h2>
          <span className="text-xs dark:text-gray-500 text-gray-400">
            Hak Tim = Komisi 5% + Keuntungan Barang Pribadi (70%)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipientOptions.map((rec) => {
            const isOwnerCard = rec.key === 'pemilikBarang';
            const isTeamMember = TEAM_MEMBER_KEYS.includes(rec.key);

            // 1. Jika kartu Pemilik Barang -> Khusus Penitip Eksternal (Non-Tim)
            let earned = 0;
            let withdrawn = 0;
            let remaining = 0;
            let commissionEarned = 0;
            let personalGoodsEarned = 0;
            let personalItemsCount = 0;

            if (isOwnerCard) {
              earned = externalTotalEarned;
              withdrawn = getTotalWithdrawn('pemilikBarang');
              remaining = Math.max(0, earned - withdrawn);
            } else if (isTeamMember) {
              // 2. Jika kartu Anggota Tim -> Gabungan Komisi Tim (5%) + Keuntungan Barang Pribadi (70%)
              commissionEarned = totalStandardSharing[rec.key] || 0;
              personalGoodsEarned = teamPersonalGoods[rec.key]?.earned || 0;
              personalItemsCount = teamPersonalGoods[rec.key]?.totalItems || 0;
              earned = commissionEarned + personalGoodsEarned;

              withdrawn = getTotalWithdrawn(rec.key);
              remaining = Math.max(0, earned - withdrawn);
            } else {
              // 3. Operasional (10%)
              earned = totalStandardSharing[rec.key] || 0;
              withdrawn = getTotalWithdrawn(rec.key);
              remaining = Math.max(0, earned - withdrawn);
            }

            const isZero = remaining <= 0;

            return (
              <div
                key={rec.key}
                className={`dark:bg-surface-200 bg-white dark:border ${
                  isOwnerCard
                    ? 'dark:border-emerald-500/30 border-emerald-300 ring-1 ring-emerald-500/20'
                    : 'dark:border-white/5 border-gray-200'
                } rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all hover:border-accent/40 flex flex-col justify-between`}
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
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold dark:text-white text-gray-900">{rec.label}</h3>
                          {isOwnerCard && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                              {externalOwnerBalances.length} Penitip
                            </span>
                          )}
                          {isTeamMember && personalItemsCount > 0 && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded" title="Ada barang pribadi yang terjual">
                              +Barang Pribadi
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium" style={{ color: rec.color }}>
                          {isOwnerCard
                            ? '70% dari keuntungan barang titipan luar'
                            : isTeamMember
                            ? `5% Komisi Tim ${personalGoodsEarned > 0 ? '+ Keuntungan Barang Pribadi' : ''}`
                            : '10% dari keuntungan toko'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isZero ? 'bg-gray-500/10 text-gray-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {isZero ? 'Saldo Habis' : 'Ada Saldo'}
                    </span>
                  </div>

                  {/* Sisa Saldo Tersedia */}
                  <div className="p-3.5 rounded-xl dark:bg-white/[0.02] bg-gray-50 border dark:border-white/5 border-gray-100 my-2">
                    <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-semibold">
                      Sisa Saldo Tersedia {isOwnerCard ? '(Penitip Luar)' : isTeamMember ? '(Total Gabungan)' : ''}
                    </p>
                    <p className="text-xl font-extrabold text-emerald-400 tracking-tight mt-0.5">
                      {formatCurrency(remaining)}
                    </p>
                  </div>

                  {/* Breakdown Sumber Hak untuk Anggota Tim */}
                  {isTeamMember ? (
                    <div className="space-y-1 p-2 rounded-xl dark:bg-surface-300 bg-gray-100/70 text-xs my-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="dark:text-gray-400 text-gray-600 flex items-center gap-1">
                          <span>👥</span> Komisi Tim (5%):
                        </span>
                        <span className="font-semibold dark:text-white text-gray-900">{formatCurrency(commissionEarned)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="dark:text-gray-400 text-gray-600 flex items-center gap-1">
                          <span>📦</span> Barang Pribadi (70%):
                        </span>
                        <span className="font-semibold text-accent">
                          {formatCurrency(personalGoodsEarned)}
                          {personalItemsCount > 0 && <span className="text-[10px] text-gray-400 ml-1">({personalItemsCount} pcs)</span>}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Detail Total Hak & Sudah Ditarik */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
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
                <div className="pt-4 mt-2 border-t dark:border-white/5 border-gray-100 flex flex-col gap-2">
                  {isOwnerCard ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsOwnerDetailOpen(true)}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                        <span>Lihat Rincian Penitip Luar ({externalOwnerBalances.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddTeam('pemilikBarang')}
                        className="w-full py-1.5 px-3 rounded-xl text-[11px] font-medium dark:bg-white/5 bg-gray-100 hover:dark:bg-white/10 hover:bg-gray-200 dark:text-gray-400 text-gray-600 transition-all flex items-center justify-center gap-1"
                      >
                        <span>💸</span>
                        <span>Tarik Saldo Penitip Eksternal</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAddTeam(rec.key)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold dark:bg-white/5 bg-gray-100 dark:hover:bg-accent/15 hover:bg-accent/10 dark:text-gray-300 text-gray-700 hover:text-accent dark:hover:text-accent transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>💸</span>
                      <span>Tarik Saldo {rec.label.split(' ')[0]}</span>
                    </button>
                  )}
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
                placeholder="Cari penerima / catatan..."
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
              <optgroup label="Bagi Hasil Tim Internal">
                {recipientOptions
                  .filter((r) => r.key !== 'pemilikBarang')
                  .map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
              </optgroup>
              <optgroup label="Penitip Eksternal (Luar)">
                {externalOwnerBalances.map((o) => (
                  <option key={o.name} value={o.name}>Pemilik: {o.name}</option>
                ))}
              </optgroup>
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
                type="button"
                onClick={() => { setFilterRecipient(''); setFilterDateStart(''); setFilterDateEnd(''); setSearch(''); }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                ✕ Reset
              </button>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={exportToExcel}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3" />
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
            <Button onClick={() => handleOpenAddTeam('akbar')}>
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
                  <th className="px-4 py-3 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredWithdrawals.length > 0 && selectedIds.size === filteredWithdrawals.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                      title="Pilih Semua Penarikan"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Penerima & Kategori</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Nominal Ditarik (Potong Saldo)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Pembulatan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Total Ditransfer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Catatan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                {filteredWithdrawals.map((w) => {
                  const isExternalOwner =
                    w.recipientCategory === 'external_owner' ||
                    w.recipientCategory === 'owner' ||
                    w.recipientKey === 'pemilikBarang' ||
                    (Boolean(w.ownerName) && !getTeamMemberKey(w.ownerName));

                  const rounding = Number(w.roundingAmount) || 0;
                  const totalTf = Number(w.totalTransferred) || Number(w.amount) + rounding;
                  const isSelected = selectedIds.has(w.id);

                  return (
                    <tr
                      key={w.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'dark:bg-accent/10 bg-accent/5'
                          : 'dark:hover:bg-white/[0.02] hover:bg-gray-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectOne(w.id, e)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3.5 text-sm dark:text-gray-300 text-gray-700 whitespace-nowrap">
                        {formatDate(w.date)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isExternalOwner ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            <span>📦</span>
                            <span>{w.ownerName ? `Penitip Luar: ${w.ownerName}` : w.recipientName}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/20">
                            <span>👤</span>
                            <span>{w.recipientName}</span>
                            <span className="text-[10px] px-1 rounded bg-purple-500/20 text-purple-200 font-normal">Tim Internal</span>
                          </div>
                        )}
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
                            type="button"
                            onClick={() => handleOpenEdit(w)}
                            className="p-1.5 rounded-lg dark:text-gray-400 text-gray-500 hover:text-blue-400 dark:hover:bg-blue-500/10"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            type="button"
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

      {/* ==================================================== */}
      {/* MODAL RINCIAN SALDO PENITIP EKSTERNAL (NON-TIM ONLY) */}
      {/* ==================================================== */}
      <Modal
        isOpen={isOwnerDetailOpen}
        onClose={() => setIsOwnerDetailOpen(false)}
        title="Rincian Saldo Pemilik Barang (Penitip Eksternal)"
        size="xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200 text-xs dark:text-blue-300 text-blue-800 flex items-start gap-2">
            <span className="text-base leading-none">ℹ️</span>
            <p>
              Daftar ini khusus merinci <strong>penitip barang eksternal (luar)</strong>. Hak keuntungan barang milik anggota tim (<strong>Akbar, Nesa, Andin, Ritza</strong>) otomatis langsung digabung ke kartu individual mereka masing-masing di halaman utama.
            </p>
          </div>

          {/* Mini Summary Cards inside Modal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-semibold">Total Penitip Luar</p>
              <p className="text-base font-bold dark:text-white text-gray-900">{externalOwnerBalances.length} Orang/Toko</p>
            </div>
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-semibold">Total Hak (70%)</p>
              <p className="text-base font-bold text-accent">
                {formatCurrency(externalTotalEarned)}
              </p>
            </div>
            <div className="p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200">
              <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase font-semibold">Sudah Dicairkan</p>
              <p className="text-base font-bold text-purple">
                {formatCurrency(externalOwnerBalances.reduce((sum, o) => sum + o.withdrawn, 0))}
              </p>
            </div>
            <div className="p-3 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200">
              <p className="text-[10px] text-emerald-500 uppercase font-semibold">Sisa Saldo Tersedia</p>
              <p className="text-base font-extrabold text-emerald-400">
                {formatCurrency(externalOwnerBalances.reduce((sum, o) => sum + o.remaining, 0))}
              </p>
            </div>
          </div>

          {/* Search & Tabs Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama penitip eksternal..."
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs
                  dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
                  dark:border-white/10 border-gray-300 border
                  focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'has_balance', label: 'Ada Saldo' },
                { id: 'zero_balance', label: 'Saldo Rp 0' },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setOwnerTabFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                    ownerTabFilter === tab.id
                      ? 'bg-accent text-dark-800 font-bold'
                      : 'dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 hover:bg-accent/15'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Daftar Pemilik Eksternal */}
          <div className="max-h-80 overflow-y-auto rounded-xl border dark:border-white/5 border-gray-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 dark:bg-surface-300 bg-gray-100 border-b dark:border-white/5 border-gray-200 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold dark:text-gray-400 text-gray-600">No</th>
                  <th className="px-3 py-2.5 text-left font-semibold dark:text-gray-400 text-gray-600">Nama Penitip</th>
                  <th className="px-3 py-2.5 text-center font-semibold dark:text-gray-400 text-gray-600">Barang Terjual</th>
                  <th className="px-3 py-2.5 text-right font-semibold dark:text-gray-400 text-gray-600">Total Hak (70%)</th>
                  <th className="px-3 py-2.5 text-right font-semibold dark:text-gray-400 text-gray-600">Sudah Ditarik</th>
                  <th className="px-3 py-2.5 text-right font-semibold dark:text-gray-400 text-gray-600">Sisa Saldo</th>
                  <th className="px-3 py-2.5 text-center font-semibold dark:text-gray-400 text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                {filteredExternalOwnerList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      Tidak ditemukan data penitip eksternal yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredExternalOwnerList.map((owner, idx) => {
                    const hasBalance = owner.remaining > 0;
                    return (
                      <tr key={owner.name} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 dark:text-gray-500 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                              {owner.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold dark:text-white text-gray-900">{owner.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center dark:text-gray-300 text-gray-700 whitespace-nowrap">
                          {owner.totalItems} pcs
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold dark:text-gray-200 text-gray-800 whitespace-nowrap">
                          {formatCurrency(owner.earned)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-purple whitespace-nowrap">
                          {formatCurrency(owner.withdrawn)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold whitespace-nowrap">
                          <span className={hasBalance ? 'text-emerald-400' : 'text-gray-400'}>
                            {formatCurrency(owner.remaining)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOwnerDetailOpen(false);
                              handleOpenAddExternalOwner(owner.name);
                            }}
                            disabled={!hasBalance}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 ${
                              hasBalance
                                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                                : 'bg-gray-500/10 text-gray-500 cursor-not-allowed opacity-50'
                            }`}
                            title={hasBalance ? `Tarik saldo milik ${owner.name}` : 'Saldo sudah habis'}
                          >
                            <span>💸</span>
                            <span>Tarik</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t dark:border-white/5 border-gray-200">
            <Button variant="secondary" size="sm" onClick={exportExternalOwnerBalancesToExcel}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3" />
              </svg>
              Export Saldo Penitip (.xlsx)
            </Button>
            <Button variant="ghost" type="button" onClick={() => setIsOwnerDetailOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================== */}
      {/* MODAL FORM CATAT / EDIT PENARIKAN SALDO   */}
      {/* ========================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Penarikan Saldo' : 'Catat Penarikan Saldo'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle Kategori: Tim Internal vs Pemilik Barang Eksternal */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider dark:text-gray-400 text-gray-500">
              Kategori Penerima
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl dark:bg-surface-300 bg-gray-100">
              <button
                type="button"
                onClick={() => handleCategoryChange('team')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  formData.category === 'team'
                    ? 'bg-purple text-white shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 hover:dark:text-white'
                }`}
              >
                <span>👥</span>
                <span>Bagi Hasil Tim Internal</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('external_owner')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  formData.category === 'external_owner'
                    ? 'bg-emerald-500 text-dark-800 shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 hover:dark:text-white'
                }`}
              >
                <span>📦</span>
                <span>Penitip Eksternal (Luar)</span>
              </button>
            </div>
          </div>

          {/* Pilihan Penerima Spesifik */}
          {formData.category === 'team' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Pihak Tim Penerima"
                value={formData.recipientKey}
                onChange={(e) => handleTeamRecipientChange(e.target.value)}
              >
                {recipientOptions
                  .filter((r) => r.key !== 'pemilikBarang')
                  .map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.icon} {r.label} ({r.percentage}%)
                    </option>
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider dark:text-gray-400 text-gray-500">
                  Nama Penitip Eksternal
                </label>
                <select
                  value={formData.ownerName || ''}
                  onChange={(e) => handleSpecificExternalOwnerChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm dark:bg-surface-300 bg-white 
                    dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                    focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                >
                  {externalOwnerBalances.map((o) => (
                    <option key={o.name} value={o.name}>
                      👤 {o.name} (Sisa: {formatCurrency(o.remaining)})
                    </option>
                  ))}
                  <option value="ALL">📦 Semua Penitip Luar (Global)</option>
                </select>
              </div>

              <Input
                label="Tanggal Penarikan"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          )}

          {/* Info Breakdown Saldo untuk Penerima Terpilih */}
          <div className="p-3.5 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold dark:text-white text-gray-900">
                Sisa Saldo {currentRecipientDetails.label}:
              </span>
              <span className="font-extrabold text-sm text-emerald-400">
                {formatCurrency(currentRecipientRemaining)}
              </span>
            </div>

            {formData.category === 'team' && currentRecipientDetails.personalGoods > 0 ? (
              <div className="pt-1.5 border-t dark:border-emerald-500/20 border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px] dark:text-gray-300 text-gray-700">
                <div>
                  <span className="text-gray-400">Komisi Tim (5%): </span>
                  <span className="font-semibold">{formatCurrency(currentRecipientDetails.commission)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Barang Pribadi (70%): </span>
                  <span className="font-semibold text-accent">{formatCurrency(currentRecipientDetails.personalGoods)}</span>
                </div>
              </div>
            ) : null}
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
            placeholder="contoh: Transfer via BCA 12345678 a.n Penerima"
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

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        canDelete={isAdmin || isSuperAdmin}
        onBulkDelete={() => setIsBulkDeleteOpen(true)}
        deleteLabel="Hapus Penarikan Terpilih"
      />

      {/* Modal Konfirmasi Hapus Massal Penarikan */}
      <Modal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        title={`Hapus ${selectedIds.size} Riwayat Penarikan?`}
        size="md"
      >
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-red-400">Peringatan Aksi Hapus Massal</p>
              <p>
                Menghapus data riwayat penarikan akan <strong>secara otomatis mengembalikan dan menambah saldo akun/penitip terkait</strong> sesuai nominal yang sebelumnya ditarik.
              </p>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl dark:bg-white/5 bg-gray-100 text-xs">
            {withdrawals
              .filter((w) => selectedIds.has(w.id))
              .map((w) => (
                <div key={w.id} className="flex items-center justify-between py-1 border-b dark:border-white/5 border-gray-200 last:border-0">
                  <span className="dark:text-white text-gray-900 font-bold">{w.recipientName || w.ownerName}</span>
                  <span className="text-purple-400 font-bold">{formatCurrency(w.amount)}</span>
                  <span className="text-gray-400">{formatDate(w.date)}</span>
                </div>
              ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-white/5 border-gray-200">
            <Button
              variant="ghost"
              onClick={() => setIsBulkDeleteOpen(false)}
              disabled={bulkActionLoading}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkDeleteConfirm}
              loading={bulkActionLoading}
            >
              Ya, Hapus {selectedIds.size} Penarikan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
