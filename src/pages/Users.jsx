import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeUsers,
  createUserByAdmin,
  updateUserProfileData,
  toggleUserStatus,
  deleteUserAccount,
  sendUserPasswordReset,
  usernameToInternalEmail,
} from '../firebase/userService';
import { USER_ROLES } from '../constants/profitSharingConfig';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Select } from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state: Tambah User
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: USER_ROLES.STAFF,
    title: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form state: Edit User
  const [editFormData, setEditFormData] = useState({
    name: '',
    role: USER_ROLES.STAFF,
    title: '',
    status: 'active',
  });

  // Subscribe to real-time users list
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUsers((usersList) => {
      // Sort users: Admin first, then alphabetically by name
      const sorted = [...usersList].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setUsers(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !searchQuery.trim() ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole =
        roleFilter === 'ALL' ||
        u.role === roleFilter;

      const matchStatus =
        statusFilter === 'ALL' ||
        (u.status || 'active') === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const superAdminCount = users.filter((u) => u.role === 'superadmin').length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const staffCount = users.filter((u) => u.role === 'staff' || (!u.role && u.role !== 'superadmin' && u.role !== 'admin')).length;
    const activeCount = users.filter((u) => (u.status || 'active') === 'active').length;
    const inactiveCount = total - activeCount;

    return { total, superAdminCount, adminCount, staffCount, activeCount, inactiveCount };
  }, [users]);

  // Handlers: Tambah User
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: USER_ROLES.STAFF,
      title: '',
    });
    setFormErrors({});
    setShowPassword(false);
    setIsAddModalOpen(true);
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.name.trim()) errors.name = 'Nama lengkap wajib diisi';
    
    const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!cleanUsername) {
      errors.username = 'Username wajib diisi (gunakan huruf kecil, angka, atau titik/underscore)';
    } else if (cleanUsername.length < 3) {
      errors.username = 'Username minimal 3 karakter';
    } else if (users.some((u) => u.username?.toLowerCase() === cleanUsername)) {
      errors.username = 'Username ini sudah terdaftar';
    }

    if (!formData.password) {
      errors.password = 'Password wajib diisi';
    } else if (formData.password.length < 6) {
      errors.password = 'Password minimal 6 karakter';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Konfirmasi password tidak cocok';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setActionLoading(true);
    try {
      const created = await createUserByAdmin({
        name: formData.name,
        username: cleanUsername,
        password: formData.password,
        role: formData.role,
        title: formData.title || (formData.role === USER_ROLES.SUPER_ADMIN ? 'Super Admin' : formData.role === USER_ROLES.ADMIN ? 'Admin' : 'Staff & Host Live'),
        createdBy: currentUser?.username || 'admin',
      });

      setUsers((prev) => [created, ...prev.filter((u) => u.username?.toLowerCase() !== cleanUsername)]);
      toast.success(`Akun "${formData.name}" (@${cleanUsername}) berhasil dibuat!`);
      setIsAddModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Gagal menambahkan user');
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Edit User
  const handleOpenEditModal = (targetUser) => {
    setSelectedUser(targetUser);
    setEditFormData({
      name: targetUser.name || '',
      role: targetUser.role || USER_ROLES.STAFF,
      title: targetUser.title || '',
      status: targetUser.status || 'active',
    });
    setIsEditModalOpen(true);
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      toast.error('Nama lengkap tidak boleh kosong');
      return;
    }

    setActionLoading(true);
    try {
      const defaultTitle =
        editFormData.role === USER_ROLES.SUPER_ADMIN
          ? 'Super Admin'
          : editFormData.role === USER_ROLES.ADMIN
          ? 'Admin Operasional'
          : 'Staff & Host Live';

      const updatePayload = {
        name: editFormData.name.trim(),
        username: selectedUser.username,
        role: editFormData.role,
        title: editFormData.title.trim() || defaultTitle,
        status: editFormData.status,
      };

      await updateUserProfileData(selectedUser.uid, updatePayload);

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === selectedUser.uid || (u.username && u.username === selectedUser.username)
            ? { ...u, ...updatePayload }
            : u
        )
      );

      toast.success(`Data user ${selectedUser.name} berhasil diperbarui!`);
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui data user');
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Reset Password
  const handleOpenResetModal = (targetUser) => {
    setSelectedUser(targetUser);
    setIsResetModalOpen(true);
  };

  const handleSendPasswordResetEmail = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const email = selectedUser.email || usernameToInternalEmail(selectedUser.username);
      await sendUserPasswordReset(email);
      toast.success(`Email link reset password telah dikirim ke ${email}!`);
      setIsResetModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Gagal mengirim email reset password');
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Toggle Status (Aktif / Nonaktif)
  const handleOpenToggleStatusModal = (targetUser) => {
    if (targetUser.uid === currentUser?.uid) {
      toast.error('Anda tidak dapat menonaktifkan akun yang sedang digunakan saat ini!');
      return;
    }
    setSelectedUser(targetUser);
    setIsToggleStatusModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!selectedUser) return;
    const newStatus = (selectedUser.status || 'active') === 'active' ? 'inactive' : 'active';
    setActionLoading(true);
    try {
      await toggleUserStatus(selectedUser.uid, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.uid === selectedUser.uid ? { ...u, status: newStatus } : u))
      );
      toast.success(
        newStatus === 'active'
          ? `Akun ${selectedUser.name} berhasil diaktifkan kembali.`
          : `Akun ${selectedUser.name} berhasil dinonaktifkan.`
      );
      setIsToggleStatusModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah status akun');
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Delete User
  const handleOpenDeleteModal = (targetUser) => {
    if (targetUser.uid === currentUser?.uid) {
      toast.error('Anda tidak dapat menghapus akun Anda sendiri!');
      return;
    }
    setSelectedUser(targetUser);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await deleteUserAccount(selectedUser.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== selectedUser.uid));
      toast.success(`Akun user ${selectedUser.name} (@${selectedUser.username}) berhasil dihapus.`);
      setIsDeleteModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus akun user');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-accent/10 text-accent dark:bg-accent/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </span>
            Kelola User & Hak Akses
          </h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-1">
            Fitur khusus Super Admin untuk membuat akun pengguna, mengatur role (Super Admin, Admin, Staff), dan hak akses sistem
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="shrink-0 shadow-lg shadow-accent/25">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah User Baru
        </Button>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card className="p-4 relative overflow-hidden group hover:border-accent/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Total User</p>
              <h3 className="text-2xl font-bold dark:text-white text-gray-900 mt-1">{loading ? '...' : stats.total}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple/10 text-purple flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs dark:text-gray-400 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{stats.activeCount} akun aktif</span>
          </div>
        </Card>

        {/* Super Admin */}
        <Card className="p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Super Admin</p>
              <h3 className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 mt-1">{loading ? '...' : stats.superAdminCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-xs text-emerald-500/90 dark:text-emerald-400/90 font-medium">
            Akses Penuh
          </div>
        </Card>

        {/* Admin */}
        <Card className="p-4 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Admin</p>
              <h3 className="text-2xl font-bold text-blue-500 dark:text-blue-400 mt-1">{loading ? '...' : stats.adminCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-500/90 dark:text-blue-400/90 font-medium">
            Akses Terbatas
          </div>
        </Card>

        {/* Staff */}
        <Card className="p-4 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium dark:text-gray-400 text-gray-500 uppercase tracking-wider">Staff</p>
              <h3 className="text-2xl font-bold text-amber-500 dark:text-amber-400 mt-1">{loading ? '...' : stats.staffCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.003 0H9.497m5.003 0a3.375 3.375 0 0 0-5.003 0" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-xs text-amber-500/90 dark:text-amber-400/90 font-medium">
            Host Live & Penjualan
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 dark:text-gray-400 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama, username, atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm
                dark:bg-white/5 bg-gray-100 dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                dark:placeholder-gray-500 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-44">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                cursor-pointer"
            >
              <option value="ALL">Semua Role</option>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden border dark:border-white/10 border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="dark:bg-white/[0.03] bg-gray-50 border-b dark:border-white/5 border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold dark:text-gray-300 text-gray-700">Pengguna</th>
                <th className="px-6 py-4 font-semibold dark:text-gray-300 text-gray-700">Email Internal</th>
                <th className="px-6 py-4 font-semibold dark:text-gray-300 text-gray-700">Role & Hak Akses</th>
                <th className="px-6 py-4 font-semibold dark:text-gray-300 text-gray-700">Status</th>
                <th className="px-6 py-4 font-semibold dark:text-gray-300 text-gray-700 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5 divide-gray-200">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="space-y-1.5">
                          <Skeleton className="w-28 h-4 rounded" />
                          <Skeleton className="w-20 h-3 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="w-36 h-4 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="w-24 h-6 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="w-16 h-6 rounded-full" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="w-20 h-8 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState
                      title="Tidak ada pengguna ditemukan"
                      description={searchQuery ? 'Coba ubah kata kunci pencarian atau reset filter role/status' : 'Belum ada pengguna yang terdaftar di sistem.'}
                      action={
                        searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSearchQuery('');
                              setRoleFilter('ALL');
                              setStatusFilter('ALL');
                            }}
                          >
                            Reset Filter
                          </Button>
                        ) : null
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuper = u.role === 'superadmin';
                  const isAdminRole = u.role === 'admin';
                  const isActive = (u.status || 'active') === 'active';
                  const isCurrentLoggedUser = u.uid === currentUser?.uid;

                  return (
                    <tr
                      key={u.uid}
                      className="dark:hover:bg-white/[0.02] hover:bg-gray-50/80 transition-colors"
                    >
                      {/* Avatar & User info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm uppercase shadow-sm
                            ${isSuper 
                              ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30' 
                              : isAdminRole
                              ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/30'}`}
                          >
                            {u.username?.charAt(0) || u.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold dark:text-white text-gray-900">
                                {u.name || u.username}
                              </span>
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="text-xs dark:text-gray-400 text-gray-500">
                              @{u.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email Internal */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs dark:text-gray-300 text-gray-600 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-md border dark:border-white/5 border-gray-200">
                          {u.email || usernameToInternalEmail(u.username)}
                        </span>
                      </td>

                      {/* Role & Jabatan */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {isSuper ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              🛡️ Super Admin
                            </span>
                          ) : isAdminRole ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              👔 Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
                              👤 Staff
                            </span>
                          )}
                          <p className="text-xs dark:text-gray-400 text-gray-500">
                            {u.title || (isSuper ? 'Super Admin' : isAdminRole ? 'Admin' : 'Staff')}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                          ${isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit User Button */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            title="Edit Role & Nama"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>

                          {/* Reset Password Button */}
                          <button
                            onClick={() => handleOpenResetModal(u)}
                            title="Reset Password"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                            </svg>
                          </button>

                          {/* Toggle Active/Inactive */}
                          <button
                            onClick={() => handleOpenToggleStatusModal(u)}
                            disabled={isCurrentLoggedUser}
                            title={isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrentLoggedUser
                                ? 'opacity-30 cursor-not-allowed text-gray-500'
                                : isActive
                                ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
                                : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                            </svg>
                          </button>

                          {/* Delete User Button */}
                          <button
                            onClick={() => handleOpenDeleteModal(u)}
                            disabled={isCurrentLoggedUser}
                            title={isCurrentLoggedUser ? 'Tidak dapat menghapus akun sendiri' : 'Hapus Akun'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrentLoggedUser
                                ? 'opacity-30 cursor-not-allowed text-gray-500'
                                : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH USER BARU */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !actionLoading && setIsAddModalOpen(false)}
        title="Tambah User Baru"
        size="md"
      >
        <form onSubmit={handleAddUserSubmit} className="space-y-4">
          <p className="text-xs dark:text-gray-400 text-gray-500 -mt-1">
            Akun akan dibuat langsung di sistem Firebase Authentication dan tersimpan otomatis di basis data. Sesi login Anda tetap aman dan aktif.
          </p>

          <Input
            label="Nama Lengkap *"
            placeholder="Contoh: Siti Rahma"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: null });
            }}
            error={formErrors.name}
          />

          <div>
            <Input
              label="Username *"
              placeholder="Contoh: sitirahma"
              value={formData.username}
              onChange={(e) => {
                const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                setFormData({ ...formData, username: val });
                if (formErrors.username) setFormErrors({ ...formErrors, username: null });
              }}
              error={formErrors.username}
            />
            {formData.username && (
              <p className="text-[11px] dark:text-gray-400 text-gray-500 mt-1">
                Format email internal: <span className="text-accent font-mono">{usernameToInternalEmail(formData.username)}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Role Hak Akses *"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value={USER_ROLES.SUPER_ADMIN}>Super Admin</option>
              <option value={USER_ROLES.ADMIN}>Admin</option>
              <option value={USER_ROLES.STAFF}>Staff</option>
            </Select>

            <Input
              label="Jabatan / Posisi"
              placeholder={formData.role === USER_ROLES.SUPER_ADMIN ? 'Super Admin' : formData.role === USER_ROLES.ADMIN ? 'Admin' : 'Staff'}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Password Fields */}
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              label="Password Akun *"
              placeholder="Minimal 6 karakter"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (formErrors.password) setFormErrors({ ...formErrors, password: null });
              }}
              error={formErrors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-white text-xs p-1"
            >
              {showPassword ? 'Sembunyikan' : 'Lihat'}
            </button>
          </div>

          <Input
            type={showPassword ? 'text' : 'password'}
            label="Konfirmasi Password *"
            placeholder="Ulangi password di atas"
            value={formData.confirmPassword}
            onChange={(e) => {
              setFormData({ ...formData, confirmPassword: e.target.value });
              if (formErrors.confirmPassword) setFormErrors({ ...formErrors, confirmPassword: null });
            }}
            error={formErrors.confirmPassword}
          />

          <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={actionLoading}
            >
              Batal
            </Button>
            <Button type="submit" loading={actionLoading}>
              Simpan & Buat Akun
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDIT USER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !actionLoading && setIsEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.name || selectedUser?.username}`}
        size="md"
      >
        <form onSubmit={handleEditUserSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
              Username (Tetap)
            </label>
            <input
              type="text"
              disabled
              value={`@${selectedUser?.username || ''}`}
              className="w-full px-4 py-2.5 rounded-xl text-sm opacity-60 cursor-not-allowed
                dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-600 border dark:border-white/5 border-gray-200"
            />
          </div>

          <Input
            label="Nama Lengkap *"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Role Hak Akses *"
              value={editFormData.role}
              onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
            >
              <option value={USER_ROLES.SUPER_ADMIN}>Super Admin</option>
              <option value={USER_ROLES.ADMIN}>Admin</option>
              <option value={USER_ROLES.STAFF}>Staff</option>
            </Select>

            <Select
              label="Status Akun *"
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>

          <Input
            label="Jabatan / Posisi"
            value={editFormData.title}
            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
            placeholder={editFormData.role === USER_ROLES.SUPER_ADMIN ? 'Super Admin' : editFormData.role === USER_ROLES.ADMIN ? 'Admin' : 'Staff'}
          />

          <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={actionLoading}
            >
              Batal
            </Button>
            <Button type="submit" loading={actionLoading}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: RESET PASSWORD */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => !actionLoading && setIsResetModalOpen(false)}
        title="Reset Password Pengguna"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl dark:bg-amber-500/10 bg-amber-50 border dark:border-amber-500/20 border-amber-200 flex items-start gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div className="text-xs dark:text-amber-300 text-amber-800 space-y-1">
              <p className="font-semibold">Reset Password untuk: {selectedUser?.name} (@{selectedUser?.username})</p>
              <p>Email internal: <span className="font-mono font-bold">{selectedUser?.email || usernameToInternalEmail(selectedUser?.username)}</span></p>
            </div>
          </div>

          <p className="text-sm dark:text-gray-300 text-gray-600">
            Kirimkan tautan reset password resmi dari Firebase ke email pengguna ini, sehingga pengguna dapat mengatur password baru mereka secara aman.
          </p>

          <div className="p-3.5 rounded-xl dark:bg-white/5 bg-gray-50 border dark:border-white/10 border-gray-200 text-xs dark:text-gray-400 text-gray-500 space-y-2">
            <p className="font-semibold dark:text-white text-gray-800">💡 Tips Password Super Admin:</p>
            <p>
              Untuk keamanan optimal akun tim, Anda juga dapat menonaktifkan akun sewaktu-waktu bila terdapat staf yang sudah tidak bertugas.
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetModalOpen(false)}
              disabled={actionLoading}
            >
              Tutup
            </Button>
            <Button
              onClick={handleSendPasswordResetEmail}
              loading={actionLoading}
              className="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
            >
              Kirim Link Reset Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI NONAKTIFKAN / AKTIFKAN */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isToggleStatusModalOpen}
        onClose={() => !actionLoading && setIsToggleStatusModalOpen(false)}
        title={(selectedUser?.status || 'active') === 'active' ? 'Nonaktifkan Akun User?' : 'Aktifkan Kembali Akun User?'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm dark:text-gray-300 text-gray-600">
            {(selectedUser?.status || 'active') === 'active' ? (
              <>
                Pengguna <strong className="dark:text-white text-gray-900">{selectedUser?.name}</strong> (@{selectedUser?.username}) akan langsung dikeluarkan dari sesi aktif dan <strong>tidak dapat login kembali</strong> ke Fitbay.id hingga status diaktifkan kembali.
              </>
            ) : (
              <>
                Pengguna <strong className="dark:text-white text-gray-900">{selectedUser?.name}</strong> (@{selectedUser?.username}) akan dapat login kembali ke Fitbay.id secara normal.
              </>
            )}
          </p>

          <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsToggleStatusModalOpen(false)}
              disabled={actionLoading}
            >
              Batal
            </Button>
            <Button
              variant={(selectedUser?.status || 'active') === 'active' ? 'danger' : 'primary'}
              onClick={handleConfirmToggleStatus}
              loading={actionLoading}
            >
              {(selectedUser?.status || 'active') === 'active' ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI HAPUS USER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !actionLoading && setIsDeleteModalOpen(false)}
        title="Hapus Akun Pengguna"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <strong>Peringatan:</strong> Tindakan ini akan menghapus data profil akun <strong>{selectedUser?.name} (@{selectedUser?.username})</strong> secara permanen.
          </div>

          <p className="text-sm dark:text-gray-300 text-gray-600">
            Apakah Anda yakin ingin menghapus akun ini? Jika anggota tim hanya berhenti sementara, disarankan menggunakan fitur <strong>Nonaktifkan Akun</strong>.
          </p>

          <div className="pt-3 flex justify-end gap-2 border-t dark:border-white/5 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={actionLoading}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={actionLoading}
            >
              Hapus Permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
