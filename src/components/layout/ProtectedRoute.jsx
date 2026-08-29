import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  // Tampilkan loading spinner saat auth state masih loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-surface bg-gray-50">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm dark:text-gray-500 text-gray-400">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }

  // Jika belum login, redirect ke halaman login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Jika role dibatasi dan user tidak memenuhi role yang diizinkan
  const userRole = user?.role || 'staff';
  const isSuper = userRole === 'superadmin' || ['muhbar', 'nessa', 'akbar', 'nesa', 'admin'].includes(user?.username?.toLowerCase());
  
  const hasAccess = !allowedRoles || allowedRoles.length === 0 ||
    (isSuper) ||
    allowedRoles.includes(userRole);

  if (!hasAccess) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 animate-scale-in">
        <div className="max-w-md w-full text-center p-8 rounded-3xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-2">Akses Terbatas (403)</h2>
          <p className="text-sm dark:text-gray-400 text-gray-600 mb-6">
            Halaman ini bersifat terbatas untuk <span className="font-semibold text-accent">Super Admin</span>. Akun Anda ({user?.username}) berstatus sebagai <span className="font-semibold text-purple">{user?.title || user?.role}</span>.
          </p>
          <Link to="/">
            <Button className="w-full">
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Jika sudah login & role memenuhi, tampilkan konten
  return children;
}
