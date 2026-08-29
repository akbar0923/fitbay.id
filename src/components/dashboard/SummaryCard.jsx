import { formatCurrency } from '../../utils/formatCurrency';

export default function SummaryCard({ title, value, subtitle, icon, trend, color = 'accent', delay = 0 }) {
  const colorClasses = {
    accent: {
      iconBg: 'dark:bg-accent/10 bg-accent/10',
      iconText: 'text-accent',
      glow: 'glow-accent',
    },
    purple: {
      iconBg: 'dark:bg-purple/10 bg-purple/10',
      iconText: 'text-purple',
      glow: 'glow-purple',
    },
    blue: {
      iconBg: 'dark:bg-blue-500/10 bg-blue-500/10',
      iconText: 'text-blue-400',
      glow: '',
    },
    amber: {
      iconBg: 'dark:bg-amber-500/10 bg-amber-500/10',
      iconText: 'text-amber-400',
      glow: '',
    },
  };

  const colors = colorClasses[color] || colorClasses.accent;

  return (
    <div
      className={`dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 
        rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 
        hover:shadow-lg dark:hover:border-white/10 animate-slide-up ${colors.glow}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
          <span className={`text-lg ${colors.iconText}`}>{icon}</span>
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend >= 0 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : 'bg-red-500/10 text-red-400'
          }`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium dark:text-gray-500 text-gray-500 uppercase tracking-wider mb-1">
        {title}
      </p>
      <p className="text-2xl font-bold dark:text-white text-gray-900 tracking-tight">
        {typeof value === 'number' ? formatCurrency(value) : value}
      </p>
      {subtitle && (
        <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
