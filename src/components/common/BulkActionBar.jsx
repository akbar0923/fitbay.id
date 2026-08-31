import Button from '../ui/Button';

export default function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  deleteLabel = 'Hapus Terpilih',
  canDelete = false,
  actions = [], // Array of { label, onClick, icon, variant, disabled, hidden }
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce-in w-[95%] max-w-2xl">
      <div className="dark:bg-surface-100 bg-white dark:border dark:border-white/10 border border-gray-300 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl">
        {/* Counter & Clear Button */}
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-accent text-dark-800 font-extrabold text-sm flex items-center justify-center shadow-sm">
            {selectedCount}
          </span>
          <div>
            <p className="text-xs sm:text-sm font-bold dark:text-white text-gray-900 leading-tight">
              {selectedCount} Data Dipilih
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[11px] dark:text-gray-400 text-gray-500 hover:text-accent dark:hover:text-accent underline transition-colors"
            >
              Batalkan Pilihan
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {actions
            .filter((act) => !act.hidden)
            .map((act, idx) => (
              <Button
                key={idx}
                variant={act.variant || 'secondary'}
                size="sm"
                onClick={act.onClick}
                disabled={act.disabled}
                className="text-xs"
              >
                {act.icon && <span className="mr-1">{act.icon}</span>}
                {act.label}
              </Button>
            ))}

          {/* Tombol Hapus Massal (Diproteksi Role) */}
          {canDelete && onBulkDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={onBulkDelete}
              className="text-xs shadow-lg shadow-red-500/20"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              {deleteLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
