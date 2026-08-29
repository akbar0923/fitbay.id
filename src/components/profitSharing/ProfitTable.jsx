import { useMemo } from 'react';
import { PROFIT_SHARING_CONFIG } from '../../constants/profitSharingConfig';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { calculateTotalSharing } from '../../utils/calculateProfitSharing';

export default function ProfitTable({ filteredTransactions }) {
  const soldTransactions = useMemo(() => {
    return (filteredTransactions || []).filter((tx) => tx.status === 'Terjual');
  }, [filteredTransactions]);

  const totals = useMemo(() => {
    return calculateTotalSharing(filteredTransactions || []);
  }, [filteredTransactions]);

  if (soldTransactions.length === 0) {
    return (
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-8 text-center">
        <p className="dark:text-gray-500 text-gray-400 text-sm">Tidak ada transaksi terjual pada periode ini</p>
      </div>
    );
  }

  const shareKeys = Object.keys(PROFIT_SHARING_CONFIG);

  return (
    <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="dark:bg-white/[0.02] bg-gray-50 border-b dark:border-white/5 border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Barang</th>
              <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Keuntungan</th>
              {shareKeys.map((key) => (
                <th key={key} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: PROFIT_SHARING_CONFIG[key].color }}>
                  {PROFIT_SHARING_CONFIG[key].label.split(' ').pop()} ({PROFIT_SHARING_CONFIG[key].percentage}%)
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-white/5 divide-gray-100">
            {soldTransactions.map((tx) => (
              <tr key={tx.id} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm dark:text-gray-300 text-gray-700 whitespace-nowrap">{formatDate(tx.date)}</td>
                <td className="px-4 py-3 text-sm dark:text-white text-gray-900 font-medium max-w-[180px] truncate">{tx.itemName}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-400">{formatCurrency(tx.profit)}</td>
                {shareKeys.map((key) => (
                  <td key={key} className="px-3 py-3 text-sm text-right dark:text-gray-300 text-gray-700">
                    {formatCurrency(tx.profitSharing?.[key] || 0)}
                  </td>
                ))}
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="dark:bg-white/[0.03] bg-gray-50 font-semibold border-t-2 dark:border-white/10 border-gray-300">
              <td className="px-4 py-3 text-sm dark:text-white text-gray-900" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-sm text-right text-emerald-400">
                {formatCurrency(soldTransactions.reduce((sum, tx) => sum + tx.profit, 0))}
              </td>
              {shareKeys.map((key) => (
                <td key={key} className="px-3 py-3 text-sm text-right" style={{ color: PROFIT_SHARING_CONFIG[key].color }}>
                  {formatCurrency(totals[key] || 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y dark:divide-white/5 divide-gray-100">
        {soldTransactions.map((tx) => (
          <div key={tx.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold dark:text-white text-gray-900">{tx.itemName}</p>
                <p className="text-xs dark:text-gray-500 text-gray-400">{formatDate(tx.date)}</p>
              </div>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(tx.profit)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {shareKeys.map((key) => (
                <div key={key} className="text-center p-2 rounded-lg dark:bg-white/[0.03] bg-gray-50">
                  <p className="text-[10px] dark:text-gray-500 text-gray-400 truncate">{PROFIT_SHARING_CONFIG[key].label}</p>
                  <p className="text-xs font-medium dark:text-gray-300 text-gray-700">{formatCurrency(tx.profitSharing?.[key] || 0)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Totals */}
        <div className="p-4 dark:bg-white/[0.03] bg-gray-50">
          <p className="text-sm font-bold dark:text-white text-gray-900 mb-3">Total Pembagian</p>
          <div className="grid grid-cols-3 gap-2">
            {shareKeys.map((key) => (
              <div key={key} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${PROFIT_SHARING_CONFIG[key].color}10` }}>
                <p className="text-[10px] truncate" style={{ color: PROFIT_SHARING_CONFIG[key].color }}>{PROFIT_SHARING_CONFIG[key].label}</p>
                <p className="text-xs font-bold" style={{ color: PROFIT_SHARING_CONFIG[key].color }}>{formatCurrency(totals[key] || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
