import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';

const pageTitles = {
  '/': 'Dashboard',
  '/sales': 'Data Penjualan',
  '/owners': 'Kelola Pemilik Barang',
  '/profit-sharing': 'Pembagian Hasil',
  '/withdrawals': 'Penarikan Saldo',
  '/reports': 'Laporan',
};

export default function Layout({ children }) {
  const location = useLocation();
  const { theme, toggleTheme } = useSales();
  const { logout } = useAuth();
  const pageTitle = pageTitles[location.pathname] || 'Fitbay.id';

  return (
    <div className="min-h-screen dark:bg-surface bg-gray-50 transition-colors duration-300">
      <Sidebar />
      
      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 dark:bg-surface/80 bg-white/80 backdrop-blur-xl 
          dark:border-b dark:border-white/5 border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Fitbay.id"
                className="w-8 h-8 object-contain rounded-lg bg-[#F5F3EF] p-0.5 shadow-sm"
              />
              <div>
                <h1 className="text-base font-bold dark:text-white text-gray-900">{pageTitle}</h1>
                <p className="text-[10px] dark:text-gray-500 text-gray-400">Fitbay.id</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 
                  dark:hover:bg-white/10 hover:bg-gray-200 transition-all duration-200"
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
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-xl text-red-400 dark:hover:bg-red-500/10 hover:bg-red-50 transition-all duration-200"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8 animate-fade-in">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
