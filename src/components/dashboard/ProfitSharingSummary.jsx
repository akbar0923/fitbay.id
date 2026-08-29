import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateTotalSharing } from '../../utils/calculateProfitSharing';
import { useWithdrawals } from '../../context/WithdrawalContext';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function ProfitSharingSummary({ filteredTransactions }) {
  const { getTotalWithdrawn } = useWithdrawals();
  const { profitSharingConfig } = useSales();
  const { isSuperAdmin } = useAuth();

  const totals = useMemo(() => {
    return calculateTotalSharing(filteredTransactions || [], profitSharingConfig);
  }, [filteredTransactions, profitSharingConfig]);

  return (
    <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold dark:text-white text-gray-900">Pembagian Hasil & Sisa Saldo</h3>
          <p className="text-xs dark:text-gray-500 text-gray-400">Rincian hak keuntungan dan sisa saldo yang belum ditarik</p>
        </div>
        {isSuperAdmin ? (
          <Link
            to="/withdrawals"
            className="text-xs text-accent hover:text-accent-light font-medium flex items-center gap-1 transition-colors"
          >
            <span>Kelola Penarikan</span>
            <span>→</span>
          </Link>
        ) : (
          <Link
            to="/profit-sharing"
            className="text-xs text-accent hover:text-accent-light font-medium flex items-center gap-1 transition-colors"
          >
            <span>Lihat Rincian</span>
            <span>→</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(profitSharingConfig || {}).map(([key, config], index) => {
          const earned = totals[key] || 0;
          const withdrawn = getTotalWithdrawn(key);
          const remaining = Math.max(0, earned - withdrawn);

          return (
            <div
              key={key}
              className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 
                rounded-xl p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md
                animate-slide-up flex flex-col justify-between"
              style={{ animationDelay: `${400 + index * 80}ms` }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <span>{config.icon}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: config.color }}>
                    {config.percentage}%
                  </span>
                </div>

                <p className="text-xs dark:text-gray-400 text-gray-600 mb-0.5 truncate font-medium">{config.label}</p>
                <p className="text-xs font-semibold dark:text-gray-200 text-gray-800">
                  {formatCurrency(earned)}
                </p>
              </div>

              {/* Sisa Saldo Mini Indicator */}
              <div className="mt-2.5 pt-2 border-t dark:border-white/5 border-gray-100 flex items-center justify-between text-[10px]">
                <span className="dark:text-gray-500 text-gray-400">Sisa:</span>
                <span className="font-bold text-emerald-400">
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
