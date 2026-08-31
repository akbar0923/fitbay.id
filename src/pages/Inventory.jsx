import { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useOwners } from '../context/OwnerContext';
import { useSales } from '../context/SalesContext';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { CATEGORIES } from '../constants/profitSharingConfig';
import InventoryFormModal from '../components/inventory/InventoryFormModal';
import InventoryDetailModal from '../components/inventory/InventoryDetailModal';
import DeleteInventoryModal from '../components/inventory/DeleteInventoryModal';
import SalesFormModal from '../components/sales/SalesFormModal';
import BulkActionBar from '../components/common/BulkActionBar';
import { restoreItemToUnsold } from '../firebase/inventoryService';
import toast from 'react-hot-toast';

export default function Inventory() {
  const { items, loading, stats, addItem, updateItem, deleteItem, markAsSold } = useInventory();
  const { owners } = useOwners();
  const { addTransaction } = useSales();
  const { isAdmin, isSuperAdmin } = useAuth();

  // Selection States
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterOwner, setFilterOwner] = useState('ALL');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Quick Sell Modal State
  const [isQuickSellOpen, setIsQuickSellOpen] = useState(false);
  const [quickSellData, setQuickSellData] = useState(null);

  // Filter Logic
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.kodeBarang?.toLowerCase().includes(q) ||
          item.namaBarang?.toLowerCase().includes(q) ||
          item.catatan?.toLowerCase().includes(q) ||
          item.pemilikBarang?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'ALL') {
      result = result.filter((item) => item.status === filterStatus);
    }

    if (filterCategory !== 'ALL') {
      result = result.filter((item) => item.kategori === filterCategory);
    }

    if (filterOwner !== 'ALL') {
      result = result.filter(
        (item) => item.pemilikBarang?.toLowerCase() === filterOwner.toLowerCase()
      );
    }

    return result;
  }, [items, search, filterStatus, filterCategory, filterOwner]);

  // Ringkasan khusus saat memfilter pemilik tertentu
  const filteredOwnerStats = useMemo(() => {
    if (filterOwner === 'ALL') return null;
    const ownerItems = items.filter(
      (item) => item.pemilikBarang?.toLowerCase() === filterOwner.toLowerCase()
    );
    const total = ownerItems.length;
    const readyCount = ownerItems.filter((i) => i.status === 'Belum Terjual').length;
    const soldCount = ownerItems.filter((i) => i.status === 'Terjual').length;
    const totalCapital = ownerItems.reduce((sum, i) => sum + (Number(i.hargaModal) || 0), 0);

    return {
      name: filterOwner,
      total,
      readyCount,
      soldCount,
      totalCapital,
    };
  }, [items, filterOwner]);

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
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

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        if (newStatus === 'Belum Terjual') {
          return restoreItemToUnsold(id);
        } else {
          return updateItem(id, {
            status: 'Terjual',
            tanggalTerjual: new Date().toISOString().split('T')[0],
          });
        }
      });
      await Promise.all(promises);
      toast.success(`Berhasil mengubah status ${selectedIds.size} barang menjadi ${newStatus}!`);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah status massal.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const count = selectedIds.size;
      const promises = Array.from(selectedIds).map((id) => deleteItem(id));
      await Promise.all(promises);
      toast.success(`Berhasil menghapus ${count} barang secara massal!`);
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus beberapa data barang.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (item) => {
    setSelectedDetailItem(item);
    setIsDetailOpen(true);
  };

  const handleOpenDelete = (item) => {
    setDeletingItem(item);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async (id) => {
    setDeleteLoading(true);
    try {
      await deleteItem(id);
      setIsDeleteOpen(false);
      setDeletingItem(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    if (editingItem) {
      await updateItem(editingItem.id, formData);
    } else {
      await addItem(formData);
    }
  };

  // Tandai Terjual (Quick Sell flow)
  const handleMarkSold = (item) => {
    setQuickSellData({
      date: new Date().toISOString().split('T')[0],
      itemName: item.namaBarang,
      category: item.kategori,
      ownerName: item.pemilikBarang,
      costPrice: item.hargaModal,
      sellingPrice: item.sellingPrice || '',
      paymentMethod: item.paymentMethod || 'Transfer Bank',
      sumberPesanan: item.sumberPesanan || 'WhatsApp',
      status: 'Terjual',
      kodeBarang: item.kodeBarang,
      inventoryItemId: item.id,
      namaPenerima: item.namaPenerima || '',
      noHpPenerima: item.noHpPenerima || '',
      alamatPenerima: item.alamatPenerima || '',
      ekspedisi: item.ekspedisi || 'J&T Express',
      resi: item.resi || '',
      catatanPengiriman: item.catatanPengiriman || '',
    });
    setIsQuickSellOpen(true);
  };

  // Submit Transaksi Penjualan dari Quick Sell
  const handleQuickSellSubmit = async (salesPayload) => {
    try {
      const newTx = await addTransaction({
        ...salesPayload,
        kodeBarang: quickSellData?.kodeBarang,
        inventoryItemId: quickSellData?.inventoryItemId,
      });

      if (quickSellData?.inventoryItemId) {
        await markAsSold(quickSellData.inventoryItemId, newTx?.id || `tx_${Date.now()}`, {
          namaPenerima: salesPayload.namaPenerima || '',
          noHpPenerima: salesPayload.noHpPenerima || '',
          alamatPenerima: salesPayload.alamatPenerima || '',
          sumberPesanan: salesPayload.sumberPesanan || 'WhatsApp',
          ekspedisi: salesPayload.ekspedisi || 'J&T Express',
          resi: salesPayload.resi || '',
          catatanPengiriman: salesPayload.catatanPengiriman || '',
          sellingPrice: salesPayload.sellingPrice || 0,
        });
      }

      toast.success(`Barang ${quickSellData?.kodeBarang} berhasil terjual dan tersinkronisasi!`);
      setIsQuickSellOpen(false);
      setQuickSellData(null);
    } catch (err) {
      toast.error('Gagal memproses transaksi penjualan');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-accent/20 text-accent flex items-center justify-center text-lg">
              📦
            </span>
            Data Barang & Inventaris
          </h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-1">
            Pencatatan stok barang titipan masuk, penomoran kode unik (FB-XXXX), dan status kesiapan live
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="shrink-0 shadow-lg shadow-accent/25">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Barang Baru
        </Button>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Barang */}
        <Card className="p-4 relative overflow-hidden group hover:border-accent/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Total Barang</p>
              <h3 className="text-2xl font-bold dark:text-white text-gray-900 mt-1">{stats.total}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple/10 text-purple flex items-center justify-center text-xl">
              📦
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs dark:text-gray-400 text-gray-500">
            <span>Semua barang tercatat</span>
          </div>
        </Card>

        {/* Belum Terjual / Siap Live */}
        <Card className="p-4 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Belum Terjual (Siap Live)</p>
              <h3 className="text-2xl font-bold text-amber-500 dark:text-amber-400 mt-1">{stats.availableCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl">
              ⏳
            </div>
          </div>
          <div className="mt-3 text-xs text-amber-500/90 dark:text-amber-400/90 font-medium">
            Nilai Modal: {formatCurrency(stats.totalCapitalValue)}
          </div>
        </Card>

        {/* Terjual */}
        <Card className="p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Sudah Terjual</p>
              <h3 className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 mt-1">{stats.soldCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl">
              ✅
            </div>
          </div>
          <div className="mt-3 text-xs text-emerald-500/90 dark:text-emerald-400/90 font-medium">
            Modal Terjual: {formatCurrency(stats.soldCapitalValue)}
          </div>
        </Card>

        {/* Total Nilai Modal Keseluruhan */}
        <Card className="p-4 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Total Nilai Modal</p>
              <h3 className="text-xl font-bold text-blue-500 dark:text-blue-400 mt-1">
                {formatCurrency(stats.totalCapitalValue + stats.soldCapitalValue)}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl">
              💰
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-500/90 dark:text-blue-400/90 font-medium">
            Akumulasi modal barang masuk
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 dark:text-gray-400 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Cari kode (FB-XXXX), nama barang, catatan, atau pemilik..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm
                dark:bg-white/5 bg-gray-100 dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                dark:placeholder-gray-500 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                transition-all duration-200"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="Belum Terjual">⏳ Belum Terjual (Siap Live)</option>
              <option value="Terjual">✅ Terjual</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-36">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
            >
              <option value="ALL">Semua Kategori</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Owner Filter */}
          <div className="w-full md:w-40">
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
            >
              <option value="ALL">Semua Pemilik</option>
              {owners.map((owner) => (
                <option key={owner.id || owner.name} value={owner.name}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Banner Ringkasan Khusus Pemilik yang Sedang Difilter */}
        {filteredOwnerStats && (
          <div className="mt-4 pt-3.5 border-t dark:border-white/5 border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-accent/5 p-3 rounded-xl border border-accent/15 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/20 text-accent font-bold flex items-center justify-center text-xs">
                {filteredOwnerStats.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold dark:text-white text-gray-900">
                Ringkasan Barang Penitip: {filteredOwnerStats.name}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="dark:text-gray-300 text-gray-700">
                Total: <strong className="dark:text-white text-gray-900 font-bold">{filteredOwnerStats.total} item</strong>
              </span>
              <span className="text-amber-400">
                Ready: <strong>{filteredOwnerStats.readyCount} item</strong>
              </span>
              <span className="text-emerald-400">
                Terjual: <strong>{filteredOwnerStats.soldCount} item</strong>
              </span>
              <span className="text-purple-400">
                Total Modal: <strong>{formatCurrency(filteredOwnerStats.totalCapital)}</strong>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Table Data Barang */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="dark:bg-white/[0.02] bg-gray-50/80 border-b dark:border-white/5 border-gray-200 text-xs dark:text-gray-400 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                    title="Pilih Semua / Batal Pilih Semua"
                  />
                </th>
                <th className="px-4 py-4 font-semibold">Kode Barang</th>
                <th className="px-4 py-4 font-semibold">Nama Barang & Catatan</th>
                <th className="px-4 py-4 font-semibold">Kategori</th>
                <th className="px-4 py-4 font-semibold">Pemilik Barang</th>
                <th className="px-4 py-4 font-semibold">Harga Modal</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5 divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12">
                    <EmptyState
                      icon="📦"
                      title="Belum Ada Data Barang"
                      description={
                        search || filterStatus !== 'ALL' || filterCategory !== 'ALL' || filterOwner !== 'ALL'
                          ? 'Tidak ada barang yang sesuai dengan filter pencarian.'
                          : 'Belum ada barang di inventaris. Silakan tambahkan barang titipan pertama Anda.'
                      }
                      action={
                        <Button size="sm" onClick={handleOpenAdd}>
                          + Tambah Barang Baru
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSold = item.status === 'Terjual';
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'dark:bg-accent/10 bg-accent/5'
                          : 'dark:hover:bg-white/[0.02] hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectOne(item.id, e)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                      </td>

                      {/* Kode Barang */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent border border-accent/30 tracking-wider">
                          <span>🏷️</span>
                          <span>{item.kodeBarang}</span>
                        </span>
                      </td>

                      {/* Nama Barang & Catatan */}
                      <td className="px-4 py-4 max-w-xs">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="font-semibold dark:text-white text-gray-900 hover:text-accent dark:hover:text-accent transition-colors text-left line-clamp-1"
                          >
                            {item.namaBarang}
                          </button>
                          {item.catatan && (
                            <p className="text-xs dark:text-gray-400 text-gray-500 line-clamp-1">
                              {item.catatan}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-700">
                          {item.kategori || 'Baju'}
                        </span>
                      </td>

                      {/* Pemilik Barang */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold dark:text-gray-200 text-gray-800">
                          <span className="w-5 h-5 rounded-full bg-purple/15 text-purple text-[10px] font-bold flex items-center justify-center">
                            {item.pemilikBarang?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                          {item.pemilikBarang || '-'}
                        </span>
                      </td>

                      {/* Harga Modal */}
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-xs dark:text-gray-300 text-gray-700">
                        {formatCurrency(item.hargaModal)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isSold
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          <span>{isSold ? '✅' : '⏳'}</span>
                          <span>{item.status}</span>
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Tandai Terjual (untuk barang belum terjual) */}
                          {!isSold ? (
                            <Button
                              size="sm"
                              onClick={() => handleMarkSold(item)}
                              className="text-xs py-1 px-2.5 shadow-md shadow-accent/20 flex items-center gap-1"
                              title="Tandai Terjual & Input ke Penjualan"
                            >
                              <span>🏷️</span>
                              <span>Tandai Terjual</span>
                            </Button>
                          ) : (
                            <button
                              onClick={() => handleOpenDetail(item)}
                              title="Lihat Detail Transaksi Penjualan"
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1"
                            >
                              <span>👁️</span>
                              <span>Lihat Transaksi</span>
                            </button>
                          )}

                          {/* Tombol Detail */}
                          <button
                            onClick={() => handleOpenDetail(item)}
                            title="Detail Barang"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          </button>

                          {/* Tombol Edit */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Barang"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>

                          {/* Tombol Hapus */}
                          <button
                            onClick={() => handleOpenDelete(item)}
                            title="Hapus Barang"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Tambah & Edit Barang */}
      <InventoryFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        editData={editingItem}
      />

      {/* Modal: Detail Barang */}
      <InventoryDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        item={selectedDetailItem}
        onMarkSold={handleMarkSold}
        onEdit={handleOpenEdit}
      />

      {/* Modal: Hapus Barang */}
      <DeleteInventoryModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        item={deletingItem}
        loading={deleteLoading}
      />

      {/* Modal: Quick Sell to Penjualan */}
      <SalesFormModal
        isOpen={isQuickSellOpen}
        onClose={() => setIsQuickSellOpen(false)}
        onSubmit={handleQuickSellSubmit}
        editData={quickSellData}
      />

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        canDelete={isAdmin || isSuperAdmin}
        onBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        deleteLabel="Hapus Barang Terpilih"
        actions={[
          {
            label: 'Ubah ke Terjual',
            icon: '✅',
            variant: 'success',
            hidden: !(isAdmin || isSuperAdmin),
            disabled: bulkActionLoading,
            onClick: () => handleBulkStatusChange('Terjual'),
          },
          {
            label: 'Ubah ke Belum Terjual',
            icon: '⏳',
            variant: 'secondary',
            hidden: !(isAdmin || isSuperAdmin),
            disabled: bulkActionLoading,
            onClick: () => handleBulkStatusChange('Belum Terjual'),
          },
        ]}
      />

      {/* Modal Konfirmasi Hapus Massal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title={`Hapus ${selectedIds.size} Barang Sekaligus?`}
        size="md"
      >
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-red-400">Peringatan Aksi Hapus Massal</p>
              <p>
                Anda akan menghapus <strong>{selectedIds.size} barang</strong> dari inventaris database. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl dark:bg-white/5 bg-gray-100 text-xs">
            {items
              .filter((i) => selectedIds.has(i.id))
              .map((i) => (
                <div key={i.id} className="flex items-center justify-between py-1 border-b dark:border-white/5 border-gray-200 last:border-0">
                  <span className="font-mono text-accent font-semibold">{i.kodeBarang}</span>
                  <span className="dark:text-white text-gray-900 font-medium truncate max-w-[180px]">{i.namaBarang}</span>
                  <span className="text-gray-400">({i.pemilikBarang || '-'})</span>
                </div>
              ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-white/5 border-gray-200">
            <Button
              variant="ghost"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={bulkActionLoading}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkDeleteConfirm}
              loading={bulkActionLoading}
            >
              Ya, Hapus {selectedIds.size} Barang
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
