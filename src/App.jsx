import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SalesProvider } from './context/SalesContext';
import { OwnerProvider } from './context/OwnerContext';
import { WithdrawalProvider } from './context/WithdrawalContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SalesData from './pages/SalesData';
import Owners from './pages/Owners';
import ProfitSharing from './pages/ProfitSharing';
import Withdrawals from './pages/Withdrawals';
import Users from './pages/Users';
import Reports from './pages/Reports';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
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

          {/* Protected App Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <SalesProvider>
                  <OwnerProvider>
                    <WithdrawalProvider>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/sales" element={<SalesData />} />
                          
                          {/* Halaman Khusus Admin (Founder & Co-Founder) */}
                          <Route
                            path="/owners"
                            element={
                              <ProtectedRoute allowedRoles={['admin']}>
                                <Owners />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/profit-sharing"
                            element={
                              <ProtectedRoute allowedRoles={['admin']}>
                                <ProfitSharing />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/withdrawals"
                            element={
                              <ProtectedRoute allowedRoles={['admin']}>
                                <Withdrawals />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/users"
                            element={
                              <ProtectedRoute allowedRoles={['admin']}>
                                <Users />
                              </ProtectedRoute>
                            }
                          />

                          <Route path="/reports" element={<Reports />} />
                        </Routes>
                      </Layout>
                    </WithdrawalProvider>
                  </OwnerProvider>
                </SalesProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
