import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PROFIT_SHARING_CONFIG } from '../../constants/profitSharingConfig';
import { calculateTotalSharing } from '../../utils/calculateProfitSharing';
import { formatCurrency } from '../../utils/formatCurrency';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="dark:bg-surface-300 bg-white dark:border-white/10 border-gray-200 border rounded-xl p-3 shadow-xl">
        <p className="text-sm font-semibold dark:text-white text-gray-900">{data.name}</p>
        <p className="text-xs dark:text-gray-400 text-gray-500">{data.percentage}%</p>
        <p className="text-sm font-bold" style={{ color: data.fill }}>{formatCurrency(data.value)}</p>
      </div>
    );
  }
  return null;
};

export default function ProfitChart({ filteredTransactions }) {
  const chartData = useMemo(() => {
    const totals = calculateTotalSharing(filteredTransactions || []);
    
    return Object.entries(PROFIT_SHARING_CONFIG).map(([key, config]) => ({
      name: config.label,
      value: totals[key] || 0,
      percentage: config.percentage,
      fill: config.color,
    }));
  }, [filteredTransactions]);

  const totalProfit = chartData.reduce((sum, d) => sum + d.value, 0);
  const hasData = totalProfit > 0;

  return (
    <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold dark:text-white text-gray-900 mb-4">Proporsi Pembagian Hasil</h3>

      {!hasData ? (
        <div className="h-64 flex items-center justify-center dark:text-gray-600 text-gray-300 text-sm">
          Belum ada data keuntungan
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Donut Chart */}
          <div className="w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="text-center -mt-[170px] mb-[120px] pointer-events-none">
              <p className="text-xs dark:text-gray-500 text-gray-400">Total</p>
              <p className="text-lg font-bold dark:text-white text-gray-900">{formatCurrency(totalProfit)}</p>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full lg:w-1/2 space-y-3">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 rounded-xl dark:bg-white/[0.03] bg-gray-50 transition-all hover:scale-[1.01]">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <div>
                    <p className="text-sm dark:text-white text-gray-900 font-medium">{item.name}</p>
                    <p className="text-xs dark:text-gray-500 text-gray-400">{item.percentage}%</p>
                  </div>
                </div>
                <p className="text-sm font-bold" style={{ color: item.fill }}>
                  {formatCurrency(item.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
