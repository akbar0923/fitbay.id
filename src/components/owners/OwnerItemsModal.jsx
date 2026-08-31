import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { useInventory } from '../../context/InventoryContext';
import { useSales } from '../../context/SalesContext';
import { useWithdrawals } from '../../context/WithdrawalContext';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';

export default function OwnerItemsModal({ isOpen, onClose, owner }) {
  const { items } = useInventory();
  const { transactions } = useSales();
  const { getTotalWithdrawnByOwner } = useWithdrawals();

  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Belum Terjual' | 'Terjual'
  const [search, setSearch] = useState('');

  const ownerName = owner?.name || '';

  // Filter barang milik owner ini
  const ownerItems = useMemo(() => {
    if (!ownerName) return [];
    const cleanName = ownerName.trim().toLowerCase();
    return items.filter(
      (item) => (item.pemilikBarang || '').trim().toLowerCase() === cleanName
    );
  }, [items, ownerName]);

  // Statistik Keuangan & Jumlah Barang
  const stats = useMemo(() => {
    const total = ownerItems.length;
    const readyItems = ownerItems.filter((i) => i.status === 'Belum Terjual');
    const soldItems = ownerItems.filter((i) => i.status === 'Terjual');

    let totalEarned = 0;
    soldItems.forEach((item) => {
      if (item.referensiTransaksiId) {
        const tx = transactions.find((t) => t.id === item.referensiTransaksiId);
        if (tx && tx.profitSharing?.pemilikBarang !== undefined) {
          totalEarned += Number(tx.profitSharing.pemilikBarang) || 0;
          return;
        }
      }
      totalEarned += Number(item.hargaModal) || 0;
    });

    const totalWithdrawn = getTotalWithdrawnByOwner(ownerName);
    const remainingBalance = Math.max(0, totalEarned - totalWithdrawn);
    const readyCapital = readyItems.reduce((sum, i) => sum + (Number(i.hargaModal) || 0), 0);

    return {
      total,
      readyCount: readyItems.length,
      soldCount: soldItems.length,
      totalEarned,
      totalWithdrawn,
      remainingBalance,
      readyCapital,
    };
  }, [ownerItems, transactions, getTotalWithdrawnByOwner, ownerName]);

  // Filter dan Pencarian
  const filteredItems = useMemo(() => {
    return ownerItems.filter((item) => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.namaBarang && item.namaBarang.toLowerCase().includes(q)) ||
        (item.kodeBarang && item.kodeBarang.toLowerCase().includes(q)) ||
        (item.kategori && item.kategori.toLowerCase().includes(q));

      return matchStatus && matchSearch;
    });
  }, [ownerItems, statusFilter, search]);

  if (!owner) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Daftar Barang Penitip: ${owner.name}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Profil Singkat & Status Penitip */}
        <div className="p-4 rounded-2xl dark:bg-surface-300 bg-gray-50 border dark:border-white/5 border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent font-extrabold text-sm flex items-center justify-center uppercase">
              {owner.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold dark:text-white text-gray-900">{owner.name}</h3>
                {owner.isCustomScheme ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/20">
                    ⚡ {owner.customScheme?.pemilikBarang || 85}% Hak Pemilik
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    🌐 Standar Global
                  </span>
                )}
              </div>
              <p className="text-xs dark:text-gray-400 text-gray-500 mt-0.5">
                No. WhatsApp: <span className="font-mono font-medium">{owner.phone || '-'}</span>
                {owner.notes && <span className="ml-2 italic text-gray-400">({owner.notes})</span>}
              </p>
            </div>
          </div>

          {owner.phone && owner.phone !== '-' && (
            <a
              href={`https://wa.me/${owner.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#25D366]/20"
            >
              <span>📱 Chat WhatsApp</span>
            </a>
          )}
        </div>

        {/* 4 Kartu Metrik Ringkasan */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl dark:bg-surface-300 bg-white border dark:border-white/5 border-gray-200">
            <span className="text-[10px] font-bold dark:text-gray-400 text-gray-500 uppercase tracking-wider block">
              Total Barang
            </span>
            <p className="text-xl font-bold dark:text-white text-gray-900 mt-1">
              {stats.total} <span className="text-xs font-normal text-gray-400">item</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl dark:bg-surface-300 bg-white border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
              Stok Ready
            </span>
            <p className="text-xl font-bold text-amber-400 mt-1">
              {stats.readyCount} <span className="text-xs font-normal text-amber-400/70">item</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl dark:bg-surface-300 bg-white border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Barang Terjual
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1">
              {stats.soldCount} <span className="text-xs font-normal text-emerald-400/70">item</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl dark:bg-surface-300 bg-white border border-purple-500/20">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
              Sisa Saldo Belum Cair
            </span>
            <p className="text-xl font-extrabold text-purple-400 mt-1">
              {formatCurrency(stats.remainingBalance)}
            </p>
          </div>
        </div>

        {/* Filter Tab & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-accent text-dark-800 shadow-sm'
                  : 'dark:bg-surface-300 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('Belum Terjual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'Belum Terjual'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'dark:bg-surface-300 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700'
              }`}
            >
              Ready ({stats.readyCount})
            </button>
            <button
              onClick={() => setStatusFilter('Terjual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'Terjual'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'dark:bg-surface-300 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700'
              }`}
            >
              Terjual ({stats.soldCount})
            </button>
          </div>

          <input
            type="text"
            placeholder="Cari barang / SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-60 px-3 py-1.5 rounded-xl text-xs
              dark:bg-surface-300 bg-white dark:text-white text-gray-900
              dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {/* Tabel / Grid Barang Penitip */}
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-2xl dark:bg-surface-300 bg-gray-50 border dark:border-white/5 border-gray-200 text-xs text-gray-400">
            {search ? 'Tidak ada barang yang cocok dengan pencarian.' : 'Penitip ini belum memiliki barang terdaftar.'}
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {filteredItems.map((item) => {
              const isSold = item.status === 'Terjual';
              const linkedTx = isSold && item.referensiTransaksiId
                ? transactions.find((t) => t.id === item.referensiTransaksiId)
                : null;

              const hakPemilik = linkedTx?.profitSharing?.pemilikBarang !== undefined
                ? linkedTx.profitSharing.pemilikBarang
                : Number(item.hargaModal) || 0;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl dark:bg-surface-300 bg-white border dark:border-white/5 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-accent/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                      {item.kodeBarang || 'FB-ITEM'}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold dark:text-white text-gray-900">{item.namaBarang}</h4>
                      <p className="text-[11px] dark:text-gray-400 text-gray-500">
                        Kategori: <span className="font-medium">{item.kategori || 'Baju'}</span> • Titip:{' '}
                        {item.tanggalMasuk ? formatDate(item.tanggalMasuk) : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] dark:text-gray-500 text-gray-400 block">
                        {isSold ? 'Hak Pembagian Hasil' : 'Harga Modal'}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        {formatCurrency(hakPemilik)}
                      </span>
                    </div>

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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
