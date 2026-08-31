import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import logoImg from '../assets/logo.png';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Ambil oobCode dari HashRouter params maupun window.location.search
  const globalParams = new URLSearchParams(window.location.search);
  const oobCode =
    searchParams.get('oobCode') ||
    searchParams.get('code') ||
    globalParams.get('oobCode') ||
    globalParams.get('code');
  const mode = searchParams.get('mode') || globalParams.get('mode');

  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState('');
  const [validCode, setValidCode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!oobCode) {
      setVerifying(false);
      setValidCode(false);
      setErrorMessage('Tautan reset password tidak valid atau tidak memiliki kode keamanan.');
      return;
    }

    // Verifikasi validitas kode reset dari Firebase
    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setValidCode(true);
        setVerifying(false);
      })
      .catch((error) => {
        console.error('Error verifying reset code:', error);
        setValidCode(false);
        setVerifying(false);
        if (error.code === 'auth/expired-action-code') {
          setErrorMessage('Tautan reset password sudah kedaluwarsa. Silakan minta tautan baru dari admin.');
        } else if (error.code === 'auth/invalid-action-code') {
          setErrorMessage('Tautan reset password ini sudah pernah digunakan atau tidak valid.');
        } else {
          setErrorMessage('Gagal memverifikasi tautan reset password. Silakan coba lagi.');
        }
      });
  }, [oobCode]);

  const handleResetSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error('Silakan masukkan password baru');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setIsSuccess(true);
      toast.success('Password berhasil diatur ulang!');
    } catch (err) {
      console.error('Error confirming password reset:', err);
      toast.error(err.message || 'Gagal mengatur ulang password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 dark:bg-surface bg-gray-50 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-scale-in">
        <div className="dark:bg-surface-200/90 bg-white/95 backdrop-blur-xl dark:border dark:border-white/10 border border-gray-200 rounded-3xl shadow-2xl p-8">
          
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <img
              src={logoImg}
              alt="Fitbay.id"
              className="w-16 h-16 object-contain rounded-2xl mx-auto mb-3 shadow-lg bg-[#F5F3EF] p-1 ring-2 ring-accent/30"
            />
            <h1 className="text-2xl font-bold dark:text-white text-gray-900 tracking-tight">
              Fitbay.id
            </h1>
            <p className="text-xs dark:text-gray-400 text-gray-500 mt-1">
              Atur Ulang Password Akun
            </p>
          </div>

          {/* 1. Loading State */}
          {verifying ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm dark:text-gray-300 text-gray-600">Memverifikasi tautan keamanan...</p>
            </div>
          ) : isSuccess ? (
            /* 2. Success State */
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/10">
                ✓
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold dark:text-white text-gray-900">
                  Password Berhasil Diubah!
                </h3>
                <p className="text-xs dark:text-gray-400 text-gray-600">
                  Password akun Anda untuk <span className="font-semibold text-accent">{email}</span> telah diperbarui. Silakan login dengan password baru Anda.
                </p>
              </div>

              <Button
                onClick={() => navigate('/login')}
                className="w-full shadow-lg shadow-accent/25 py-3"
              >
                Masuk ke Fitbay.id
              </Button>
            </div>
          ) : !validCode ? (
            /* 3. Error / Invalid Code State */
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center text-3xl mx-auto">
                ⚠️
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold dark:text-white text-gray-900">
                  Tautan Tidak Berlaku
                </h3>
                <p className="text-xs text-red-400 leading-relaxed px-2">
                  {errorMessage}
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl text-xs font-semibold dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-700 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  Kembali ke Halaman Login
                </Link>
              </div>
            </div>
          ) : (
            /* 4. Form Reset Password */
            <form onSubmit={handleResetSubmit} className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl dark:bg-accent/10 bg-accent/5 border border-accent/20 flex items-center gap-3 text-xs">
                <span className="text-accent text-lg">📧</span>
                <div className="min-w-0">
                  <p className="dark:text-gray-400 text-gray-500 text-[11px]">Akun yang direset:</p>
                  <p className="font-semibold text-accent truncate">{email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    label="Password Baru *"
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-xs text-gray-400 hover:text-accent p-1"
                  >
                    {showPassword ? 'Sembunyikan' : 'Lihat'}
                  </button>
                </div>

                <Input
                  type={showPassword ? 'text' : 'password'}
                  label="Konfirmasi Password Baru *"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="pt-3 space-y-2">
                <Button
                  type="submit"
                  loading={submitting}
                  className="w-full shadow-lg shadow-accent/25 py-3 font-bold"
                >
                  Simpan Password Baru
                </Button>
                <Link
                  to="/login"
                  className="block text-center text-xs dark:text-gray-400 text-gray-500 hover:text-accent pt-1 transition-colors"
                >
                  Batal dan kembali ke Login
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
