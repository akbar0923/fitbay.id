import { useState, useMemo } from 'react';
import { useSales } from '../context/SalesContext';
import { useOwners } from '../context/OwnerContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { calculateTotalSharing } from '../utils/calculateProfitSharing';
import { PROFIT_SHARING_CONFIG, PAYMENT_METHODS } from '../constants/profitSharingConfig';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import * as XLSX from 'xlsx';

export default function Reports() {
  const { transactions, loading, profitSharingConfig } = useSales();
  const { owners } = useOwners();
  const { isAdmin } = useAuth();

  const [viewMode, setViewMode] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterOwner, setFilterOwner] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map((tx) => new Date(tx.date).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [transactions]);

  // Data transaksi yang sudah difilter berdasarkan pemilik & metode bayar
  const filteredTransactions = useMemo(() => {
    let list = transactions.filter((tx) => tx.status === 'Terjual');
    if (filterOwner) {
      list = list.filter((tx) => (tx.ownerName || '').toLowerCase() === filterOwner.toLowerCase());
    }
    if (filterPaymentMethod) {
      list = list.filter((tx) => (tx.paymentMethod || 'Transfer Bank') === filterPaymentMethod);
    }
    return list;
  }, [transactions, filterOwner, filterPaymentMethod]);

  const reportData = useMemo(() => {
    if (viewMode === 'monthly') {
      const months = [];
      for (let m = 0; m < 12; m++) {
        const monthTxs = filteredTransactions.filter((tx) => {
          const d = new Date(tx.date);
          return d.getFullYear() === selectedYear && d.getMonth() === m;
        });

        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const revenue = monthTxs.reduce((sum, tx) => sum + tx.sellingPrice, 0);
        const profit = monthTxs.reduce((sum, tx) => sum + tx.profit, 0);
        const sharing = calculateTotalSharing(monthTxs, profitSharingConfig);

        const transferCount = monthTxs.filter((tx) => (tx.paymentMethod || 'Transfer Bank') === 'Transfer Bank').length;
        const qrisCount = monthTxs.filter((tx) => tx.paymentMethod === 'QRIS').length;

        months.push({
          period: monthNames[m],
          periodKey: `${selectedYear}-${String(m + 1).padStart(2, '0')}`,
          count: monthTxs.length,
          revenue,
          profit,
          transferCount,
          qrisCount,
          sharing,
        });
      }
      return months;
    } else {
      const years = {};
      filteredTransactions.forEach((tx) => {
        const year = new Date(tx.date).getFullYear();
        if (!years[year]) {
          years[year] = { period: String(year), count: 0, revenue: 0, profit: 0, transferCount: 0, qrisCount: 0, txs: [] };
        }
        years[year].count += 1;
        years[year].revenue += tx.sellingPrice;
        years[year].profit += tx.profit;
        if ((tx.paymentMethod || 'Transfer Bank') === 'Transfer Bank') {
          years[year].transferCount += 1;
        } else {
          years[year].qrisCount += 1;
        }
        years[year].txs.push(tx);
      });

      return Object.values(years)
        .map((y) => ({
          ...y,
          sharing: calculateTotalSharing(y.txs, profitSharingConfig),
        }))
        .sort((a, b) => b.period.localeCompare(a.period));
    }
  }, [filteredTransactions, viewMode, selectedYear, profitSharingConfig]);

  const totals = useMemo(() => {
    return {
      count: reportData.reduce((s, r) => s + r.count, 0),
      revenue: reportData.reduce((s, r) => s + r.revenue, 0),
      profit: reportData.reduce((s, r) => s + r.profit, 0),
    };
  }, [reportData]);

  // Rekap metode pembayaran
  const paymentBreakdown = useMemo(() => {
    const transferTxs = filteredTransactions.filter((tx) => (tx.paymentMethod || 'Transfer Bank') === 'Transfer Bank');
    const qrisTxs = filteredTransactions.filter((tx) => tx.paymentMethod === 'QRIS');

    const transferTotal = transferTxs.reduce((sum, tx) => sum + tx.sellingPrice, 0);
    const qrisTotal = qrisTxs.reduce((sum, tx) => sum + tx.sellingPrice, 0);

    return {
      transferCount: transferTxs.length,
      transferTotal,
      qrisCount: qrisTxs.length,
      qrisTotal,
      total: transferTotal + qrisTotal,
    };
  }, [filteredTransactions]);

  const exportToExcel = () => {
    const shareKeys = Object.keys(PROFIT_SHARING_CONFIG);

    const rows = reportData.map((row) => {
      const base = {
        Periode: row.period,
        'Jumlah Transaksi': row.count,
        'Via Transfer': row.transferCount,
        'Via QRIS': row.qrisCount,
        'Pendapatan Kotor': row.revenue,
        'Keuntungan Bersih': row.profit,
      };
      if (isAdmin) {
        shareKeys.forEach((key) => {
          base[PROFIT_SHARING_CONFIG[key].label] = row.sharing[key] || 0;
        });
      }
      return base;
    });

    // Add totals row
    const totalRow = {
      Periode: 'TOTAL',
      'Jumlah Transaksi': totals.count,
      'Via Transfer': paymentBreakdown.transferCount,
      'Via QRIS': paymentBreakdown.qrisCount,
      'Pendapatan Kotor': totals.revenue,
      'Keuntungan Bersih': totals.profit,
    };
    if (isAdmin) {
      const totalSharing = calculateTotalSharing(filteredTransactions);
      shareKeys.forEach((key) => { totalRow[PROFIT_SHARING_CONFIG[key].label] = totalSharing[key] || 0; });
    }
    rows.push(totalRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    XLSX.writeFile(wb, `Fitbay_Laporan_${viewMode === 'monthly' ? selectedYear : 'Tahunan'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const shareKeys = Object.keys(PROFIT_SHARING_CONFIG);
    const headers = [
      'Periode',
      'Jumlah Transaksi',
      'Via Transfer',
      'Via QRIS',
      'Pendapatan Kotor',
      'Keuntungan Bersih',
      ...(isAdmin ? shareKeys.map((k) => PROFIT_SHARING_CONFIG[k].label) : []),
    ];

    const rows = reportData.map((row) => {
      return [
        row.period,
        row.count,
        row.transferCount,
        row.qrisCount,
        row.revenue,
        row.profit,
        ...(isAdmin ? shareKeys.map((k) => row.sharing[k] || 0) : []),
      ];
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Fitbay_Laporan_${viewMode === 'monthly' ? selectedYear : 'Tahunan'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) return <SkeletonTable rows={8} />;

  const shareKeys = Object.keys(PROFIT_SHARING_CONFIG);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Laporan</h1>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">
            Rekap penjualan, metode pembayaran, dan rincian pembagian hasil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={exportToExcel}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Excel
          </Button>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Toggle */}
          <div className="flex dark:bg-surface-300 bg-gray-100 rounded-xl p-1 border dark:border-white/5 border-gray-200">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200
                ${viewMode === 'monthly' ? 'bg-accent text-white shadow-sm' : 'dark:text-gray-400 text-gray-600'}`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200
                ${viewMode === 'yearly' ? 'bg-accent text-white shadow-sm' : 'dark:text-gray-400 text-gray-600'}`}
            >
              Tahunan
            </button>
          </div>

          {/* Year selector */}
          {viewMode === 'monthly' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 rounded-xl text-sm dark:bg-surface-300 bg-white 
                dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          )}

          {/* Owner Filter */}
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="px-4 py-2 rounded-xl text-sm dark:bg-surface-300 bg-white 
              dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
          >
            <option value="">Semua Pemilik</option>
            {owners.map((o) => (
              <option key={o.id || o.name} value={o.name}>{o.name}</option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
            className="px-4 py-2 rounded-xl text-sm dark:bg-surface-300 bg-white 
              dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
              focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
          >
            <option value="">Semua Metode Pembayaran</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>{pm}</option>
            ))}
          </select>
        </div>

        {(filterOwner || filterPaymentMethod) && (
          <button
            onClick={() => { setFilterOwner(''); setFilterPaymentMethod(''); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            ✕ Reset Filter
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-500 uppercase tracking-wider">Total Transaksi</p>
          <p className="text-2xl font-bold dark:text-white text-gray-900 mt-1">{totals.count} item</p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs dark:text-gray-500 text-gray-500 uppercase tracking-wider">Total Pendapatan</p>
          <p className="text-2xl font-bold text-accent mt-1">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-400 uppercase tracking-wider font-semibold">Via Transfer Bank</p>
            <span className="text-xs px-2 py-0.5 rounded-full dark:bg-blue-500/10 bg-blue-50 text-blue-400 font-bold">
              {paymentBreakdown.transferCount} tx
            </span>
          </div>
          <p className="text-xl font-bold dark:text-white text-gray-900 mt-1">{formatCurrency(paymentBreakdown.transferTotal)}</p>
        </div>
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-purple uppercase tracking-wider font-semibold">Via QRIS</p>
            <span className="text-xs px-2 py-0.5 rounded-full dark:bg-purple/10 bg-purple/10 text-purple font-bold">
              {paymentBreakdown.qrisCount} tx
            </span>
          </div>
          <p className="text-xl font-bold dark:text-white text-gray-900 mt-1">{formatCurrency(paymentBreakdown.qrisTotal)}</p>
        </div>
      </div>

      {/* Report Table */}
      {filteredTransactions.length === 0 ? (
        <EmptyState
          title="Belum ada data laporan yang cocok"
          description="Coba ubah filter pemilik atau metode pembayaran"
        />
      ) : (
        <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-white/[0.02] bg-gray-50 border-b dark:border-white/5 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Periode</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Transaksi</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider">Transfer</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-purple uppercase tracking-wider">QRIS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Pendapatan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Keuntungan</th>
                  {isAdmin && shareKeys.map((key) => (
                    <th key={key} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider hidden xl:table-cell" style={{ color: PROFIT_SHARING_CONFIG[key].color }}>
                      {PROFIT_SHARING_CONFIG[key].label.split(' ').pop()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 divide-gray-100">
                {reportData.map((row) => (
                  <tr key={row.period} className={`dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors ${row.count === 0 ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3.5 text-sm dark:text-white text-gray-900 font-medium">{row.period}</td>
                    <td className="px-4 py-3.5 text-sm text-center dark:text-gray-300 text-gray-700">{row.count}</td>
                    <td className="px-4 py-3.5 text-sm text-center text-blue-400 font-medium">{row.transferCount}</td>
                    <td className="px-4 py-3.5 text-sm text-center text-purple font-medium">{row.qrisCount}</td>
                    <td className="px-4 py-3.5 text-sm text-right dark:text-gray-300 text-gray-700">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3.5 text-sm text-right font-semibold text-emerald-400">{formatCurrency(row.profit)}</td>
                    {isAdmin && shareKeys.map((key) => (
                      <td key={key} className="px-3 py-3.5 text-sm text-right dark:text-gray-300 text-gray-700 hidden xl:table-cell">
                        {formatCurrency(row.sharing[key] || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Totals */}
                <tr className="dark:bg-white/[0.03] bg-gray-50 font-bold border-t-2 dark:border-white/10 border-gray-300">
                  <td className="px-4 py-3.5 text-sm dark:text-white text-gray-900">Total</td>
                  <td className="px-4 py-3.5 text-sm text-center dark:text-white text-gray-900">{totals.count}</td>
                  <td className="px-4 py-3.5 text-sm text-center text-blue-400">{paymentBreakdown.transferCount}</td>
                  <td className="px-4 py-3.5 text-sm text-center text-purple">{paymentBreakdown.qrisCount}</td>
                  <td className="px-4 py-3.5 text-sm text-right text-accent">{formatCurrency(totals.revenue)}</td>
                  <td className="px-4 py-3.5 text-sm text-right text-emerald-400">{formatCurrency(totals.profit)}</td>
                  {isAdmin && shareKeys.map((key) => {
                    const total = reportData.reduce((s, r) => s + (r.sharing[key] || 0), 0);
                    return (
                      <td key={key} className="px-3 py-3.5 text-sm text-right hidden xl:table-cell" style={{ color: PROFIT_SHARING_CONFIG[key].color }}>
                        {formatCurrency(total)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
