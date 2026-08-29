import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { useSales } from '../../context/SalesContext';
import { formatCurrency, formatCompact } from '../../utils/formatCurrency';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="dark:bg-surface-300 bg-white dark:border-white/10 border-gray-200 border rounded-xl p-3 shadow-xl">
        <p className="text-xs dark:text-gray-400 text-gray-500 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function SalesChart({ filteredTransactions }) {
  const [chartType, setChartType] = useState('area');
  const [period, setPeriod] = useState('daily');

  const chartData = useMemo(() => {
    const txs = filteredTransactions || [];
    const soldTxs = txs.filter((tx) => tx.status === 'Terjual');

    if (soldTxs.length === 0) return [];

    const grouped = {};

    soldTxs.forEach((tx) => {
      let key;
      const date = new Date(tx.date);

      if (period === 'daily') {
        key = tx.date;
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = { date: key, pendapatan: 0, keuntungan: 0, count: 0 };
      }
      grouped[key].pendapatan += tx.sellingPrice;
      grouped[key].keuntungan += tx.profit;
      grouped[key].count += 1;
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, period]);

  const formatXAxis = (dateStr) => {
    if (!dateStr) return '';
    if (period === 'monthly') {
      const [y, m] = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
    }
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 animate-slide-up"
         style={{ animationDelay: '200ms' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="text-sm font-semibold dark:text-white text-gray-900">Tren Penjualan</h3>
        <div className="flex gap-2">
          <div className="flex dark:bg-white/5 bg-gray-100 rounded-lg p-0.5">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                  ${period === p
                    ? 'bg-accent text-white shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
                  }`}
              >
                {p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulanan'}
              </button>
            ))}
          </div>
          <div className="flex dark:bg-white/5 bg-gray-100 rounded-lg p-0.5">
            {['area', 'bar'].map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                  ${chartType === t
                    ? 'bg-purple text-white shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
                  }`}
              >
                {t === 'area' ? 'Area' : 'Bar'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center dark:text-gray-600 text-gray-300 text-sm">
          Belum ada data penjualan
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'area' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPendapatan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorKeuntungan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pendapatan" name="Pendapatan" stroke="#10B981" strokeWidth={2} fill="url(#colorPendapatan)" />
              <Area type="monotone" dataKey="keuntungan" name="Keuntungan" stroke="#8B5CF6" strokeWidth={2} fill="url(#colorKeuntungan)" />
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pendapatan" name="Pendapatan" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="keuntungan" name="Keuntungan" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-xs dark:text-gray-400 text-gray-500">Pendapatan</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple" />
          <span className="text-xs dark:text-gray-400 text-gray-500">Keuntungan</span>
        </div>
      </div>
    </div>
  );
}
