export default function Input({
  label,
  error,
  type = 'text',
  className = '',
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
          {label}
        </label>
      )}
      <input
        type={type}
        className={`w-full px-4 py-2.5 rounded-xl text-sm
          dark:bg-white/5 bg-gray-100 
          dark:text-white text-gray-900
          dark:border-white/10 border-gray-300 border
          dark:placeholder-gray-500 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
          transition-all duration-200
          ${error ? 'border-red-500 focus:ring-red-500/50' : ''}
          ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
          {label}
        </label>
      )}
      <select
        className={`w-full px-4 py-2.5 rounded-xl text-sm
          dark:bg-surface-200 bg-white 
          dark:text-white text-gray-900
          dark:border-white/10 border-gray-300 border
          focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
          transition-all duration-200 appearance-none cursor-pointer
          bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke-width%3D%221.5%22%20stroke%3D%22%239ca3af%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m19.5%208.25-7.5%207.5-7.5-7.5%22%20%2F%3E%3C%2Fsvg%3E')]
          bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10
          ${error ? 'border-red-500' : ''}
          ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
