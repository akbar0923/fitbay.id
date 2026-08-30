import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { navItems } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import ProfileModal from '../profile/ProfileModal';

// 4 Menu Utama statis di Bottom Bar
const PRIMARY_PATHS = ['/', '/inventory', '/sales', '/profit-sharing'];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin, isAdmin, isLimitedAdmin } = useAuth();
  const { theme, toggleTheme } = useSales();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // 4 Menu Utama (Dashboard, Data Barang, Data Penjualan, Pembagian Hasil)
  const primaryNavItems = navItems.filter((item) => PRIMARY_PATHS.includes(item.path));

  // Menu Lainnya (Kelola Pemilik, Penarikan Saldo, Kelola User, Laporan)
  // Diproteksi sesuai role yang sedang login
  const moreNavItems = navItems
    .filter((item) => !PRIMARY_PATHS.includes(item.path))
    .filter((item) => {
      if (item.superAdminOnly) return isSuperAdmin;
      if (item.adminOnly) return isAdmin;
      return true;
    });

  // Cek apakah halaman yang sedang aktif termasuk dalam sub-menu "Lainnya"
  const isMoreActive = moreNavItems.some((item) => location.pathname === item.path);

  // Tutup bottom sheet saat rute berganti
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Lock scroll background saat bottom sheet dibuka
  useEffect(() => {
    if (isMoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMoreOpen]);

  const handleNavigate = (path) => {
    setIsMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* STATIS BOTTOM NAVIGATION BAR (MAKSIMAL 5 IKON, TIDAK BISA DIGESER)        */}
      {/* ========================================================================= */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 
          dark:bg-surface-300/95 bg-white/95 backdrop-blur-xl 
          dark:border-t dark:border-white/10 border-t border-gray-200/90
          shadow-[0_-4px_20px_rgba(0,0,0,0.08)]
          pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-5 w-full items-center px-1.5 py-1">
          {/* 4 Menu Utama */}
          {primaryNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all duration-200 w-full text-center
                  ${
                    isActive
                      ? 'dark:text-accent text-accent-dark dark:bg-accent/10 bg-accent/10 font-semibold'
                      : 'dark:text-gray-400 text-gray-500 hover:dark:text-gray-200 hover:text-gray-800'
                  }`}
              >
                <div className={`relative transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                  {isActive && (
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  )}
                </div>
                <span
                  className={`text-[10px] leading-tight truncate w-full text-center transition-all duration-200 ${
                    isActive ? 'opacity-100 font-semibold' : 'opacity-80 font-medium'
                  }`}
                >
                  {item.shortLabel || item.label}
                </span>
              </NavLink>
            );
          })}

          {/* Ikon ke-5: Lainnya (More) */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all duration-200 w-full text-center
              ${
                isMoreActive || isMoreOpen
                  ? 'dark:text-accent text-accent-dark dark:bg-accent/10 bg-accent/10 font-semibold'
                  : 'dark:text-gray-400 text-gray-500 hover:dark:text-gray-200 hover:text-gray-800'
              }`}
          >
            <div
              className={`relative transition-transform duration-200 ${
                isMoreActive || isMoreOpen ? 'scale-110' : ''
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
                />
              </svg>
              {isMoreActive && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              )}
            </div>
            <span
              className={`text-[10px] leading-tight truncate w-full text-center transition-all duration-200 ${
                isMoreActive || isMoreOpen ? 'opacity-100 font-semibold' : 'opacity-80 font-medium'
              }`}
            >
              Lainnya
            </span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* BOTTOM SHEET / MODAL MENU LAINNYA                                        */}
      {/* ========================================================================= */}
      {isMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop Blur */}
          <div
            onClick={() => setIsMoreOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
          />

          {/* Bottom Sheet Container */}
          <div
            className="relative w-full dark:bg-surface-200 bg-white rounded-t-3xl border-t dark:border-white/10 border-gray-200 shadow-2xl p-5 pb-[max(2rem,env(safe-area-inset-bottom))] animate-slide-up max-h-[85vh] overflow-y-auto"
          >
            {/* Pull Handle Indicator */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-4" />

            {/* Header Bottom Sheet */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-white/10 border-gray-100">
              <div>
                <h3 className="text-base font-bold dark:text-white text-gray-900">Menu Tambahan</h3>
                <p className="text-xs dark:text-gray-400 text-gray-500">
                  Fitur lengkap sesuai akses peran Anda ({isSuperAdmin ? 'Super Admin' : user?.role || 'Staff'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 hover:dark:bg-white/10 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Grid Menu Lainnya yang disaring berdasarkan Role */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {moreNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200
                      ${
                        isActive
                          ? 'dark:bg-accent/15 bg-accent/10 border-accent/40 dark:text-accent text-accent-dark font-semibold shadow-sm'
                          : 'dark:bg-surface-300/80 bg-gray-50 dark:border-white/5 border-gray-200/80 dark:text-gray-200 text-gray-700 hover:border-accent/30 dark:hover:bg-white/5 hover:bg-gray-100'
                      }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl ${
                        isActive
                          ? 'dark:bg-accent/20 bg-accent/20 text-accent'
                          : 'dark:bg-white/5 bg-white text-gray-600 dark:text-gray-300 shadow-sm'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate">{item.label}</p>
                      {item.badge ? (
                        <span className="inline-block mt-0.5 text-[9px] font-medium px-1.5 py-0.2 rounded-full uppercase bg-purple/15 text-purple border border-purple/20">
                          {item.badge}
                        </span>
                      ) : (
                        <span className="text-[10px] dark:text-gray-500 text-gray-400">Buka Menu</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pengaturan Akun & Aksi Cepat */}
            <div className="space-y-2 pt-3 border-t dark:border-white/10 border-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider dark:text-gray-500 text-gray-400 px-1">
                Akun & Aplikasi
              </p>

              {/* Profil & Edit Akun */}
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl dark:bg-surface-300/80 bg-gray-50 border dark:border-white/5 border-gray-200/80 hover:border-accent/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-sm
                        ${
                          isSuperAdmin
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isLimitedAdmin
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                    >
                      {user.username?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold dark:text-white text-gray-900 capitalize">
                        {user.name || user.username}
                      </p>
                      <p className="text-[10px] dark:text-gray-400 text-gray-500 font-mono">@{user.username}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-accent font-medium flex items-center gap-1">
                    <span>Ubah Profil</span>
                    <span>→</span>
                  </span>
                </button>
              )}

              {/* Dark / Light Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-3 rounded-2xl dark:bg-surface-300/80 bg-gray-50 border dark:border-white/5 border-gray-200/80 dark:text-gray-300 text-gray-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl dark:bg-white/5 bg-white shadow-sm text-gray-600 dark:text-gray-300">
                    {theme === 'dark' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                        />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Tema Tampilan</span>
                </div>
                <span className="text-xs font-semibold dark:text-accent text-accent-dark">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </button>

              {/* Tombol Logout */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 font-semibold text-xs hover:bg-red-500/20 transition-all mt-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                  />
                </svg>
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Profil & Password jika dibuka dari Menu Lainnya */}
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  );
}
