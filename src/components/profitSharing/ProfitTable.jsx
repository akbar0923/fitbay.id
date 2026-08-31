import { useMemo } from 'react';
import { useSales } from '../../context/SalesContext';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { calculateTotalSharing } from '../../utils/calculateProfitSharing';

export default function ProfitTable({ filteredTransactions }) {
  const { profitSharingConfig } = useSales();

  const soldTransactions = useMemo(() => {
    return (filteredTransactions || []).filter((tx) => tx.status === 'Terjual');
  }, [filteredTransactions]);

  const totals = useMemo(() => {
    return calculateTotalSharing(filteredTransactions || [], profitSharingConfig);
  }, [filteredTransactions, profitSharingConfig]);

  if (soldTransactions.length === 0) {
    return (
      <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-8 text-center">
        <p className="dark:text-gray-500 text-gray-400 text-sm">Tidak ada transaksi terjual pada periode ini</p>
      </div>
    );
  }

  const shareKeys = Object.keys(profitSharingConfig || {});

  return (
    <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="dark:bg-white/[0.02] bg-gray-50 border-b dark:border-white/5 border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Barang & Pemilik</th>
              <th className="px-3 py-3 text-center text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Skema</th>
              <th className="px-4 py-3 text-right text-xs font-semibold dark:text-gray-400 text-gray-500 uppercase tracking-wider">Keuntungan</th>
              {shareKeys.map((key) => {
                const cfg = profitSharingConfig[key];
                return (
                  <th key={key} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                    {cfg.label.split(' ').pop()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-white/5 divide-gray-100">
            {soldTransactions.map((tx) => {
              const customScheme = tx.skemaCustom || tx.ownerCustomScheme;
              const isCustom = Boolean(customScheme);

              return (
                <tr key={tx.id} className="dark:hover:bg-white/[0.02] hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm dark:text-gray-300 text-gray-700 whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-[180px]">
                    <div className="truncate font-medium dark:text-white text-gray-900">{tx.itemName}</div>
                    <div className="text-[11px] text-accent truncate">Pemilik: {tx.ownerName || '-'}</div>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    {isCustom ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20">
                        ⚡ {customScheme.pemilikBarang}% / {customScheme.operational}% Ops
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        🌐 Standar ({profitSharingConfig?.pemilikBarang?.percentage || 70}%)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-400 whitespace-nowrap">
                    {formatCurrency(tx.profit)}
                  </td>
                  {shareKeys.map((key) => (
                    <td key={key} className="px-3 py-3 text-sm text-right dark:text-gray-300 text-gray-700 whitespace-nowrap font-medium">
                      {formatCurrency(tx.profitSharing?.[key] || 0)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr className="dark:bg-white/[0.03] bg-gray-50 font-semibold border-t-2 dark:border-white/10 border-gray-300">
              <td className="px-4 py-3 text-sm dark:text-white text-gray-900 font-bold" colSpan={3}>
                Total Akumulasi Pembagian
              </td>
              <td className="px-4 py-3 text-sm text-right text-emerald-400 font-extrabold whitespace-nowrap">
                {formatCurrency(soldTransactions.reduce((sum, tx) => sum + (Number(tx.profit) || 0), 0))}
              </td>
              {shareKeys.map((key) => (
                <td key={key} className="px-3 py-3 text-sm text-right font-extrabold whitespace-nowrap" style={{ color: profitSharingConfig[key].color }}>
                  {formatCurrency(totals[key] || 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y dark:divide-white/5 divide-gray-100">
        {soldTransactions.map((tx) => {
          const customScheme = tx.skemaCustom || tx.ownerCustomScheme;
          const isCustom = Boolean(customScheme);

          return (
            <div key={tx.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold dark:text-white text-gray-900">{tx.itemName}</p>
                  <p className="text-xs text-accent">Pemilik: {tx.ownerName || '-'} · {formatDate(tx.date)}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400 block">{formatCurrency(tx.profit)}</span>
                  {isCustom ? (
                    <span className="text-[10px] font-bold text-purple-400">⚡ {customScheme.pemilikBarang}% / {customScheme.operational}%</span>
                  ) : (
                    <span className="text-[10px] text-blue-400">🌐 Standar</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {shareKeys.map((key) => (
                  <div key={key} className="text-center p-2 rounded-lg dark:bg-white/[0.03] bg-gray-50">
                    <p className="text-[10px] dark:text-gray-500 text-gray-400 truncate">{profitSharingConfig[key].label}</p>
                    <p className="text-xs font-semibold dark:text-gray-200 text-gray-800">{formatCurrency(tx.profitSharing?.[key] || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Totals Mobile */}
        <div className="p-4 dark:bg-white/[0.03] bg-gray-50">
          <p className="text-sm font-bold dark:text-white text-gray-900 mb-3">Total Akumulasi Pembagian</p>
          <div className="grid grid-cols-3 gap-2">
            {shareKeys.map((key) => (
              <div key={key} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${profitSharingConfig[key].color}10` }}>
                <p className="text-[10px] truncate" style={{ color: profitSharingConfig[key].color }}>{profitSharingConfig[key].label}</p>
                <p className="text-xs font-bold" style={{ color: profitSharingConfig[key].color }}>{formatCurrency(totals[key] || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
