import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SalesProvider } from './context/SalesContext';
import { OwnerProvider } from './context/OwnerContext';
import { InventoryProvider } from './context/InventoryContext';
import { WithdrawalProvider } from './context/WithdrawalContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OwnerPortal from './pages/OwnerPortal';
import LinksPage from './pages/LinksPage';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import MyItems from './pages/MyItems';
import SalesData from './pages/SalesData';
import Owners from './pages/Owners';
import ProfitSharing from './pages/ProfitSharing';
import Withdrawals from './pages/Withdrawals';
import Users from './pages/Users';
import Reports from './pages/Reports';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PwaInstallPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1E1E1E',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '14px',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#1E1E1E',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#1E1E1E',
              },
            },
          }}
        />
        <Routes>
          {/* Login — publik tanpa layout */}
          <Route path="/login" element={<Login />} />

          {/* Reset Password Kustom Fitbay.id */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/action" element={<ResetPasswordPage />} />

          {/* Portal Cek Barang & Saldo Khusus Penitip (Publik) */}
          <Route path="/cek-barang" element={<OwnerPortal />} />
          <Route path="/portal-pemilik" element={<OwnerPortal />} />

          {/* Halaman Linktree & WhatsApp Fitbay.id (Publik untuk Umum / Bio Instagram & TikTok) */}
          <Route path="/links" element={<LinksPage />} />
          <Route path="/linktree" element={<LinksPage />} />
          <Route path="/bio" element={<LinksPage />} />
          <Route path="/wa" element={<LinksPage />} />
          <Route path="/whatsapp" element={<LinksPage />} />

          {/* Protected App Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <SalesProvider>
                  <OwnerProvider>
                    <InventoryProvider>
                      <WithdrawalProvider>
                        <Layout>
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/inventory" element={<Inventory />} />
                            <Route path="/my-items" element={<MyItems />} />
                            <Route path="/sales" element={<SalesData />} />
                            
                            {/* Halaman Kelola Pemilik (Super Admin & Admin Operasional) */}
                            <Route
                              path="/owners"
                              element={
                                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                                  <Owners />
                                </ProtectedRoute>
                              }
                            />

                            {/* Halaman Pembagian Hasil (Bisa dilihat semua role, hanya Super Admin yang bisa edit persentase) */}
                            <Route
                              path="/profit-sharing"
                              element={
                                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff']}>
                                  <ProfitSharing />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/withdrawals"
                              element={
                                <ProtectedRoute allowedRoles={['superadmin']}>
                                  <Withdrawals />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/users"
                              element={
                                <ProtectedRoute allowedRoles={['superadmin']}>
                                  <Users />
                                </ProtectedRoute>
                              }
                            />

                            <Route path="/reports" element={<Reports />} />
                          </Routes>
                        </Layout>
                      </WithdrawalProvider>
                    </InventoryProvider>
                  </OwnerProvider>
                </SalesProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
