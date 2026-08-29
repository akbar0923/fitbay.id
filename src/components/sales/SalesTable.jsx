import { useState, useMemo } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { useOwners } from '../../context/OwnerContext';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import {
  CATEGORIES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_COLORS,
  PAGE_SIZE_OPTIONS,
} from '../../constants/profitSharingConfig';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import { SkeletonTable } from '../ui/Skeleton';

export default function SalesTable({ onEdit, onDelete, onAdd }) {
  const { transactions, loading } = useSales();
  const { isAdmin } = useAuth();
  const { owners } = useOwners();

  const [search, setSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredData = useMemo(() => {
    let data = [...transactions];

    // Search (Item name or owner)
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((tx) =>
        tx.itemName.toLowerCase().includes(q) ||
        (tx.ownerName && tx.ownerName.toLowerCase().includes(q)) ||
        tx.category.toLowerCase().includes(q)
      );
    }

    // Filter owner
    if (filterOwner) {
      data = data.filter((tx) => (tx.ownerName || '').toLowerCase() === filterOwner.toLowerCase());
    }

    // Filter category
    if (filterCategory) {
      data = data.filter((tx) => tx.category === filterCategory);
    }

    // Filter payment method
    if (filterPaymentMethod) {
      data = data.filter((tx) => (tx.paymentMethod || 'Transfer Bank') === filterPaymentMethod);
    }

    // Filter status
    if (filterStatus) {
      data = data.filter((tx) => tx.status === filterStatus);
    }

    // Filter date range
    if (filterDateStart) {
      data = data.filter((tx) => tx.date >= filterDateStart);
    }
    if (filterDateEnd) {
      data = data.filter((tx) => tx.date <= filterDateEnd);
    }

    // Sort
    data.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'date': valA = a.date; valB = b.date; break;
        case 'itemName': valA = a.itemName.toLowerCase(); valB = b.itemName.toLowerCase(); break;
        case 'ownerName': valA = (a.ownerName || '').toLowerCase(); valB = (b.ownerName || '').toLowerCase(); break;
        case 'costPrice': valA = a.costPrice; valB = b.costPrice; break;
        case 'sellingPrice': valA = a.sellingPrice; valB = b.sellingPrice; break;
        case 'profit': valA = a.profit; valB = b.profit; break;
        default: valA = a.date; valB = b.date;
      }
      if (sortDir === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    return data;
  }, [transactions, search, filterOwner, filterCategory, filterPaymentMethod, filterStatus, filterDateStart, filterDateEnd, sortBy, sortDir]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => (
    <span className={`ml-1 inline-block transition-transform ${sortBy === field ? 'dark:text-accent text-accent-dark' : 'dark:text-gray-600 text-gray-300'}`}>
      {sortBy === field && sortDir === 'asc' ? '↑' : '↓'}
    </span>
  );

  const clearFilters = () => {
    setSearch('');
    setFilterOwner('');
    setFilterCategory('');
    setFilterPaymentMethod('');
    setFilterStatus('');
    setFilterDateStart('');
    setFilterDateEnd('');
    setPage(1);
  };

  const hasFilters = search || filterOwner || filterCategory || filterPaymentMethod || filterStatus || filterDateStart || filterDateEnd;

  if (loading) return <SkeletonTable rows={5} />;

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Row 1: Search & Owner */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama barang atau pemilik..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm
                  dark:bg-surface-300 bg-gray-100 dark:text-white text-gray-900
                  dark:border-white/10 border-gray-300 border
                  dark:placeholder-gray-500 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Owner Filter */}
            <select
              value={filterOwner}
              onChange={(e) => { setFilterOwner(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-xl text-sm dark:bg-surface-300 bg-white 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer
                bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke-width%3D%221.5%22%20stroke%3D%22%239ca3af%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%20%2F%3E%3C%2Fsvg%3E')]
                bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
            >
              <option value="">Semua Pemilik</option>
              {owners.map((o) => (
                <option key={o.id || o.name} value={o.name}>{o.name}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-xl text-sm dark:bg-surface-300 bg-white 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer
                bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke-width%3D%221.5%22%20stroke%3D%22%239ca3af%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%20%2F%3E%3C%2Fsvg%3E')]
                bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
            >
              <option value="">Semua Kategori</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Payment Method, Status, Date Range & Reset */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Payment Method Filter */}
            <select
              value={filterPaymentMethod}
              onChange={(e) => { setFilterPaymentMethod(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-xl text-sm dark:bg-surface-300 bg-white 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer
                bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke-width%3D%221.5%22%20stroke%3D%22%239ca3af%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%20%2F%3E%3C%2Fsvg%3E')]
                bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
            >
              <option value="">Semua Pembayaran</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-xl text-sm dark:bg-surface-300 bg-white 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer
                bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke-width%3D%221.5%22%20stroke%3D%22%239ca3af%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%20%2F%3E%3C%2Fsvg%3E')]
                bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
            >
              <option value="">Semua Status</option>
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={filterDateStart}
              onChange={(e) => { setFilterDateStart(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl text-sm dark:bg-surface-300 bg-gray-100 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <span className="text-xs dark:text-gray-500 text-gray-400">—</span>
            <input
              type="date"
              value={filterDateEnd}
              onChange={(e) => { setFilterDateEnd(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl text-sm dark:bg-surface-300 bg-gray-100 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50"
            />

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-xl text-xs dark:text-gray-400 text-gray-500 
                  dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/5 hover:bg-gray-100
                  transition-all duration-200 whitespace-nowrap ml-auto"
              >
                ✕ Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-xs dark:text-gray-500 text-gray-400">
          Menampilkan <span className="font-semibold dark:text-white text-gray-900">{filteredData.length}</span> transaksi
        </p>
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Tidak ada transaksi yang cocok' : 'Belum ada data transaksi'}
          description={hasFilters ? 'Coba ubah filter pencarian Anda' : 'Mulai tambahkan transaksi pertama Anda'}
          action={
            !hasFilters && (
              <Button onClick={onAdd}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Tambah Transaksi
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="dark:bg-white/[0.02] bg-gray-50 border-b dark:border-white/5 border-gray-200">
                    <th onClick={() => handleSort('date')} className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider cursor-pointer hover:text-accent">
                      Tanggal <SortIcon field="date" />
                    </th>
                    <th onClick={() => handleSort('itemName')} className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider cursor-pointer hover:text-accent">
                      Nama Barang <SortIcon field="itemName" />
                    </th>
                    <th onClick={() => handleSort('ownerName')} className="px-3 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider cursor-pointer hover:text-accent">
                      Pemilik <SortIcon field="ownerName" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th onClick={() => handleSort('costPrice')} className="px-3 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider cursor-pointer hover:text-accent">
                      Modal <SortIcon field="costPrice" />
                    </th>
                    <th onClick={() => handleSort('sellingPrice')} className="px-3 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider cursor-pointer hover:text-accent">
                      Jual <SortIcon field="sellingPrice" />
                    </th>
                    <th onClick={() => handleSort('profit')} className="px-3 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider cursor-pointer hover:text-accent">
                      Keuntungan <SortIcon field="profit" />
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">
                      Metode
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                  {paginatedData.map((tx) => {
                    const payColor = PAYMENT_METHOD_COLORS[tx.paymentMethod || 'Transfer Bank'] || PAYMENT_METHOD_COLORS['Transfer Bank'];
                    return (
                      <tr key={tx.id} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-3.5 text-sm dark:text-gray-300 text-gray-700 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-4 py-3.5 text-sm dark:text-white text-gray-900 font-medium max-w-[160px] truncate">
                          {tx.itemName}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium dark:bg-emerald-500/10 bg-emerald-50 text-emerald-400 border dark:border-emerald-500/20 border-emerald-200">
                            {tx.ownerName || 'Akbar'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <span className="text-xs px-2 py-0.5 rounded-lg dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600">
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-sm text-right dark:text-gray-400 text-gray-600 whitespace-nowrap">
                          {formatCurrency(tx.costPrice)}
                        </td>
                        <td className="px-3 py-3.5 text-sm text-right dark:text-gray-200 text-gray-900 whitespace-nowrap font-medium">
                          {formatCurrency(tx.sellingPrice)}
                        </td>
                        <td className={`px-3 py-3.5 text-sm text-right whitespace-nowrap font-semibold ${tx.profit > 0 ? 'text-emerald-400' : tx.profit < 0 ? 'text-red-400' : 'dark:text-gray-400 text-gray-600'}`}>
                          {formatCurrency(tx.profit)}
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${payColor.bg} ${payColor.text}`}>
                            <span>{payColor.icon}</span>
                            <span>{tx.paymentMethod || 'Transfer'}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <Badge status={tx.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onEdit(tx)}
                              className="p-2 rounded-lg dark:text-gray-400 text-gray-500 dark:hover:text-blue-400 hover:text-blue-600 dark:hover:bg-blue-500/10 hover:bg-blue-50 transition-all duration-200"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            {/* Tombol Hapus hanya untuk Admin */}
                            {isAdmin && (
                              <button
                                onClick={() => onDelete(tx)}
                                className="p-2 rounded-lg dark:text-gray-400 text-gray-500 dark:hover:text-red-400 hover:text-red-600 dark:hover:bg-red-500/10 hover:bg-red-50 transition-all duration-200"
                                title="Hapus (Admin)"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginatedData.map((tx) => {
              const payColor = PAYMENT_METHOD_COLORS[tx.paymentMethod || 'Transfer Bank'] || PAYMENT_METHOD_COLORS['Transfer Bank'];
              return (
                <div key={tx.id} className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold dark:text-white text-gray-900">{tx.itemName}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs dark:text-gray-400 text-gray-500">
                        <span>{formatDate(tx.date)}</span>
                        <span>·</span>
                        <span className="font-medium text-accent">{tx.ownerName || 'Akbar'}</span>
                        <span>·</span>
                        <span>{tx.category}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge status={tx.status} />
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${payColor.bg} ${payColor.text}`}>
                        {tx.paymentMethod || 'Transfer'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t dark:border-white/5 border-gray-100">
                    <div>
                      <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">Modal</p>
                      <p className="text-xs dark:text-gray-300 text-gray-700">{formatCurrency(tx.costPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">Jual</p>
                      <p className="text-xs dark:text-gray-300 text-gray-700 font-medium">{formatCurrency(tx.sellingPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] dark:text-gray-500 text-gray-400 uppercase">Untung</p>
                      <p className={`text-xs font-semibold ${tx.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(tx.profit)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t dark:border-white/5 border-gray-100">
                    <button
                      onClick={() => onEdit(tx)}
                      className="px-3 py-1.5 text-xs rounded-lg dark:text-blue-400 text-blue-600 dark:bg-blue-500/10 bg-blue-50 transition-all font-medium"
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => onDelete(tx)}
                        className="px-3 py-1.5 text-xs rounded-lg dark:text-red-400 text-red-600 dark:bg-red-500/10 bg-red-50 transition-all font-medium"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs dark:text-gray-500 text-gray-400">Tampilkan</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 rounded-lg text-xs dark:bg-surface-300 bg-white 
                    dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                    focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-xs dark:text-gray-500 text-gray-400">per halaman</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-lg dark:text-gray-400 text-gray-500 dark:hover:bg-white/5 hover:bg-gray-100 
                    disabled:opacity-30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200
                        ${page === pageNum
                          ? 'bg-accent text-white'
                          : 'dark:text-gray-400 text-gray-500 dark:hover:bg-white/5 hover:bg-gray-100'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-lg dark:text-gray-400 text-gray-500 dark:hover:bg-white/5 hover:bg-gray-100 
                    disabled:opacity-30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
