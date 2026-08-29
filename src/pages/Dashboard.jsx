import { useState, useMemo } from 'react';
import { useSales } from '../context/SalesContext';
import { useAuth } from '../context/AuthContext';
import SummaryCard from '../components/dashboard/SummaryCard';
import SalesChart from '../components/dashboard/SalesChart';
import ProfitSharingSummary from '../components/dashboard/ProfitSharingSummary';
import { SkeletonCard } from '../components/ui/Skeleton';
import { formatCurrency } from '../utils/formatCurrency';

export default function Dashboard() {
  const { transactions, loading, getTotalRevenue, getTotalProfit, getCurrentMonthTransactions } = useSales();
  const { user, isAdmin } = useAuth();

  const [dateFilter, setDateFilter] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let start, end;

    switch (dateFilter) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week': {
        const dayOfWeek = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59);
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'custom':
        if (customStart && customEnd) {
          start = new Date(customStart);
          end = new Date(customEnd + 'T23:59:59');
        } else {
          return transactions;
        }
        break;
      default:
        return transactions;
    }

    return transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, dateFilter, customStart, customEnd]);

  const monthlyTxs = getCurrentMonthTransactions();
  const monthRevenue = getTotalRevenue(monthlyTxs);
  const monthProfit = getTotalProfit(monthlyTxs);
  const totalRevenue = getTotalRevenue(transactions);
  const totalProfit = getTotalProfit(transactions);
  const monthTxCount = monthlyTxs.filter((tx) => tx.status === 'Terjual').length;

  // Breakdown Payment Methods
  const paymentStats = useMemo(() => {
    const sold = filteredTransactions.filter((tx) => tx.status === 'Terjual');
    const transferTxs = sold.filter((tx) => (tx.paymentMethod || 'Transfer Bank') === 'Transfer Bank');
    const qrisTxs = sold.filter((tx) => tx.paymentMethod === 'QRIS');

    const transferTotal = transferTxs.reduce((sum, tx) => sum + tx.sellingPrice, 0);
    const qrisTotal = qrisTxs.reduce((sum, tx) => sum + tx.sellingPrice, 0);

    return {
      transferCount: transferTxs.length,
      transferTotal,
      qrisCount: qrisTxs.length,
      qrisTotal,
    };
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">Dashboard</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase
              ${isAdmin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}
            >
              {isAdmin ? 'Admin View' : 'Staff View'}
            </span>
          </div>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">
            Halo {user?.name || user?.username}, ringkasan aktivitas operasional Fitbay.id
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex dark:bg-surface-200 bg-gray-100 rounded-xl p-1 border dark:border-white/5 border-gray-200">
            {[
              { key: 'today', label: 'Hari Ini' },
              { key: 'week', label: 'Minggu Ini' },
              { key: 'month', label: 'Bulan Ini' },
              { key: 'custom', label: 'Custom' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setDateFilter(filter.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200
                  ${dateFilter === filter.key
                    ? 'bg-accent text-white shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs dark:bg-surface-200 bg-gray-100 
                  dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <span className="text-xs dark:text-gray-500 text-gray-400">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs dark:bg-surface-200 bg-gray-100 
                  dark:text-white text-gray-900 dark:border-white/10 border-gray-300 border
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Pendapatan Bulan Ini"
          value={monthRevenue}
          subtitle={`Total: ${formatCurrency(totalRevenue)}`}
          icon="💰"
          color="accent"
          delay={0}
        />
        
        <SummaryCard
          title="Keuntungan Bulan Ini"
          value={monthProfit}
          subtitle={`Total: ${formatCurrency(totalProfit)}`}
          icon="📈"
          color="purple"
          delay={100}
        />

        <SummaryCard
          title="Transaksi Terjual"
          value={`${monthTxCount}`}
          subtitle={`Total: ${transactions.filter(tx => tx.status === 'Terjual').length} transaksi`}
          icon="🛒"
          color="blue"
          delay={200}
        />

        <SummaryCard
          title="Rata-rata Keuntungan"
          value={monthTxCount > 0 ? Math.round(monthProfit / monthTxCount) : 0}
          subtitle="Per transaksi bulan ini"
          icon="⚡"
          color="amber"
          delay={300}
        />
      </div>

      {/* Sales Chart */}
      <SalesChart filteredTransactions={filteredTransactions} />

      {/* Profit Sharing & Sisa Saldo Summary (Dapat dilihat oleh semua role) */}
      <ProfitSharingSummary filteredTransactions={filteredTransactions} />

      {/* Rekap Metode Pembayaran */}
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 animate-slide-up">
        <h3 className="text-sm font-semibold dark:text-white text-gray-900 mb-4">
          Rekap Pembayaran Periode Ini
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
                🏦
              </div>
              <div>
                <p className="text-xs text-blue-400 font-medium uppercase">Transfer Bank</p>
                <p className="text-lg font-bold dark:text-white text-gray-900">{formatCurrency(paymentStats.transferTotal)}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full dark:bg-white/10 bg-white text-blue-400">
              {paymentStats.transferCount} item
            </span>
          </div>

          <div className="p-4 rounded-xl dark:bg-purple/10 bg-purple/10 border dark:border-purple/20 border-purple/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple/20 text-purple flex items-center justify-center text-xl">
                📱
              </div>
              <div>
                <p className="text-xs text-purple font-medium uppercase">QRIS</p>
                <p className="text-lg font-bold dark:text-white text-gray-900">{formatCurrency(paymentStats.qrisTotal)}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full dark:bg-white/10 bg-white text-purple">
              {paymentStats.qrisCount} item
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
