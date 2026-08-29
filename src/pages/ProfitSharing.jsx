import { useState, useMemo } from 'react';
import { useSales } from '../context/SalesContext';
import { useWithdrawals } from '../context/WithdrawalContext';
import ProfitTable from '../components/profitSharing/ProfitTable';
import ProfitChart from '../components/profitSharing/ProfitChart';
import ProfitSharingSettingsModal from '../components/profitSharing/ProfitSharingSettingsModal';
import { SkeletonCard } from '../components/ui/Skeleton';
import { formatCurrency } from '../utils/formatCurrency';
import { calculateTotalSharing } from '../utils/calculateProfitSharing';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function ProfitSharing() {
  const { transactions, loading, profitSharingConfig } = useSales();
  const { getTotalWithdrawn } = useWithdrawals();

  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      case 'all':
        return transactions;
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

  // Perhitungan total sharing dengan profitSharingConfig dinamis
  const totals = useMemo(
    () => calculateTotalSharing(filteredTransactions, profitSharingConfig),
    [filteredTransactions, profitSharingConfig]
  );

  const totalProfit = filteredTransactions
    .filter((tx) => tx.status === 'Terjual')
    .reduce((sum, tx) => sum + tx.profit, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Pembagian Hasil</h1>
          <p className="text-sm dark:text-gray-500 text-gray-500 mt-1">
            Rincian pembagian keuntungan per pihak dan status sisa saldo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsSettingsOpen(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span>Atur Persentase Bagi Hasil</span>
          </Button>

          <Link to="/withdrawals">
            <Button>
              <span>💸</span>
              <span>Kelola Penarikan Saldo</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex dark:bg-surface-200 bg-gray-100 rounded-xl p-1 border dark:border-white/5 border-gray-200">
          {[
            { key: 'today', label: 'Hari Ini' },
            { key: 'week', label: 'Minggu Ini' },
            { key: 'month', label: 'Bulan Ini' },
            { key: 'all', label: 'Semua Periode' },
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

      {/* Summary Cards with Remaining Balance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(profitSharingConfig || {}).map(([key, config]) => {
          const earned = totals[key] || 0;
          const withdrawn = getTotalWithdrawn(key);
          const remaining = Math.max(0, earned - withdrawn);

          return (
            <div
              key={key}
              className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 
                rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <span>{config.icon}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
                    {config.percentage}%
                  </span>
                </div>

                <p className="text-xs dark:text-gray-400 text-gray-600 truncate font-medium">{config.label}</p>
                <p className="text-sm font-bold mt-0.5 dark:text-white text-gray-900">
                  {formatCurrency(earned)}
                </p>
              </div>

              {/* Sisa Saldo Tersedia */}
              <div className="mt-3 pt-2.5 border-t dark:border-white/5 border-gray-100">
                <div className="flex justify-between items-center text-[10px] mb-0.5">
                  <span className="dark:text-gray-500 text-gray-400">Sisa Saldo:</span>
                  <span className="font-extrabold text-emerald-400">{formatCurrency(remaining)}</span>
                </div>
                {withdrawn > 0 && (
                  <p className="text-[9px] dark:text-gray-500 text-gray-400 text-right">
                    (Ditarik: {formatCurrency(withdrawn)})
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Profit */}
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs dark:text-gray-500 text-gray-500 uppercase tracking-wider">Total Keuntungan Bersih</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs dark:text-gray-500 text-gray-500">Transaksi Terjual</p>
            <p className="text-lg font-bold dark:text-white text-gray-900">
              {filteredTransactions.filter((tx) => tx.status === 'Terjual').length} item
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ProfitChart filteredTransactions={filteredTransactions} />

      {/* Detail Table */}
      <div>
        <h3 className="text-sm font-semibold dark:text-white text-gray-900 mb-4">Detail Per Transaksi</h3>
        <ProfitTable filteredTransactions={filteredTransactions} />
      </div>

      {/* Modal Settings Bagi Hasil */}
      <ProfitSharingSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
