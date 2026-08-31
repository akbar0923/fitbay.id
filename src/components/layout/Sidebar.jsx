import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import ProfileModal from '../profile/ProfileModal';
import logoImg from '../../assets/logo.png';

const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
  {
    path: '/inventory',
    label: 'Data Barang',
    shortLabel: 'Barang',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
  {
    path: '/my-items',
    label: 'Barang Saya',
    shortLabel: 'Barang Saya',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    path: '/sales',
    label: 'Data Penjualan',
    shortLabel: 'Penjualan',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
  },
  {
    path: '/owners',
    label: 'Kelola Pemilik',
    shortLabel: 'Pemilik',
    adminOnly: true,
    badge: 'Admin',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    path: '/profit-sharing',
    label: 'Pembagian Hasil',
    shortLabel: 'Bagi Hasil',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
      </svg>
    ),
  },
  {
    path: '/withdrawals',
    label: 'Penarikan Saldo',
    shortLabel: 'Penarikan',
    superAdminOnly: true,
    badge: 'Super Admin',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0 0a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 20.25 14.25V6H19.5a.75.75 0 0 1-.75-.75V4.5m-15 0a2.25 2.25 0 0 1 2.25-2.25h10.5A2.25 2.25 0 0 1 18.75 4.5m-15 0h15M12 9.75v3m0 0-1.5-1.5m1.5 1.5 1.5-1.5" />
      </svg>
    ),
  },
  {
    path: '/users',
    label: 'Kelola User',
    shortLabel: 'User',
    superAdminOnly: true,
    badge: 'Super Admin',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    path: '/reports',
    label: 'Laporan',
    shortLabel: 'Laporan',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useSales();
  const { user, logout, isSuperAdmin, isAdmin, isLimitedAdmin } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const location = useLocation();

  const visibleNavItems = navItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.adminOnly) return isAdmin;
    return true;
  });

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 z-40 
      dark:bg-surface-300/80 bg-white/80 backdrop-blur-xl 
      dark:border-r dark:border-white/5 border-r border-gray-200
      transition-all duration-300">
      
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b dark:border-white/5 border-gray-200">
        <img
          src={logoImg}
          alt="Fitbay.id"
          className="w-10 h-10 object-contain rounded-xl bg-[#F5F3EF] p-1 shadow-sm"
        />
        <div>
          <h1 className="text-base font-bold dark:text-white text-gray-900 tracking-tight">Fitbay.id</h1>
          <p className="text-[11px] dark:text-gray-400 text-gray-500 font-medium">Finance & Stock Tracker</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'dark:bg-accent/15 bg-accent/10 dark:text-accent text-accent-dark font-semibold shadow-sm'
                  : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/5 hover:bg-gray-100'
                }`}
            >
              <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase
                  bg-purple/15 text-purple border border-purple/20">
                  {item.badge}
                </span>
              )}
              {isActive && !item.badge && (
                <div className="ml-auto w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info, Theme Toggle & Logout */}
      <div className="px-4 py-4 border-t dark:border-white/5 border-gray-200 space-y-2">
        {/* Logged in User Profile with Role (Clickable to Edit Profile & Password) */}
        {user && (
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl dark:bg-white/[0.03] bg-gray-50 border dark:border-white/5 border-gray-200 hover:border-accent/40 dark:hover:bg-white/[0.07] hover:bg-gray-100/80 transition-all duration-200 group cursor-pointer"
            title="Klik untuk Edit Profil & Ganti Password"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase transition-transform group-hover:scale-105
              ${isSuperAdmin 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : isLimitedAdmin 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}
            >
              {user.username?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold dark:text-white text-gray-900 truncate capitalize group-hover:text-accent transition-colors">
                  {user.name || user.username}
                </p>
              </div>
              <p className="text-[11px] dark:text-gray-400 text-gray-500 truncate font-mono">
                @{user.username}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase
                ${isSuperAdmin 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                  : isLimitedAdmin 
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' 
                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'}`}
              >
                {isSuperAdmin ? 'Super Admin' : user.role}
              </span>
              <span className="text-[9px] text-accent opacity-75 group-hover:opacity-100 flex items-center gap-0.5 font-medium">
                <span>⚙️</span>
                <span>Ubah</span>
              </span>
            </div>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm 
            dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 
            dark:hover:bg-white/5 hover:bg-gray-100 transition-all duration-200"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm 
            text-red-400 hover:text-red-300
            hover:bg-red-500/10 transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          <span>Logout</span>
        </button>

        <div className="text-center pt-1">
          <p className="text-[10px] dark:text-gray-600 text-gray-400">© 2026 Fitbay.id</p>
        </div>
      </div>

      {/* Profile & Password Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </aside>
  );
}

export { navItems };
