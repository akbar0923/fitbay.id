export default function EmptyState({ 
  title = 'Belum ada data',
  description = 'Mulai tambahkan data pertama Anda',
  icon,
  action 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-24 h-24 rounded-full dark:bg-white/5 bg-gray-100 flex items-center justify-center mb-6">
        {icon || (
          <svg className="w-12 h-12 dark:text-gray-600 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">{title}</h3>
      <p className="text-sm dark:text-gray-500 text-gray-500 text-center max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
