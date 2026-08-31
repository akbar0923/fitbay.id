import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateEmail,
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { getUserProfile, updateUserProfileData } from '../firebase/userService';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// Domain internal untuk mapping username → email (default fitbay.id)
const EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'fitbay.id';

/**
 * Konversi username ke format email
 * contoh:
 *  "muhbar" → "muhbar@fitbay.id"
 *  "admin" → "admin@admin.id"
 *  "andin" → "andin@fitbay.id"
 */
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  if (clean === 'admin') return 'admin@admin.id';
  return `${clean}@${EMAIL_DOMAIN}`;
}

/**
 * Ekstrak username dari email internal
 * contoh: "akbar@fitbay.internal" → "akbar"
 */
function emailToUsername(email) {
  if (!email) return '';
  return email.split('@')[0];
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes and fetch role profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const username = emailToUsername(firebaseUser.email);
        try {
          // Ambil profil & role dari Firestore
          const profile = await getUserProfile(firebaseUser.uid, username, firebaseUser.email);
          
          // Cek apakah akun dinonaktifkan oleh Super Admin
          if (profile.status === 'inactive') {
            await signOut(auth);
            setUser(null);
            setLoading(false);
            toast.error('Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi Admin Fitbay.id.');
            return;
          }

          setUser({
            uid: firebaseUser.uid,
            email: profile.email || firebaseUser.email,
            username: profile.username || username,
            name: profile.name || username,
            role: profile.role || 'staff',
            title: profile.title || 'Team Member',
            status: profile.status || 'active',
          });
        } catch (err) {
          console.error('Error fetching user profile:', err);
          const clean = username.toLowerCase();
          const isAdminUser = ['muhbar', 'nessa', 'admin', 'akbar', 'nesa'].includes(clean);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: username,
            name: clean === 'muhbar' ? 'Akbar' : clean === 'nessa' ? 'Nessa' : clean === 'admin' ? 'Admin' : username,
            role: isAdminUser ? 'superadmin' : 'staff',
            title: isAdminUser ? 'Super Admin' : 'Staff & Host Live',
            status: 'active',
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login dengan username dan password (dengan domain fallback otomatis)
   */
  const login = async (username, password) => {
    const rawClean = (username || '').trim().toLowerCase();
    if (!rawClean) {
      toast.error('Silakan masukkan username');
      throw new Error('Username kosong');
    }

    // Daftar kemungkinan format email yang terdaftar di Firebase Auth
    let candidates = [];
    if (rawClean.includes('@')) {
      candidates = [rawClean];
    } else {
      candidates = [
        `${rawClean}@${EMAIL_DOMAIN}`,
        `${rawClean}@fitbay.id`,
        `${rawClean}@fitbay.internal`,
        rawClean === 'admin' ? 'admin@admin.id' : null,
      ].filter(Boolean);
      // Hapus duplikat
      candidates = [...new Set(candidates)];
    }

    let authResult = null;
    let lastError = null;

    for (const email of candidates) {
      try {
        authResult = await signInWithEmailAndPassword(auth, email, password);
        if (authResult?.user) break;
      } catch (err) {
        lastError = err;
        // Jika password salah pada user yang ditemukan, tidak perlu coba domain lain
        if (err.code === 'auth/wrong-password') break;
      }
    }

    if (!authResult || !authResult.user) {
      let message = 'Username atau password salah';
      if (lastError?.message && lastError.message.includes('dinonaktifkan')) {
        message = lastError.message;
      } else if (lastError?.code === 'auth/too-many-requests') {
        message = 'Terlalu banyak percobaan login. Coba lagi nanti.';
      } else if (lastError?.code === 'auth/network-request-failed') {
        message = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
      } else if (lastError?.code === 'auth/invalid-api-key') {
        message = 'Konfigurasi Firebase tidak valid. Hubungi admin.';
      }
      
      toast.error(message);
      throw new Error(message);
    }

    try {
      const cleanUser = emailToUsername(authResult.user.email);
      // Verifikasi status akun aktif/nonaktif
      const profile = await getUserProfile(authResult.user.uid, cleanUser, authResult.user.email);
      if (profile.status === 'inactive') {
        await signOut(auth);
        const errMsg = 'Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi Admin Fitbay.id.';
        toast.error(errMsg);
        throw new Error(errMsg);
      }

      toast.success(`Selamat datang, ${profile.name || cleanUser}!`);
      return authResult.user;
    } catch (error) {
      if (error.message && error.message.includes('dinonaktifkan')) {
        throw error;
      }
      return authResult.user;
    }
  };

  /**
   * Mengupdate profil mandiri (Nama Lengkap, Jabatan, dan Email Asli)
   */
  const updateMyProfile = async ({ name, title, email }) => {
    if (!user?.uid) throw new Error('User belum login');
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;
    const updatePayload = {
      name: name.trim(),
      ...(title ? { title: title.trim() } : {}),
      ...(cleanEmail ? { email: cleanEmail } : {}),
    };

    // 1. Simpan ke Firestore Database
    await updateUserProfileData(user.uid, updatePayload);
    setUser((prev) => (prev ? { ...prev, ...updatePayload } : prev));

    // 2. Sinkronkan otomatis ke Firebase Authentication Console
    if (auth.currentUser && cleanEmail && auth.currentUser.email !== cleanEmail) {
      try {
        await updateEmail(auth.currentUser, cleanEmail);
      } catch (authErr) {
        console.warn('Firebase Auth updateEmail notice:', authErr);
      }
    }

    toast.success('Profil Anda berhasil diperbarui!');
  };

  /**
   * Mengganti password akun sendiri dengan verifikasi password lama
   */
  const changeMyPassword = async ({ currentPassword, newPassword }) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');
    }

    if (newPassword.length < 6) {
      throw new Error('Password baru minimal harus 6 karakter.');
    }

    try {
      // 1. Re-autentikasi dengan password lama
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update ke password baru
      await updatePassword(currentUser, newPassword);
      toast.success('Password akun Anda berhasil diperbarui!');
    } catch (err) {
      let errorMsg = 'Gagal mengganti password.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Password saat ini yang Anda masukkan salah.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password baru terlalu lemah. Gunakan minimal 6 karakter.';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMsg = 'Demi keamanan, silakan logout dan login ulang sebelum mengganti password.';
      }
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Berhasil logout');
    } catch (error) {
      toast.error('Gagal logout. Coba lagi.');
      throw error;
    }
  };

  const isSuperAdmin =
    user?.role === 'superadmin' ||
    (!user?.role && ['muhbar', 'akbar'].includes(user?.username?.toLowerCase()));

  const isAdmin =
    isSuperAdmin ||
    user?.role === 'admin';

  const isLimitedAdmin = user?.role === 'admin' && !isSuperAdmin;

  const value = {
    user,
    loading,
    login,
    logout,
    updateMyProfile,
    changeMyPassword,
    isAuthenticated: !!user,
    isSuperAdmin,
    isAdmin,
    isLimitedAdmin,
    isStaff: user?.role === 'staff',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
