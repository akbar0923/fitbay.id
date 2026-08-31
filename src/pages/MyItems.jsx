import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import InventoryDetailModal from '../components/inventory/InventoryDetailModal';

export default function MyItems() {
  const { user } = useAuth();
  const { items, loading: inventoryLoading } = useInventory();
  const { transactions, loading: salesLoading, profitSharingConfig } = useSales();

  const loading = inventoryLoading || salesLoading;

  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Belum Terjual' | 'Terjual'
  const [search, setSearch] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Normalisasi identitas pengguna yang sedang login untuk pencocokan nama pemilik barang
  const userIdentifiers = useMemo(() => {
    if (!user) return [];
    const ids = new Set();

    if (user.name) ids.add(user.name.trim().toLowerCase());
    if (user.username) ids.add(user.username.trim().toLowerCase());

    const cleanUser = (user.username || '').toLowerCase();
    if (cleanUser === 'muhbar' || cleanUser === 'akbar') {
      ids.add('akbar');
      ids.add('muhbar');
    }
    if (cleanUser === 'nessa' || cleanUser === 'nesa') {
      ids.add('nessa');
      ids.add('nesa');
    }
    if (cleanUser === 'andin') {
      ids.add('andin');
    }
    if (cleanUser === 'ritza') {
      ids.add('ritza');
    }

    return Array.from(ids);
  }, [user]);

  // Gabungkan seluruh data barang dari 2 sumber: Koleksi Inventory + Transaksi Penjualan Langsung
  const combinedMyItems = useMemo(() => {
    if (userIdentifiers.length === 0) return [];

    const result = [];
    const processedTxIds = new Set();
    const processedCodes = new Set();

    // 1. Ambil dari koleksi inventory milik user ini
    items.forEach((item) => {
      const owner = (item.pemilikBarang || '').trim().toLowerCase();
      const isMyItem = userIdentifiers.some((id) => owner === id || owner.includes(id));
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
      });
    });

    // 2. Ambil dari koleksi transactions langsung (yang belum terhubung ke inventory)
    transactions.forEach((tx) => {
      if (processedTxIds.has(tx.id)) return;
      if (tx.inventoryItemId && items.some((i) => i.id === tx.inventoryItemId)) return;
      if (tx.kodeBarang && processedCodes.has(tx.kodeBarang.toLowerCase())) return;

      const txOwner = (tx.ownerName || '').trim().toLowerCase();
      const isMyTx = userIdentifiers.some((id) => txOwner === id || txOwner.includes(id));
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
          kategori: tx.category || 'Baju',
          status: 'Terjual',
          pemilikBarang: tx.ownerName,
          tanggalMasuk: tx.date,
          tanggalTerjual: tx.date,
          hargaModal: 0,
          catatan: tx.notes,
        },
      });
    });

    return result;
  }, [items, transactions, userIdentifiers]);

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
    setSelectedDetailItem(item.rawItem || item);
    setIsDetailOpen(true);
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

          {/* Terjual */}
          <div className="dark:bg-surface-200 bg-white border border-emerald-500/20 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                Barang Sudah Laku
              </span>
              <p className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                {stats.soldCount} <span className="text-sm font-normal text-emerald-400/70">item</span>
              </p>
            </div>
            <p className="text-xs text-emerald-400/80 mt-3 flex items-center gap-1">
              <span>✓</span>
              <span>{stats.total > 0 ? Math.round((stats.soldCount / stats.total) * 100) : 0}% Tingkat Penjualan</span>
            </p>
          </div>

          {/* Total Hak Penjualan */}
          <div className="dark:bg-surface-200 bg-white border border-purple-500/20 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block mb-2">
                Total Hak dari Barang Terjual
              </span>
              <p className="text-2xl lg:text-3xl font-extrabold text-purple-400 tracking-tight">
                {formatCurrency(stats.totalEarned)}
              </p>
            </div>
            <p className="text-xs text-purple-400/80 mt-3 leading-relaxed">
              Sesuai skema bagi hasil barang Anda
            </p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-accent text-dark-800 shadow-sm'
                : 'dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700 hover:dark:bg-white/5'
            }`}
          >
            Semua ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('Belum Terjual')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              statusFilter === 'Belum Terjual'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700 hover:dark:bg-white/5'
            }`}
          >
            Belum Terjual ({stats.readyCount})
          </button>
          <button
            onClick={() => setStatusFilter('Terjual')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              statusFilter === 'Terjual'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700 hover:dark:bg-white/5'
            }`}
          >
            Terjual ({stats.soldCount})
          </button>
        </div>

        {/* Input Search */}
        <div className="relative w-full sm:w-72">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama barang atau kode SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs
              dark:bg-surface-200 bg-white dark:text-white text-gray-900
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

                  <div className="text-right">
                    <span className="text-[10px] dark:text-gray-500 text-gray-400 block">
                      {isSold ? 'Tgl Terjual' : 'Tgl Masuk'}
                    </span>
                    <span className="dark:text-gray-300 text-gray-700 font-medium">
                      {isSold && item.tanggalTerjual
                        ? formatDate(item.tanggalTerjual)
                        : item.tanggalMasuk
                        ? formatDate(item.tanggalMasuk)
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Item Modal */}
      {selectedDetailItem && (
        <InventoryDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedDetailItem(null);
          }}
          item={selectedDetailItem}
        />
      )}
    </div>
  );
}
