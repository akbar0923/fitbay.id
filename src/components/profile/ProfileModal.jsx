import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateMyProfile, changeMyPassword, isSuperAdmin, isLimitedAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'

  // Profile Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || user.username || '');
      setEmail(user.email || '');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordErrors({});
      setActiveTab('profile');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama lengkap tidak boleh kosong');
      return;
    }

    setProfileLoading(true);
    try {
      await updateMyProfile({
        name: name.trim(),
        email: email.trim(),
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Password saat ini wajib diisi';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'Password baru wajib diisi';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password baru minimal 6 karakter';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Konfirmasi password baru tidak cocok';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordLoading(true);
    try {
      await changeMyPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return null;

  const roleLabel = isSuperAdmin ? 'Super Admin' : isLimitedAdmin ? 'Admin' : 'Staff';
  const roleBadgeStyle = isSuperAdmin
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : isLimitedAdmin
    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    : 'bg-purple-500/15 text-purple-400 border-purple-500/30';

  const avatarStyle = isSuperAdmin
    ? 'bg-gradient-to-br from-emerald-500/25 to-teal-500/10 text-emerald-400 border-emerald-500/30'
    : isLimitedAdmin
    ? 'bg-gradient-to-br from-blue-500/25 to-indigo-500/10 text-blue-400 border-blue-500/30'
    : 'bg-gradient-to-br from-purple-500/25 to-pink-500/10 text-purple-400 border-purple-500/30';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !profileLoading && !passwordLoading && onClose()}
      title="Pengaturan Akun & Profil"
      size="md"
    >
      <div className="space-y-6 pt-1">
        {/* User Card Overview — Clean, Soft & Spacious */}
        <div className="p-4 rounded-2xl dark:bg-white/[0.04] bg-gray-50/80 border dark:border-white/10 border-gray-200/80 flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl uppercase tracking-wider border shadow-sm shrink-0 ${avatarStyle}`}
          >
            {user.username?.charAt(0) || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-lg dark:text-white text-gray-900 leading-tight">
                {user.name || user.username}
              </h3>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${roleBadgeStyle}`}
              >
                {roleLabel}
              </span>
            </div>
            <p className="text-xs dark:text-gray-400 text-gray-500 font-mono mt-1 flex items-center gap-1.5">
              <span>@{user.username}</span>
              <span>·</span>
              <span className="opacity-75">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Tab Navigation — Modern Segmented Control */}
        <div className="grid grid-cols-2 p-1 rounded-xl dark:bg-surface-300 bg-gray-100 border dark:border-white/5 border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-accent text-white shadow-sm font-bold'
                : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span>Edit Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'password'
                ? 'bg-accent text-white shadow-sm font-bold'
                : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span>Ganti Password</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EDIT PROFIL */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium dark:text-gray-400 text-gray-500">
                Username Akun Login (Tetap)
              </label>
              <div className="px-4 py-2.5 rounded-xl text-sm opacity-60 dark:bg-white/[0.03] bg-gray-100 dark:text-gray-300 text-gray-700 border dark:border-white/10 border-gray-300 font-mono">
                @{user.username}
              </div>
            </div>

            <div className="space-y-1.5">
              <Input
                label="Nama Lengkap *"
                placeholder="Contoh: Akbar / Siti Rahma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-[11px] dark:text-gray-500 text-gray-400">
                Nama ini akan ditampilkan di pojok kiri bawah, pencatatan transaksi, dan riwayat sistem.
              </p>
            </div>

            <div className="space-y-1.5">
              <Input
                type="email"
                label="Email Aktif (Email Pribadi / Gmail)"
                placeholder="Contoh: namaanda@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-[11px] dark:text-gray-500 text-gray-400">
                Gunakan email asli (seperti Gmail/Yahoo) agar dapat menerima link reset password jika lupa sandi.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t dark:border-white/5 border-gray-200">
              <Button type="button" variant="ghost" onClick={onClose} disabled={profileLoading}>
                Batal
              </Button>
              <Button type="submit" loading={profileLoading} className="px-6 shadow-md shadow-accent/20">
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GANTI PASSWORD */}
        {/* ========================================================================= */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-xs dark:text-gray-300 text-gray-700 leading-relaxed">
              🔒 Masukkan password saat ini untuk memverifikasi akun sebelum membuat password baru.
            </div>

            {/* Current Password */}
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                label="Password Saat Ini *"
                placeholder="Masukkan password akun Anda saat ini"
                value={passwordForm.currentPassword}
                onChange={(e) => {
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                  if (passwordErrors.currentPassword) {
                    setPasswordErrors({ ...passwordErrors, currentPassword: null });
                  }
                }}
                error={passwordErrors.currentPassword}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3.5 top-9 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md bg-white/5"
              >
                {showCurrentPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>

            {/* New Password */}
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                label="Password Baru *"
                placeholder="Minimal 6 karakter"
                value={passwordForm.newPassword}
                onChange={(e) => {
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                  if (passwordErrors.newPassword) {
                    setPasswordErrors({ ...passwordErrors, newPassword: null });
                  }
                }}
                error={passwordErrors.newPassword}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-9 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md bg-white/5"
              >
                {showNewPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>

            {/* Confirm New Password */}
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                label="Konfirmasi Password Baru *"
                placeholder="Ulangi password baru di atas"
                value={passwordForm.confirmPassword}
                onChange={(e) => {
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                  if (passwordErrors.confirmPassword) {
                    setPasswordErrors({ ...passwordErrors, confirmPassword: null });
                  }
                }}
                error={passwordErrors.confirmPassword}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-9 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md bg-white/5"
              >
                {showConfirmPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t dark:border-white/5 border-gray-200">
              <Button type="button" variant="ghost" onClick={onClose} disabled={passwordLoading}>
                Batal
              </Button>
              <Button type="submit" loading={passwordLoading} className="px-6 shadow-md shadow-accent/20">
                Perbarui Password
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
