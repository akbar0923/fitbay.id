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
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || user.username || '');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordErrors({});
      setActiveTab('profile');
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
      errors.confirmPassword = 'Konfirmasi password tidak cocok';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !profileLoading && !passwordLoading && onClose()}
      title="Pengaturan Akun & Profil"
      size="sm"
    >
      <div className="space-y-4">
        {/* User Card Overview */}
        <div className="p-3.5 rounded-2xl dark:bg-surface-300/60 bg-gray-50 border dark:border-white/5 border-gray-200 flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm uppercase shrink-0
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

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <h3 className="font-bold text-sm dark:text-white text-gray-900 truncate">
                {user.name || user.username}
              </h3>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                  isSuperAdmin
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : isLimitedAdmin
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                }`}
              >
                {isSuperAdmin ? 'Super Admin' : isLimitedAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
            <p className="text-[11px] dark:text-gray-400 text-gray-500 font-mono truncate">
              @{user.username}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex p-1 rounded-xl dark:bg-surface-300 bg-gray-100 border dark:border-white/5 border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-accent text-white shadow-sm'
                : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
            }`}
          >
            <span>👤</span>
            <span>Edit Profil</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'password'
                ? 'bg-accent text-white shadow-sm'
                : 'dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900'
            }`}
          >
            <span>🔒</span>
            <span>Ganti Password</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EDIT PROFIL */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-3.5 animate-fade-in">
            <div>
              <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
                Username (Akun Login)
              </label>
              <input
                type="text"
                disabled
                value={`@${user.username}`}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs opacity-60 cursor-not-allowed
                  dark:bg-surface-300 bg-gray-100 dark:text-gray-300 text-gray-600 border dark:border-white/5 border-gray-200 font-mono"
              />
            </div>

            <Input
              label="Nama Lengkap *"
              placeholder="Contoh: Akbar / Siti Rahma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
              <Button type="button" variant="ghost" onClick={onClose} disabled={profileLoading}>
                Batal
              </Button>
              <Button type="submit" loading={profileLoading}>
                Simpan Profil
              </Button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GANTI PASSWORD */}
        {/* ========================================================================= */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3 animate-fade-in">
            <p className="text-[11px] dark:text-gray-400 text-gray-500">
              Masukkan password saat ini untuk memverifikasi akun sebelum membuat password baru.
            </p>

            {/* Current Password */}
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                label="Password Saat Ini *"
                placeholder="Masukkan password lama"
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
                className="absolute right-3 top-8 text-gray-400 hover:text-white text-xs p-1"
              >
                {showCurrentPassword ? '🙈' : '👁️'}
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
                className="absolute right-3 top-8 text-gray-400 hover:text-white text-xs p-1"
              >
                {showNewPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Confirm New Password */}
            <Input
              type={showNewPassword ? 'text' : 'password'}
              label="Konfirmasi Password Baru *"
              placeholder="Ulangi password baru"
              value={passwordForm.confirmPassword}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                if (passwordErrors.confirmPassword) {
                  setPasswordErrors({ ...passwordErrors, confirmPassword: null });
                }
              }}
              error={passwordErrors.confirmPassword}
            />

            <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
              <Button type="button" variant="ghost" onClick={onClose} disabled={passwordLoading}>
                Batal
              </Button>
              <Button type="submit" loading={passwordLoading}>
                Ganti Password
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
