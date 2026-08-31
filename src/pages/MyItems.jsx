import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useWithdrawals } from '../context/WithdrawalContext';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import InventoryDetailModal from '../components/inventory/InventoryDetailModal';
import InventoryFormModal from '../components/inventory/InventoryFormModal';
import SalesFormModal from '../components/sales/SalesFormModal';
import toast from 'react-hot-toast';

export default function MyItems() {
  const { user } = useAuth();
  const { items, loading: inventoryLoading, updateItem } = useInventory();
  const { transactions, loading: salesLoading, profitSharingConfig, updateTransaction, addTransaction } = useSales();
  const { getTotalWithdrawnByOwner, getTotalWithdrawn } = useWithdrawals();

  const loading = inventoryLoading || salesLoading;

  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Belum Terjual' | 'Terjual'
  const [search, setSearch] = useState('');

  // Modals state
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit Inventory state
  const [isEditInventoryOpen, setIsEditInventoryOpen] = useState(false);
  const [editingInventoryData, setEditingInventoryData] = useState(null);

  // Edit Sales state
  const [isEditSalesOpen, setIsEditSalesOpen] = useState(false);
  const [editingSalesData, setEditingSalesData] = useState(null);

  // Quick Sell state
  const [isQuickSellOpen, setIsQuickSellOpen] = useState(false);
  const [quickSellData, setQuickSellData] = useState(null);

  // Normalisasi identitas pengguna yang sedang login untuk pencocokan nama pemilik barang
  const userIdentifiers = useMemo(() => {
    if (!user) return [];
    const ids = new Set();

    const rawName = (user.name || '').trim().toLowerCase();
    const rawUsername = (user.username || '').trim().toLowerCase();

    // 1. Identifikasi spesifik akun tim Fitbay.id
    const isAkbar = rawUsername === 'akbar' || rawUsername === 'muhbar' || rawName === 'akbar';
    const isNesa = rawUsername === 'nesa' || rawUsername === 'nessa' || rawName === 'nesa' || rawName === 'nessa';
    const isAndin = rawUsername === 'andin' || rawName === 'andin';
    const isRitza = rawUsername === 'ritza' || rawName === 'ritza';

    if (isAkbar) {
      ids.add('akbar');
      ids.add('muhbar');
    } else if (isNesa) {
      ids.add('nesa');
      ids.add('nessa');
    } else if (isAndin) {
      ids.add('andin');
    } else if (isRitza) {
      ids.add('ritza');
    } else {
      // User non-tim: masukkan nama dan username asli (abaikan nama generik seperti admin)
      if (rawName && rawName !== 'admin' && rawName !== 'administrator') {
        ids.add(rawName);
      }
      if (rawUsername && rawUsername !== 'admin' && rawUsername !== 'administrator') {
        ids.add(rawUsername);
      }
    }

    return Array.from(ids);
  }, [user]);

  // Gabungkan seluruh data barang dari 2 sumber: Koleksi Inventory + Transaksi Penjualan Langsung
  const combinedMyItems = useMemo(() => {
    if (userIdentifiers.length === 0) return [];

    const result = [];
    const processedTxIds = new Set();
    const processedCodes = new Set();

    // 1. Ambil dari koleksi inventory milik user ini (Pencocokan Persis / Exact Match)
    items.forEach((item) => {
      const owner = (item.pemilikBarang || '').trim().toLowerCase();
      const isMyItem = userIdentifiers.includes(owner);
      if (!isMyItem) return;

      const isSold = item.status === 'Terjual';
      let linkedTx = null;
      if (isSold) {
        if (item.referensiTransaksiId) {
          linkedTx = transactions.find((t) => t.id === item.referensiTransaksiId);
        }
        if (!linkedTx && item.kodeBarang) {
          linkedTx = transactions.find((t) => t.kodeBarang === item.kodeBarang);
        }
      }

      if (linkedTx) {
        processedTxIds.add(linkedTx.id);
      }
      if (item.kodeBarang) {
        processedCodes.add(item.kodeBarang.toLowerCase());
      }

      const hakPemilik = linkedTx?.profitSharing?.pemilikBarang !== undefined
        ? Number(linkedTx.profitSharing.pemilikBarang) || 0
        : Number(item.hargaModal) || 0;

      result.push({
        id: item.id,
        kodeBarang: item.kodeBarang || 'FB-ITEM',
        namaBarang: item.namaBarang || 'Barang Tanpa Nama',
        kategori: item.kategori || 'Baju',
        catatan: item.catatan || '',
        status: item.status || 'Belum Terjual',
        tanggalMasuk: item.tanggalMasuk || item.createdAt || '-',
        tanggalTerjual: item.tanggalTerjual || linkedTx?.date || null,
        hargaModal: Number(item.hargaModal) || 0,
        sellingPrice: linkedTx?.sellingPrice || item.hargaJual || 0,
        hakPemilik: hakPemilik,
        source: 'inventory',
        rawItem: item,
        linkedTx,
      });
    });

    // 2. Ambil dari koleksi transactions langsung (yang belum terhubung ke inventory)
    transactions.forEach((tx) => {
      if (processedTxIds.has(tx.id)) return;
      if (tx.inventoryItemId && items.some((i) => i.id === tx.inventoryItemId)) return;
      if (tx.kodeBarang && processedCodes.has(tx.kodeBarang.toLowerCase())) return;

      const txOwner = (tx.ownerName || '').trim().toLowerCase();
      const isMyTx = userIdentifiers.includes(txOwner);
      if (!isMyTx) return;

      const defaultOwnerPct = profitSharingConfig?.pemilikBarang?.percentage || 70;
      const hakPemilik = tx.profitSharing?.pemilikBarang !== undefined
        ? Number(tx.profitSharing.pemilikBarang) || 0
        : Math.round(((Number(tx.profit) || 0) * defaultOwnerPct) / 100);

      result.push({
        id: `tx_${tx.id}`,
        kodeBarang: tx.kodeBarang || 'TX-LANGSUNG',
        namaBarang: tx.itemName || 'Barang Terjual',
        kategori: tx.category || 'Baju',
        catatan: tx.notes || 'Penjualan Langsung',
        status: 'Terjual',
        tanggalMasuk: tx.date || '-',
        tanggalTerjual: tx.date || '-',
        hargaModal: 0,
        sellingPrice: Number(tx.sellingPrice) || 0,
        hakPemilik: hakPemilik,
        source: 'transaction',
        rawItem: {
          id: `tx_${tx.id}`,
          kodeBarang: tx.kodeBarang || 'TX-LANGSUNG',
          namaBarang: tx.itemName,
          kategori: tx.category,
          pemilikBarang: tx.ownerName,
          status: 'Terjual',
          hargaModal: Number(tx.costPrice) || 0,
          hargaJual: Number(tx.sellingPrice) || 0,
          sellingPrice: Number(tx.sellingPrice) || 0,
          profit: Number(tx.profit) || 0,
          namaPenerima: tx.namaPenerima,
          noHpPenerima: tx.noHpPenerima,
          alamatPenerima: tx.alamatPenerima,
          sumberPesanan: tx.sumberPesanan,
          ekspedisi: tx.ekspedisi,
          resi: tx.resi,
          tanggalMasuk: tx.date,
          tanggalTerjual: tx.date,
          referensiTransaksiId: tx.id,
          catatan: tx.notes,
        },
        linkedTx: tx,
      });
    });

    return result;
  }, [items, transactions, userIdentifiers, profitSharingConfig]);

  // Statistik Ringkasan Barang Saya
  const stats = useMemo(() => {
    const total = combinedMyItems.length;
    const readyItems = combinedMyItems.filter((i) => i.status === 'Belum Terjual');
    const soldItems = combinedMyItems.filter((i) => i.status === 'Terjual');

    const totalEarned = soldItems.reduce((sum, item) => sum + (Number(item.hakPemilik) || 0), 0);
    const readyCapital = readyItems.reduce((sum, i) => sum + (Number(i.hargaModal) || 0), 0);

    return {
      total,
      readyCount: readyItems.length,
      soldCount: soldItems.length,
      totalEarned,
      readyCapital,
    };
  }, [combinedMyItems]);

  // Total penarikan saldo yang sudah pernah dicairkan atas nama akun ini
  const totalWithdrawn = useMemo(() => {
    let sum = 0;
    userIdentifiers.forEach((id) => {
      sum += getTotalWithdrawn(id);
      sum += getTotalWithdrawnByOwner(id);
    });
    return sum;
  }, [userIdentifiers, getTotalWithdrawn, getTotalWithdrawnByOwner]);

  // Sisa saldo bersih yang siap ditarik (setelah dikurangi penarikan)
  const remainingBalance = Math.max(0, stats.totalEarned - totalWithdrawn);

  // Filter dan Pencarian
  const filteredItems = useMemo(() => {
    return combinedMyItems.filter((item) => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.namaBarang && item.namaBarang.toLowerCase().includes(q)) ||
        (item.kodeBarang && item.kodeBarang.toLowerCase().includes(q)) ||
        (item.kategori && item.kategori.toLowerCase().includes(q));

      return matchStatus && matchSearch;
    });
  }, [combinedMyItems, statusFilter, search]);

  const handleOpenDetail = (item) => {
    setSelectedDetailItem({
      ...(item.rawItem || {}),
      ...item,
    });
    setIsDetailOpen(true);
  };

  const handleEditItem = (item) => {
    if (!item) return;

    // 1. Cek apakah ini transaksi penjualan langsung (TX-LANGSUNG, dimulai dengan tx_, atau memiliki referensiTransaksiId)
    const isTxItem =
      item.source === 'transaction' ||
      String(item.id || '').startsWith('tx_') ||
      item.rawItem?.referensiTransaksiId ||
      item.referensiTransaksiId ||
      item.kodeBarang === 'TX-LANGSUNG';

    if (isTxItem) {
      const realTxId =
        item.rawItem?.referensiTransaksiId ||
        item.referensiTransaksiId ||
        (String(item.id || '').startsWith('tx_') ? String(item.id).replace('tx_', '') : item.id);

      const targetTx =
        item.linkedTx ||
        transactions.find((t) => t.id === realTxId) ||
        (item.kodeBarang && item.kodeBarang !== 'TX-LANGSUNG'
          ? transactions.find((t) => t.kodeBarang === item.kodeBarang)
          : null) ||
        transactions.find((t) => (t.itemName === item.namaBarang || t.itemName === item.itemName) && (t.ownerName === item.pemilikBarang || t.ownerName === item.ownerName)) ||
        item.rawItem;

      if (targetTx) {
        setEditingSalesData({
          ...targetTx,
          id: targetTx.id || realTxId,
        });
        setIsEditSalesOpen(true);
        return;
      }
    }

    // 2. Jika bukan transaksi langsung, cari di koleksi inventaris
    const targetInv =
      items.find((i) => i.id === item.id) ||
      (item.kodeBarang ? items.find((i) => i.kodeBarang === item.kodeBarang) : null) ||
      item.rawItem ||
      item;

    if (targetInv) {
      setEditingInventoryData(targetInv);
      setIsEditInventoryOpen(true);
    } else {
      toast.error('Data barang tidak ditemukan.');
    }
  };

  const handleMarkSold = (item) => {
    const raw = item.rawItem || item;
    setQuickSellData({
      itemName: raw.namaBarang,
      ownerName: raw.pemilikBarang || user?.name || 'Akbar',
      category: raw.kategori || 'Baju',
      costPrice: String(raw.hargaModal || 0),
      kodeBarang: raw.kodeBarang || '',
      inventoryItemId: raw.id,
      sellingPrice: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Transfer Bank',
      sumberPesanan: 'WhatsApp',
      status: 'Terjual',
    });
    setIsQuickSellOpen(true);
  };

  // Submit Handler: Edit Data Inventaris
  const handleInventoryEditSubmit = async (formData) => {
    try {
      if (editingInventoryData?.id) {
        await updateItem(editingInventoryData.id, formData);
        toast.success(`Barang [${formData.kodeBarang}] berhasil diperbarui!`);
      }
      setIsEditInventoryOpen(false);
      setEditingInventoryData(null);
    } catch (err) {
      console.error('Error updating inventory in MyItems:', err);
      toast.error('Gagal memperbarui data barang.');
    }
  };

  // Submit Handler: Edit Data Transaksi Penjualan
  const handleSalesEditSubmit = async (formData) => {
    try {
      if (editingSalesData?.id) {
        await updateTransaction(editingSalesData.id, formData);
      }
      setIsEditSalesOpen(false);
      setEditingSalesData(null);
    } catch (err) {
      console.error('Error updating transaction in MyItems:', err);
    }
  };

  // Submit Handler: Tandai Terjual (Quick Sell)
  const handleQuickSellSubmit = async (formData) => {
    try {
      await addTransaction(formData);
      setIsQuickSellOpen(false);
      setQuickSellData(null);
    } catch (err) {
      console.error('Error quick sell in MyItems:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">Barang Saya</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-accent/15 text-accent border border-accent/20">
              @{user?.username || 'user'}
            </span>
          </div>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-1">
            Daftar seluruh barang titipan & transaksi atas nama akun Anda (sinkron otomatis real-time)
          </p>
        </div>
      </div>

      {/* Ringkasan Metrik Barang Saya */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Barang */}
          <div className="dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold dark:text-gray-400 text-gray-500 uppercase tracking-wider block mb-2">
                Total Barang Dititipkan
              </span>
              <p className="text-3xl font-extrabold dark:text-white text-gray-900 tracking-tight">
                {stats.total} <span className="text-sm font-normal dark:text-gray-500 text-gray-400">item</span>
              </p>
            </div>
            <p className="text-xs dark:text-gray-500 text-gray-400 mt-3 flex items-center gap-1">
              <span>🏷️</span>
              <span>Terdaftar atas nama {user?.name || user?.username}</span>
            </p>
          </div>

          {/* Belum Terjual (Ready) */}
          <div className="dark:bg-surface-200 bg-white border border-amber-500/20 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2">
                Stok Ready (Belum Terjual)
              </span>
              <p className="text-3xl font-extrabold text-amber-400 tracking-tight">
                {stats.readyCount} <span className="text-sm font-normal text-amber-400/70">item</span>
              </p>
            </div>
            <p className="text-xs text-amber-400/80 mt-3">
              Estimasi Modal: {formatCurrency(stats.readyCapital)}
            </p>
          </div>

          {/* Terjual & Total Penghasilan */}
          <div className="dark:bg-surface-200 bg-white border border-emerald-500/20 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                Total Hak Penjualan
              </span>
              <p className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                {formatCurrency(stats.totalEarned)}
              </p>
            </div>
            <p className="text-xs text-emerald-400/80 mt-3">
              Dari {stats.soldCount} barang terjual
            </p>
          </div>

          {/* Sisa Saldo Tersedia (Setelah Ditarik) */}
          <div className="dark:bg-surface-200 bg-white border border-accent/20 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-accent uppercase tracking-wider block mb-2">
                Sisa Saldo Siap Ditarik
              </span>
              <p className="text-2xl lg:text-3xl font-extrabold text-accent tracking-tight">
                {formatCurrency(remainingBalance)}
              </p>
            </div>
            <div className="text-xs dark:text-gray-400 text-gray-500 mt-3 flex items-center justify-between">
              <span>Sudah Dicairkan:</span>
              <span className="font-semibold text-gray-300">{formatCurrency(totalWithdrawn)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl dark:bg-surface-200 bg-gray-100 border dark:border-white/5 border-gray-200 w-full sm:w-auto">
          {[
            { key: 'ALL', label: `Semua (${stats.total})` },
            { key: 'Belum Terjual', label: `Ready (${stats.readyCount})` },
            { key: 'Terjual', label: `Terjual (${stats.soldCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab.key
                  ? 'bg-accent text-dark-800 shadow-sm'
                  : 'dark:text-gray-400 text-gray-600 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Cari nama barang / kode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl text-xs dark:bg-surface-200 bg-white
              dark:text-white text-gray-900 placeholder-gray-400
              dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* Grid / Tabel Barang Saya */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={search ? 'Barang tidak ditemukan' : 'Belum ada barang dititipkan'}
          description={
            search
              ? `Tidak ada barang yang cocok dengan kata kunci "${search}"`
              : 'Anda belum memiliki barang yang terdaftar atas nama akun ini di Data Barang maupun Data Penjualan.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isSold = item.status === 'Terjual';

            return (
              <div
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 hover:border-accent/40 transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-lg">
                      {item.kodeBarang || 'FB-ITEM'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isSold
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isSold ? 'Terjual' : 'Belum Terjual'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold dark:text-white text-gray-900 group-hover:text-accent transition-colors leading-snug">
                    {item.namaBarang}
                  </h3>

                  <div className="flex items-center gap-2 mt-1.5 text-xs dark:text-gray-400 text-gray-500">
                    <span className="px-2 py-0.5 rounded-md dark:bg-white/5 bg-gray-100 font-medium">
                      {item.kategori || 'Baju'}
                    </span>
                    {item.catatan && (
                      <span className="truncate max-w-[180px] italic text-[11px] dark:text-gray-500 text-gray-400">
                        {item.catatan}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Kartu */}
                <div className="pt-3 border-t dark:border-white/5 border-gray-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] dark:text-gray-500 text-gray-400 block">
                      {isSold ? 'Hak Pembagian Hasil' : 'Harga Modal / Hak'}
                    </span>
                    <span className="font-extrabold text-sm text-emerald-400">
                      {formatCurrency(item.hakPemilik)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditItem(item);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/5 hover:bg-accent/20 hover:text-accent dark:hover:text-accent transition-all text-gray-600 dark:text-gray-300"
                    >
                      ✏️ Edit
                    </button>
                    {!isSold && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkSold(item);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent text-dark-800 hover:brightness-110 shadow-sm transition-all"
                      >
                        🏷️ Jual
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Detail Item */}
      {selectedDetailItem && (
        <InventoryDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedDetailItem(null);
          }}
          item={selectedDetailItem}
          onEdit={(itemToEdit) => {
            setIsDetailOpen(false);
            handleEditItem(itemToEdit);
          }}
          onMarkSold={(itemToSell) => {
            setIsDetailOpen(false);
            handleMarkSold(itemToSell);
          }}
        />
      )}

      {/* Modal: Edit Data Inventaris */}
      <InventoryFormModal
        isOpen={isEditInventoryOpen}
        onClose={() => {
          setIsEditInventoryOpen(false);
          setEditingInventoryData(null);
        }}
        onSubmit={handleInventoryEditSubmit}
        editData={editingInventoryData}
      />

      {/* Modal: Edit Data Transaksi Penjualan */}
      <SalesFormModal
        isOpen={isEditSalesOpen}
        onClose={() => {
          setIsEditSalesOpen(false);
          setEditingSalesData(null);
        }}
        onSubmit={handleSalesEditSubmit}
        editData={editingSalesData}
      />

      {/* Modal: Quick Sell to Penjualan */}
      <SalesFormModal
        isOpen={isQuickSellOpen}
        onClose={() => {
          setIsQuickSellOpen(false);
          setQuickSellData(null);
        }}
        onSubmit={handleQuickSellSubmit}
        editData={quickSellData}
      />
    </div>
  );
}
