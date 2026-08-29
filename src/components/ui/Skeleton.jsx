export default function Skeleton({ className = '', variant = 'rectangular' }) {
  const baseClasses = 'animate-pulse dark:bg-white/5 bg-gray-200 rounded-xl';
  
  if (variant === 'circular') {
    return <div className={`${baseClasses} rounded-full ${className}`} />;
  }

  return <div className={`${baseClasses} ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
