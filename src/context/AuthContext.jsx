import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { getUserProfile } from '../firebase/userService';
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
            email: firebaseUser.email,
            username: username,
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
            role: isAdminUser ? 'admin' : 'staff',
            title: isAdminUser ? (clean === 'muhbar' ? 'Founder & Admin' : clean === 'nessa' ? 'Co-Founder & Admin' : 'Super Admin') : 'Staff & Host Live',
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
   * Login dengan username dan password
   */
  const login = async (username, password) => {
    try {
      const email = usernameToEmail(username);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const cleanUser = emailToUsername(result.user.email);
      
      // Verifikasi status akun aktif/nonaktif
      const profile = await getUserProfile(result.user.uid, cleanUser, result.user.email);
      if (profile.status === 'inactive') {
        await signOut(auth);
        throw new Error('Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi Admin Fitbay.id.');
      }

      toast.success(`Selamat datang, ${profile.name || cleanUser}!`);
      return result.user;
    } catch (error) {
      let message = 'Terjadi kesalahan saat login';
      
      if (error.message && error.message.includes('dinonaktifkan')) {
        message = error.message;
      } else {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            message = 'Username atau password salah';
            break;
          case 'auth/too-many-requests':
            message = 'Terlalu banyak percobaan login. Coba lagi nanti.';
            break;
          case 'auth/network-request-failed':
            message = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
            break;
          case 'auth/invalid-api-key':
            message = 'Konfigurasi Firebase tidak valid. Hubungi admin.';
            break;
          default:
            message = `Login gagal: ${error.message}`;
        }
      }
      
      toast.error(message);
      throw new Error(message);
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
