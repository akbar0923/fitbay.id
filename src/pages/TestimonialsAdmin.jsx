import { useState, useEffect, useMemo } from 'react';
import {
  subscribeAdminTestimonials,
  createAdminTestimonial,
  updateTestimonialStatus,
  updateTestimonialDoc,
  deleteTestimonialDoc,
} from '../firebase/testimonialService';
import toast from 'react-hot-toast';

export default function TestimonialsAdmin() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'menunggu' | 'disetujui' | 'ditolak'
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'manual' | 'publik'

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    namaPembeli: '',
    rating: 5,
    namaBarang: '',
    isiTestimoni: '',
    fotoUrl: '',
    tanggal: new Date().toISOString().split('T')[0],
    status: 'disetujui',
    sumber: 'manual',
    catatanInternal: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Real-time subscribe
  useEffect(() => {
    document.title = 'Kelola Testimoni — Fitbay.id';
    setLoading(true);
    const unsubscribe = subscribeAdminTestimonials(
      (items) => {
        setTestimonials(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error subscribe testimonials:', err);
        toast.error('Gagal menyinkronkan data testimoni');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtered Testimonials
  const filteredTestimonials = useMemo(() => {
    return testimonials.filter((item) => {
      // Tab filter
      if (activeTab !== 'all' && item.status !== activeTab) {
        return false;
      }
      // Source filter
      if (sourceFilter !== 'all' && item.sumber !== sourceFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nama = (item.namaPembeli || '').toLowerCase();
        const barang = (item.namaBarang || '').toLowerCase();
        const isi = (item.isiTestimoni || '').toLowerCase();
        return nama.includes(term) || barang.includes(term) || isi.includes(term);
      }
      return true;
    });
  }, [testimonials, activeTab, sourceFilter, searchTerm]);

  // Counts
  const counts = useMemo(() => {
    const total = testimonials.length;
    const menunggu = testimonials.filter((t) => t.status === 'menunggu').length;
    const disetujui = testimonials.filter((t) => t.status === 'disetujui').length;
    const ditolak = testimonials.filter((t) => t.status === 'ditolak').length;
    return { total, menunggu, disetujui, ditolak };
  }, [testimonials]);

  // Image Upload helper (Canvas compressed)
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX) {
            h *= MAX / w;
            w = MAX;
          }
        } else {
          if (h > MAX) {
            w *= MAX / h;
            h = MAX;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData((prev) => ({ ...prev, fotoUrl: dataUrl }));
        toast.success('Foto berhasil dilampirkan');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Status toggle handler
  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateTestimonialStatus(id, newStatus);
      const label =
        newStatus === 'disetujui'
          ? 'disetujui & tampil di publik'
          : newStatus === 'ditolak'
          ? 'ditolak'
          : 'diubah menjadi menunggu';
      toast.success(`Testimoni berhasil ${label}`);
    } catch (err) {
      console.error('Gagal mengubah status:', err);
      toast.error('Gagal memperbarui status testimoni');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      namaPembeli: item.namaPembeli || '',
      rating: item.rating || 5,
      namaBarang: item.namaBarang || '',
      isiTestimoni: item.isiTestimoni || '',
      fotoUrl: item.fotoUrl || '',
      tanggal: item.tanggal || new Date().toISOString().split('T')[0],
      status: item.status || 'disetujui',
      sumber: item.sumber || 'manual',
      catatanInternal: item.catatanInternal || '',
    });
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      namaPembeli: '',
      rating: 5,
      namaBarang: '',
      isiTestimoni: '',
      fotoUrl: '',
      tanggal: new Date().toISOString().split('T')[0],
      status: 'disetujui',
      sumber: 'manual',
      catatanInternal: '',
    });
    setIsAddModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.namaPembeli.trim()) {
      toast.error('Nama pembeli wajib diisi');
      return;
    }
    if (!formData.isiTestimoni.trim()) {
      toast.error('Isi testimoni wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await updateTestimonialDoc(editingItem.id, formData);
        toast.success('Testimoni berhasil diperbarui');
        setEditingItem(null);
      } else {
        await createAdminTestimonial(formData);
        toast.success('Testimoni manual berhasil ditambahkan');
        setIsAddModalOpen(false);
      }
    } catch (err) {
      console.error('Gagal menyimpan testimoni:', err);
      toast.error(err.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem) return;
    try {
      await deleteTestimonialDoc(deleteConfirmItem.id);
      toast.success('Testimoni berhasil dihapus');
      setDeleteConfirmItem(null);
    } catch (err) {
      console.error('Gagal menghapus testimoni:', err);
      toast.error('Gagal menghapus testimoni');
    }
  };

  // Helper render rating stars
  const renderStars = (num) => {
    const r = Math.round(Number(num) || 5);
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={`text-xs ${s <= r ? 'text-amber-400' : 'text-gray-600'}`}>
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold dark:text-white text-gray-900">
              Kelola Testimoni
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Admin & Publik
            </span>
          </div>
          <p className="text-xs sm:text-sm dark:text-gray-400 text-gray-600 mt-1">
            Tinjau ulasan pembeli dari form website atau tambahkan testimoni asli dari WhatsApp / Instagram.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/testimoni"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl border dark:border-white/10 border-gray-300 dark:bg-white/5 bg-gray-100 hover:bg-gray-200 dark:hover:bg-white/10 dark:text-gray-300 text-gray-700 text-xs sm:text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span>Buka Halaman Publik</span>
            <span>↗</span>
          </a>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            <span>Tambah Testimoni Manual</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('all')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'all'
              ? 'dark:bg-white/10 bg-gray-200 border-emerald-500/50 shadow-md'
              : 'dark:bg-surface-300/40 bg-white border-gray-200 dark:border-white/5 hover:border-gray-300'
          }`}
        >
          <div className="text-xs dark:text-gray-400 text-gray-500">Semua Testimoni</div>
          <div className="text-2xl font-bold dark:text-white text-gray-900 mt-1">{counts.total}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Total keseluruhan ulasan</div>
        </div>

        <div
          onClick={() => setActiveTab('menunggu')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'menunggu'
              ? 'dark:bg-amber-500/10 bg-amber-50 border-amber-500 shadow-md'
              : 'dark:bg-surface-300/40 bg-white border-gray-200 dark:border-white/5 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-500 font-medium">Perlu Persetujuan</span>
            {counts.menunggu > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{counts.menunggu}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Menunggu review admin</div>
        </div>

        <div
          onClick={() => setActiveTab('disetujui')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'disetujui'
              ? 'dark:bg-emerald-500/10 bg-emerald-50 border-emerald-500 shadow-md'
              : 'dark:bg-surface-300/40 bg-white border-gray-200 dark:border-white/5 hover:border-emerald-500/40'
          }`}
        >
          <div className="text-xs text-emerald-500 font-medium">Disetujui & Tampil</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{counts.disetujui}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Aktif di halaman publik</div>
        </div>

        <div
          onClick={() => setActiveTab('ditolak')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'ditolak'
              ? 'dark:bg-red-500/10 bg-red-50 border-red-500 shadow-md'
              : 'dark:bg-surface-300/40 bg-white border-gray-200 dark:border-white/5 hover:border-red-500/40'
          }`}
        >
          <div className="text-xs text-red-400 font-medium">Ditolak</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{counts.ditolak}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Tidak ditampilkan</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 rounded-2xl dark:bg-surface-300/40 bg-white border border-gray-200 dark:border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-emerald-500 text-black'
                : 'dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 hover:text-white'
            }`}
          >
            Semua ({counts.total})
          </button>
          <button
            onClick={() => setActiveTab('menunggu')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'menunggu'
                ? 'bg-amber-400 text-black'
                : 'dark:bg-white/5 bg-gray-100 dark:text-amber-400 text-amber-600 hover:text-amber-300'
            }`}
          >
            <span>Menunggu Review</span>
            {counts.menunggu > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {counts.menunggu}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('disetujui')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'disetujui'
                ? 'bg-emerald-500 text-black'
                : 'dark:bg-white/5 bg-gray-100 dark:text-emerald-400 text-emerald-600 hover:text-emerald-300'
            }`}
          >
            Disetujui ({counts.disetujui})
          </button>
          <button
            onClick={() => setActiveTab('ditolak')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'ditolak'
                ? 'bg-red-500 text-white'
                : 'dark:bg-white/5 bg-gray-100 dark:text-red-400 text-red-600 hover:text-red-300'
            }`}
          >
            Ditolak ({counts.ditolak})
          </button>
        </div>

        {/* Search & Source filter */}
        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-xs dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 dark:text-gray-300 text-gray-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Sumber</option>
            <option value="manual">Manual Admin</option>
            <option value="publik">Form Web Publik</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Cari pembeli / ulasan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 dark:text-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
            />
            <svg
              className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table / Cards List */}
      <div className="rounded-2xl dark:bg-surface-300/40 bg-white border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs dark:text-gray-400 text-gray-500">Menyinkronkan data testimoni...</p>
          </div>
        ) : filteredTestimonials.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full dark:bg-white/5 bg-gray-100 flex items-center justify-center text-xl mx-auto mb-3 text-gray-400">
              💬
            </div>
            <p className="text-sm font-semibold dark:text-gray-300 text-gray-700">Tidak ada testimoni yang sesuai</p>
            <p className="text-xs text-gray-500 mt-1">
              Coba sesuaikan tab filter atau kata kunci pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredTestimonials.map((item) => {
              const isMenunggu = item.status === 'menunggu';
              const isDisetujui = item.status === 'disetujui';
              const isDitolak = item.status === 'ditolak';

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isMenunggu
                      ? 'dark:bg-amber-500/[0.04] bg-amber-50/50'
                      : 'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Left content: Info, Rating, Text */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold dark:text-white text-gray-900">
                        {item.namaPembeli}
                      </h3>

                      {renderStars(item.rating)}

                      <span className="text-[11px] text-gray-400">
                        • {item.tanggal || item.createdAt?.slice(0, 10)}
                      </span>

                      {/* Sumber Badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.sumber === 'publik'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {item.sumber === 'publik' ? 'Form Web' : 'Manual Admin'}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          isDisetujui
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isDitolak
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-amber-400/20 text-amber-400 border-amber-400/40 animate-pulse'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Nama Barang jika ada */}
                    {item.namaBarang && (
                      <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <span>🏷️</span>
                        <span>{item.namaBarang}</span>
                      </div>
                    )}

                    {/* Isi Ulasan */}
                    <p className="text-xs sm:text-sm dark:text-gray-300 text-gray-700 leading-relaxed italic whitespace-pre-line">
                      "{item.isiTestimoni}"
                    </p>

                    {/* Catatan Internal Admin jika ada */}
                    {item.catatanInternal && (
                      <div className="text-[11px] dark:text-gray-400 text-gray-500 bg-black/20 p-2 rounded-lg border border-white/5 w-fit">
                        <span className="font-semibold text-gray-300">Catatan:</span> {item.catatanInternal}
                      </div>
                    )}
                  </div>

                  {/* Right side: Foto Preview & Action Buttons */}
                  <div className="flex items-center gap-3 self-end lg:self-center flex-shrink-0">
                    {item.fotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: item.fotoUrl,
                            title: `${item.namaPembeli} - ${item.namaBarang || 'Foto Ulasan'}`,
                          })
                        }
                        className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 relative group/pic flex-shrink-0"
                      >
                        <img
                          src={item.fotoUrl}
                          alt="Foto"
                          className="w-full h-full object-cover group-hover/pic:scale-110 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pic:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                          🔍
                        </div>
                      </button>
                    )}

                    {/* Quick Approve / Reject Buttons */}
                    {isMenunggu && (
                      <>
                        <button
                          onClick={() => handleStatusChange(item.id, 'disetujui')}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1"
                          title="Setujui dan tampilkan ke web publik"
                        >
                          <span>✓</span>
                          <span>Setujui</span>
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.id, 'ditolak')}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold rounded-xl transition-all"
                          title="Tolak ulasan ini"
                        >
                          <span>✕</span>
                          <span>Tolak</span>
                        </button>
                      </>
                    )}

                    {isDisetujui && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'ditolak')}
                        className="px-2.5 py-1.5 dark:bg-white/5 bg-gray-100 hover:bg-red-500/10 hover:text-red-400 text-gray-400 text-xs font-medium rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                        title="Tarik / Batalkan publikasi"
                      >
                        Sembunyikan
                      </button>
                    )}

                    {isDitolak && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'disetujui')}
                        className="px-2.5 py-1.5 dark:bg-white/5 bg-gray-100 hover:bg-emerald-500/10 hover:text-emerald-400 text-gray-400 text-xs font-medium rounded-xl transition-colors border border-transparent hover:border-emerald-500/20"
                        title="Setujui dan tayangkan ulasan ini"
                      >
                        Setujui Ulang
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 rounded-xl dark:bg-white/5 bg-gray-100 hover:bg-emerald-500/10 hover:text-emerald-400 dark:text-gray-300 text-gray-700 transition-colors"
                      title="Edit ulasan"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteConfirmItem(item)}
                      className="p-2 rounded-xl dark:bg-white/5 bg-gray-100 hover:bg-red-500/10 hover:text-red-400 dark:text-gray-300 text-gray-700 transition-colors"
                      title="Hapus permanen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Testimoni */}
      {(isAddModalOpen || editingItem) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl dark:bg-[#16181f] bg-white rounded-3xl border dark:border-white/10 border-gray-200 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b dark:border-white/10 border-gray-200">
              <h2 className="text-lg font-bold dark:text-white text-gray-900">
                {editingItem ? 'Edit Testimoni' : 'Tambah Testimoni Manual (Admin)'}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }}
                className="w-8 h-8 rounded-full dark:bg-white/5 bg-gray-100 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Pembeli */}
                <div>
                  <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                    Nama Pembeli <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.namaPembeli}
                    onChange={(e) => setFormData({ ...formData, namaPembeli: e.target.value })}
                    className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                    placeholder="Misal: Kak Dimas"
                  />
                </div>

                {/* Tanggal Ulasan */}
                <div>
                  <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                    Tanggal Ulasan
                  </label>
                  <input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Rating Bintang */}
                <div>
                  <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                    Rating Bintang (1 - 5)
                  </label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 Bintang - Sangat Puas)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 Bintang - Puas)</option>
                    <option value={3}>⭐⭐⭐ (3 Bintang - Cukup)</option>
                    <option value={2}>⭐⭐ (2 Bintang - Kurang)</option>
                    <option value={1}>⭐ (1 Bintang - Buruk)</option>
                  </select>
                </div>

                {/* Nama Barang */}
                <div>
                  <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                    Nama Barang <span className="text-gray-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.namaBarang}
                    onChange={(e) => setFormData({ ...formData, namaBarang: e.target.value })}
                    className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                    placeholder="Misal: Crewneck Dickies Hitam"
                  />
                </div>
              </div>

              {/* Isi Testimoni */}
              <div>
                <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                  Isi Testimoni / Ulasan <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.isiTestimoni}
                  onChange={(e) => setFormData({ ...formData, isiTestimoni: e.target.value })}
                  className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Ketik ulasan atau paste chat testimoni dari pembeli..."
                />
              </div>

              {/* Foto URL / Upload */}
              <div>
                <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                  Foto Barang / Tangkapan Layar Chat <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2 rounded-xl dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 text-xs font-medium dark:text-gray-300 text-gray-700 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                    <span>Upload Foto</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {formData.fotoUrl && (
                    <div className="flex items-center gap-2">
                      <img
                        src={formData.fotoUrl}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-lg border border-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, fotoUrl: '' })}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Hapus Foto
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                    Status Publikasi
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="disetujui">Disetujui (Tampil di Web)</option>
                    <option value="menunggu">Menunggu Persetujuan</option>
                    <option value="ditolak">Ditolak (Disembunyikan)</option>
                  </select>
                </div>

                {/* Sumber */}
                <div>
                  <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                    Sumber Testimoni
                  </label>
                  <select
                    value={formData.sumber}
                    onChange={(e) => setFormData({ ...formData, sumber: e.target.value })}
                    className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="manual">Manual Admin (WhatsApp / IG / Offline)</option>
                    <option value="publik">Form Web Publik</option>
                  </select>
                </div>
              </div>

              {/* Catatan Internal */}
              <div>
                <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                  Catatan Internal Admin <span className="text-gray-400 font-normal">(Tidak tampil di publik)</span>
                </label>
                <input
                  type="text"
                  value={formData.catatanInternal}
                  onChange={(e) => setFormData({ ...formData, catatanInternal: e.target.value })}
                  className="w-full dark:bg-white/5 bg-gray-100 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-emerald-500"
                  placeholder="Misal: Dari chat WhatsApp 0812xxx transaksi tanggal 20"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-white/10 border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  {submitting && <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  <span>{editingItem ? 'Simpan Perubahan' : 'Tambah Testimoni'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md dark:bg-[#16181f] bg-white rounded-3xl border dark:border-white/10 border-gray-200 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>Hapus Testimoni?</span>
            </h3>
            <p className="text-xs sm:text-sm dark:text-gray-300 text-gray-700 leading-relaxed">
              Apakah Anda yakin ingin menghapus testimoni dari{' '}
              <strong className="dark:text-white text-gray-900">{deleteConfirmItem.namaPembeli}</strong>? Tindakan ini bersifat permanen dan data ulasan tidak dapat dikembalikan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold shadow-md"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Gambar */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] dark:bg-[#16181f] bg-white rounded-2xl border border-white/20 p-2 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b dark:border-white/10 border-gray-200">
              <span className="text-xs font-semibold dark:text-gray-300 text-gray-700 truncate">
                {previewImage.title}
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
