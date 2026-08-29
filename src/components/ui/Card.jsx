export default function Card({ children, className = '', glass = false, hover = false, ...props }) {
  return (
    <div
      className={`rounded-2xl transition-all duration-300
        ${glass
          ? 'dark:glass-card glass-card-light'
          : 'dark:bg-surface-200 bg-white dark:border dark:border-white/5 border border-gray-200 shadow-sm'
        }
        ${hover ? 'hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-accent/5 cursor-pointer' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 border-b dark:border-white/5 border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}
