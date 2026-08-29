import { STATUS_COLORS } from '../../constants/profitSharingConfig';

export default function Badge({ status, className = '' }) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {status}
    </span>
  );
}
