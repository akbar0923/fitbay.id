import { useState, useEffect } from 'react';
import { getLinksConfig, updateLinksConfig, DEFAULT_LINKS_CONFIG } from '../services/linksService';
import toast from 'react-hot-toast';

// Pilihan Preset Ikon Siap Pakai
const ICON_PRESETS = [
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'shopee', label: 'Shopee / Toko', emoji: '🛍️' },
  { id: 'star', label: 'Bintang / Testimoni', emoji: '⭐' },
  { id: 'handshake', label: 'Titip Jual / Konsinyasi', emoji: '🤝' },
  { id: 'box', label: 'Paket / Cek Barang', emoji: '📦' },
  { id: 'fire', label: 'Promo / Hot', emoji: '🔥' },
  { id: 'sparkles', label: 'Koleksi Baru', emoji: '✨' },
  { id: 'globe', label: 'Website / Portofolio', emoji: '🌐' },
];

// Pilihan Varian Gaya Tombol
const STYLE_VARIANTS = [
  { id: 'emerald', label: 'Emerald Glow (Utama)', bgClass: 'from-emerald-600 to-teal-500 text-white border-emerald-400/40' },
  { id: 'dark', label: 'Dark Glassmorphism', bgClass: 'bg-surface-200/90 hover:bg-surface-200 border-white/10 text-gray-200' },
  { id: 'purple', label: 'Royal Purple', bgClass: 'from-purple-600 to-indigo-600 text-white border-purple-400/40' },
  { id: 'amber', label: 'Amber Gold', bgClass: 'from-amber-600 to-yellow-500 text-white border-amber-400/40' },
  { id: 'pink', label: 'Rose Pink', bgClass: 'from-pink-600 to-rose-500 text-white border-pink-400/40' },
  { id: 'cyan', label: 'Cyan Blue', bgClass: 'from-cyan-600 to-blue-500 text-white border-cyan-400/40' },
  { id: 'orange', label: 'Shopee Orange', bgClass: 'from-orange-600 to-amber-500 text-white border-orange-400/40' },
];

export default function LinksManageAdmin() {
  const [config, setConfig] = useState(DEFAULT_LINKS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('links'); // 'links' | 'profile' | 'socials' | 'footer'

  // State Modal Tambah / Edit Link
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // null = tambah baru
  const [linkForm, setLinkForm] = useState({
    id: '',
    title: '',
    subtitle: '',
    type: 'whatsapp', // 'whatsapp' | 'internal' | 'external'
    url: '',
    waMessage: '',
    icon: 'whatsapp',
    emoji: '💬',
    styleVariant: 'emerald',
    badgeText: '',
    isActive: true,
  });

  // Ambil konfigurasi saat pertama kali dimuat
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await getLinksConfig();
        setConfig(data);
      } catch (err) {
        console.error(err);
        toast.error('Gagal memuat pengaturan Linktree');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Simpan perubahan ke Firestore & LocalStorage
  const handleSave = async () => {
    try {
      setSaving(true);
      await updateLinksConfig(config);
      toast.success('Pengaturan Linktree berhasil disimpan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan ke server: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Reset ke pengaturan bawaan
  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset seluruh pengaturan Linktree kembali ke format awal? Perubahan belum tersimpan akan ditimpa.')) {
      setConfig(JSON.parse(JSON.stringify(DEFAULT_LINKS_CONFIG)));
      toast.success('Pengaturan dikembalikan ke format awal.');
    }
  };

  // Buka modal tambah tautan baru
  const handleOpenAddModal = () => {
    setEditingIndex(null);
    setLinkForm({
      id: 'link_' + Date.now(),
      title: '',
      subtitle: '',
      type: 'whatsapp',
      url: '',
      waMessage: config.socials?.whatsappDefaultMsg || '',
      icon: 'whatsapp',
      emoji: '💬',
      styleVariant: 'emerald',
      badgeText: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  // Buka modal edit tautan
  const handleOpenEditModal = (idx) => {
    setEditingIndex(idx);
    const item = config.links[idx];
    setLinkForm({ ...item });
    setModalOpen(true);
  };

  // Simpan formulir modal (tambah / edit)
  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!linkForm.title.trim()) {
      toast.error('Judul tombol tidak boleh kosong');
      return;
    }

    const updatedLinks = [...config.links];
    if (editingIndex !== null) {
      updatedLinks[editingIndex] = { ...linkForm };
    } else {
      updatedLinks.push({ ...linkForm, id: linkForm.id || 'link_' + Date.now() });
    }

    setConfig({ ...config, links: updatedLinks });
    setModalOpen(false);
    toast.success(editingIndex !== null ? 'Tombol diperbarui' : 'Tombol berhasil ditambahkan');
  };

  // Hapus tombol
  const handleDeleteLink = (idx) => {
    const item = config.links[idx];
    if (window.confirm(`Hapus tombol "${item.title}"?`)) {
      const updatedLinks = config.links.filter((_, i) => i !== idx);
      setConfig({ ...config, links: updatedLinks });
      toast.success('Tombol dihapus');
    }
  };

  // Geser posisi tombol (Naik/Turun)
  const handleMoveLink = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= config.links.length) return;

    const updatedLinks = [...config.links];
    const temp = updatedLinks[idx];
    updatedLinks[idx] = updatedLinks[newIdx];
    updatedLinks[newIdx] = temp;

    setConfig({ ...config, links: updatedLinks });
  };

  // Toggle aktif/nonaktif tombol
  const handleToggleActive = (idx) => {
    const updatedLinks = [...config.links];
    updatedLinks[idx] = {
      ...updatedLinks[idx],
      isActive: !updatedLinks[idx].isActive,
    };
    setConfig({ ...config, links: updatedLinks });
  };

  // Helper untuk membuat link WA pada live preview
  const getWaPreviewLink = (msg) => {
    const cleanNumber = (config.socials?.whatsappNumber || '6285121009699').replace(/\D/g, '');
    const encoded = encodeURIComponent(msg || config.socials?.whatsappDefaultMsg || '');
    return `https://wa.me/${cleanNumber}?text=${encoded}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Memuat Pengaturan Linktree...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header Halaman & Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-200/80 p-5 rounded-2xl border border-white/5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔗</span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Kelola Linktree & Bio Publik
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Kustomisasi tampilan tautan bio resmi Fitbay.id yang diakses pembeli di Instagram, TikTok, dan WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/links"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
            title="Buka halaman publik di tab baru"
          >
            <span>Buka /links</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>

          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 text-xs font-semibold transition-all cursor-pointer"
            title="Kembalikan semua ke setelan default"
          >
            Reset Default
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Layout Split Screen: Editor di Kiri, Live Mobile Mockup di Kanan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================ */}
        {/* KOLOM KIRI: TABS & FORM PENGATURAN (7 Kolom di Desktop)      */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('links')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === 'links'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>🔘</span>
              <span>Daftar Tombol ({config.links.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>🏪</span>
              <span>Profil & Banner</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('socials')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === 'socials'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>💬</span>
              <span>Kontak & Medsos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('footer')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === 'footer'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>⏰</span>
              <span>Footer & Garansi</span>
            </button>
          </div>

          {/* ========================================================== */}
          {/* TAB 1: KELOLA DAFTAR TOMBOL                                */}
          {/* ========================================================== */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Urutan Tombol Linktree</h3>
                  <p className="text-xs text-gray-400">
                    Atur tombol yang tampil di halaman Linktree. Anda dapat menambah, menyembunyikan, atau mengubah urutannya.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Tambah Tombol</span>
                </button>
              </div>

              {/* List Tombol */}
              <div className="space-y-2.5">
                {config.links.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      item.isActive
                        ? 'bg-surface-200/90 border-white/10 hover:border-white/20'
                        : 'bg-surface-200/40 border-white/5 opacity-60'
                    }`}
                  >
                    {/* Sisi Kiri: Drag Handle / Urutan & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Kontrol Naik / Turun */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveLink(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title="Pindah ke atas"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveLink(idx, 1)}
                          disabled={idx === config.links.length - 1}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title="Pindah ke bawah"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>

                      {/* Ikon Emoji Preview */}
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {item.emoji || '🔗'}
                      </div>

                      {/* Judul & Detail */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {item.title}
                          </span>
                          {item.badgeText && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                              {item.badgeText}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-gray-400 border border-white/5 uppercase">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {item.subtitle || item.url || (item.type === 'whatsapp' ? 'Direct WhatsApp' : '')}
                        </p>
                      </div>
                    </div>

                    {/* Sisi Kanan: Toggle Aktif, Edit & Hapus */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle Aktif */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(idx)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          item.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                        }`}
                        title={item.isActive ? 'Klik untuk sembunyikan' : 'Klik untuk tampilkan'}
                      >
                        {item.isActive ? 'Aktif' : 'Sembunyi'}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(idx)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                        title="Edit Tombol"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>

                      {/* Hapus Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(idx)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 transition-all cursor-pointer"
                        title="Hapus Tombol"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: PROFIL & BANNER PENGUMUMAN                          */}
          {/* ========================================================== */}
          {activeTab === 'profile' && (
            <div className="bg-surface-200/80 p-5 rounded-2xl border border-white/5 space-y-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🏪</span> Identitas Profil Toko
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Nama Toko
                  </label>
                  <input
                    type="text"
                    value={config.profile?.storeName || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, storeName: e.target.value },
                      })
                    }
                    placeholder="Contoh: Fitbay.id"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={config.profile?.tagline || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, tagline: e.target.value },
                      })
                    }
                    placeholder="Contoh: Thrift & Preloved Curated Store ✨"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Deskripsi / Bio Singkat
                </label>
                <textarea
                  rows={2}
                  value={config.profile?.description || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      profile: { ...config.profile, description: e.target.value },
                    })
                  }
                  placeholder="Keterangan singkat tentang toko..."
                  className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  URL Gambar Logo / Avatar (Opsional)
                </label>
                <input
                  type="text"
                  value={config.profile?.avatarUrl || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      profile: { ...config.profile, avatarUrl: e.target.value },
                    })
                  }
                  placeholder="Kosongkan jika ingin memakai logo bawaan /logo.png"
                  className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Masukkan direct link gambar (PNG/JPG). Jika dikosongkan, logo default Fitbay.id akan digunakan.
                </p>
              </div>

              {/* Status Badge */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Status Online Badge (Paling Atas)</span>
                  <input
                    type="checkbox"
                    id="showStatusBadge"
                    checked={config.profile?.showStatusBadge ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        profile: { ...config.profile, showStatusBadge: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
                {config.profile?.showStatusBadge && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Teks Status Online
                    </label>
                    <input
                      type="text"
                      value={config.profile?.statusBadgeText || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          profile: { ...config.profile, statusBadgeText: e.target.value },
                        })
                      }
                      placeholder="Online & Fast Response"
                      className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Banner Pengumuman */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Banner Pengumuman / Drop Alert</span>
                  <input
                    type="checkbox"
                    id="announcementEnabled"
                    checked={config.announcement?.enabled ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        announcement: { ...config.announcement, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {config.announcement?.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Ikon / Emoji
                      </label>
                      <input
                        type="text"
                        value={config.announcement?.icon || '🔥'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            announcement: { ...config.announcement, icon: e.target.value },
                          })
                        }
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-center text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Teks Pengumuman
                      </label>
                      <input
                        type="text"
                        value={config.announcement?.text || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            announcement: { ...config.announcement, text: e.target.value },
                          })
                        }
                        placeholder="Contoh: 🔥 Drop Koleksi Baru Setiap Minggu!"
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: MEDIA SOSIAL & KONTAK WHATSAPP                      */}
          {/* ========================================================== */}
          {activeTab === 'socials' && (
            <div className="bg-surface-200/80 p-5 rounded-2xl border border-white/5 space-y-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💬</span> Kontak Utama & Tautan Media Sosial
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Nomor WhatsApp Admin Toko
                  </label>
                  <input
                    type="text"
                    value={config.socials?.whatsappNumber || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, whatsappNumber: e.target.value },
                      })
                    }
                    placeholder="Contoh: 6285121009699"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Awali dengan kode negara 62 (tanpa tanda + atau spasi).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Template Pesan WhatsApp Default
                  </label>
                  <input
                    type="text"
                    value={config.socials?.whatsappDefaultMsg || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, whatsappDefaultMsg: e.target.value },
                      })
                    }
                    placeholder="Halo Admin Fitbay.id! Saya mau order..."
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Tautan Channel & Marketplace
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Link Instagram
                  </label>
                  <input
                    type="text"
                    value={config.socials?.instagramUrl || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, instagramUrl: e.target.value },
                      })
                    }
                    placeholder="https://instagram.com/fitbay.id"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Link TikTok
                  </label>
                  <input
                    type="text"
                    value={config.socials?.tiktokUrl || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, tiktokUrl: e.target.value },
                      })
                    }
                    placeholder="https://tiktok.com/@fitbay.id"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Link Shopee / Marketplace (Opsional)
                  </label>
                  <input
                    type="text"
                    value={config.socials?.shopeeUrl || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, shopeeUrl: e.target.value },
                      })
                    }
                    placeholder="https://shopee.co.id/fitbay.id"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: FOOTER, JAM OPERASIONAL & GARANSI                   */}
          {/* ========================================================== */}
          {activeTab === 'footer' && (
            <div className="bg-surface-200/80 p-5 rounded-2xl border border-white/5 space-y-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⏰</span> Informasi Footer & Jaminan Toko
              </h3>

              {/* Kartu Jam Operasional */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Kartu Jam Operasional</span>
                  <input
                    type="checkbox"
                    checked={config.footer?.showHoursBadge ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        footer: { ...config.footer, showHoursBadge: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
                {config.footer?.showHoursBadge && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        value={config.footer?.hoursLabel || 'Jam Operasional'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            footer: { ...config.footer, hoursLabel: e.target.value },
                          })
                        }
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Nilai Jam
                      </label>
                      <input
                        type="text"
                        value={config.footer?.hoursValue || '09:00 - 22:00 WITA'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            footer: { ...config.footer, hoursValue: e.target.value },
                          })
                        }
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Kartu Garansi */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Kartu Kepercayaan & Garansi</span>
                  <input
                    type="checkbox"
                    checked={config.footer?.showGuaranteeBadge ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        footer: { ...config.footer, showGuaranteeBadge: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
                {config.footer?.showGuaranteeBadge && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        value={config.footer?.guaranteeLabel || '100% Aman & Terpercaya'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            footer: { ...config.footer, guaranteeLabel: e.target.value },
                          })
                        }
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Keterangan
                      </label>
                      <input
                        type="text"
                        value={config.footer?.guaranteeValue || 'Garansi Sesuai Foto'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            footer: { ...config.footer, guaranteeValue: e.target.value },
                          })
                        }
                        className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Teks Copyright */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Teks Nama di Copyright Footer
                </label>
                <input
                  type="text"
                  value={config.footer?.copyrightText || 'Fitbay.id'}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, copyrightText: e.target.value },
                    })
                  }
                  className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* KOLOM KANAN: LIVE SMARTPHONE MOCKUP PREVIEW (5 Kolom)        */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <span>📱</span>
              <span>Live Mobile Preview</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 animate-pulse">
              Real-time
            </span>
          </div>

          {/* Device Mockup Shell */}
          <div className="w-full max-w-[340px] mx-auto bg-[#0a0c0e] rounded-[42px] p-3 shadow-2xl border-4 border-white/10 relative overflow-hidden ring-1 ring-white/5">
            {/* Notch / Dynamic Island */}
            <div className="w-24 h-4 bg-black rounded-full mx-auto mb-3 shadow-inner flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-[#15171a] rounded-full mr-2" />
              <div className="w-1.5 h-1.5 bg-blue-900/60 rounded-full" />
            </div>

            {/* Screen Content Preview */}
            <div className="bg-[#0d0f12] text-white rounded-[32px] p-4 max-h-[580px] overflow-y-auto scrollbar-none font-sans flex flex-col items-center select-none text-left">
              {/* Online status badge */}
              {config.profile?.showStatusBadge && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-emerald-400 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>{config.profile?.statusBadgeText || 'Online'}</span>
                </div>
              )}

              {/* Avatar & Store Info */}
              <div className="flex flex-col items-center text-center mb-4">
                <div className="relative mb-2">
                  <img
                    src={config.profile?.avatarUrl || '/logo.png'}
                    alt="Logo"
                    className="w-16 h-16 rounded-full object-cover border border-white/20 bg-surface-200"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://ui-avatars.com/api/?name=Fitbay+Id&background=10B981&color=fff&size=128';
                    }}
                  />
                  <div className="absolute bottom-0 right-0 bg-emerald-500 text-black p-0.5 rounded-full border border-[#0d0f12]">
                    <svg className="w-2.5 h-2.5 fill-current text-black" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-base font-black text-white leading-tight">
                  {config.profile?.storeName || 'Fitbay.id'}
                  <span className="text-emerald-400">.</span>
                </h2>

                <p className="text-[10px] font-semibold text-emerald-400 mt-0.5">
                  {config.profile?.tagline || 'Thrift Store'}
                </p>

                <p className="text-[9px] text-gray-400 mt-1 max-w-[220px] leading-relaxed line-clamp-2">
                  {config.profile?.description}
                </p>
              </div>

              {/* Announcement */}
              {config.announcement?.enabled && config.announcement?.text && (
                <div className="w-full mb-3 p-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-purple-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <span className="text-xs">{config.announcement?.icon || '🔥'}</span>
                  <p className="text-[9px] text-gray-200 font-medium leading-tight truncate">
                    {config.announcement?.text}
                  </p>
                </div>
              )}

              {/* Buttons List */}
              <div className="w-full space-y-2">
                {config.links
                  .filter((l) => l.isActive)
                  .map((item, idx) => {
                    const variant = STYLE_VARIANTS.find((v) => v.id === item.styleVariant) || STYLE_VARIANTS[1];
                    const isGradient = item.styleVariant !== 'dark';

                    return (
                      <div
                        key={item.id || idx}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                          isGradient
                            ? `bg-gradient-to-r ${variant.bgClass} shadow-md`
                            : 'bg-surface-200/90 border-white/10 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-sm shrink-0">
                            {item.emoji || '💬'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold block leading-tight truncate">
                                {item.title}
                              </span>
                              {item.badgeText && (
                                <span className="text-[8px] px-1 py-0.2 rounded-full bg-white/20 font-semibold uppercase">
                                  {item.badgeText}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-gray-300/80 block leading-tight truncate">
                              {item.subtitle || 'Klik untuk akses'}
                            </span>
                          </div>
                        </div>

                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    );
                  })}
              </div>

              {/* Footer Preview */}
              <div className="w-full mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-1.5">
                {config.footer?.showHoursBadge && (
                  <div className="p-1.5 rounded-lg bg-white/5 text-center">
                    <span className="text-[8px] block font-bold text-gray-300">⏰ {config.footer?.hoursLabel}</span>
                    <span className="text-[7px] text-gray-400">{config.footer?.hoursValue}</span>
                  </div>
                )}
                {config.footer?.showGuaranteeBadge && (
                  <div className="p-1.5 rounded-lg bg-white/5 text-center">
                    <span className="text-[8px] block font-bold text-gray-300">🛡️ {config.footer?.guaranteeLabel}</span>
                    <span className="text-[7px] text-gray-400">{config.footer?.guaranteeValue}</span>
                  </div>
                )}
              </div>

              <span className="text-[8px] text-gray-600 mt-3">
                © {new Date().getFullYear()} {config.footer?.copyrightText || 'Fitbay.id'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL TAMBAH / EDIT TOMBOL                                     */}
      {/* ============================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-200 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              {editingIndex !== null ? 'Edit Tombol Link' : 'Tambah Tombol Link Baru'}
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Sesuaikan judul, aksi tujuan, ikon emoji, dan warna tampilan tombol.
            </p>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Judul Utama */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Judul Tombol <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={linkForm.title}
                  onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                  placeholder="Contoh: Chat WhatsApp (Admin Order)"
                  className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Subjudul */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Subjudul / Deskripsi Pendek
                </label>
                <input
                  type="text"
                  value={linkForm.subtitle}
                  onChange={(e) => setLinkForm({ ...linkForm, subtitle: e.target.value })}
                  placeholder="Contoh: Tanya stok, katalog terbaru & pemesanan"
                  className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Tipe Aksi */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Tipe Aksi Tombol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'whatsapp', label: '💬 WhatsApp' },
                    { id: 'internal', label: '🏠 Internal' },
                    { id: 'external', label: '🌐 Eksternal' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setLinkForm({ ...linkForm, type: t.id })}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        linkForm.type === t.id
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kondisional Input berdasarkan Tipe */}
              {linkForm.type === 'whatsapp' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Template Pesan WhatsApp Otomatis
                  </label>
                  <textarea
                    rows={2}
                    value={linkForm.waMessage}
                    onChange={(e) => setLinkForm({ ...linkForm, waMessage: e.target.value })}
                    placeholder="Halo Admin Fitbay.id! Saya mau..."
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Pesan ini akan otomatis terisi saat pembeli menekan tombol WhatsApp.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Target URL / Rute Halaman
                  </label>
                  <input
                    type="text"
                    value={linkForm.url}
                    onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                    placeholder={linkForm.type === 'internal' ? 'Contoh: /testimoni atau /cek-barang' : 'Contoh: https://instagram.com/fitbay.id'}
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              {/* Pilihan Ikon Emoji */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Pilih Ikon / Emoji Tombol
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ICON_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLinkForm({ ...linkForm, icon: p.id, emoji: p.emoji })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 border transition-all cursor-pointer ${
                        linkForm.emoji === p.emoji
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                          : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Atau ketik emoji kustom:</span>
                  <input
                    type="text"
                    value={linkForm.emoji}
                    onChange={(e) => setLinkForm({ ...linkForm, emoji: e.target.value })}
                    className="w-14 bg-surface-100 border border-white/10 rounded-lg px-2 py-1 text-xs text-center text-white"
                  />
                </div>
              </div>

              {/* Pilihan Gaya Warna / Varian */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Varian Warna Tombol
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STYLE_VARIANTS.map((sv) => (
                    <button
                      key={sv.id}
                      type="button"
                      onClick={() => setLinkForm({ ...linkForm, styleVariant: sv.id })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        linkForm.styleVariant === sv.id
                          ? 'border-white ring-2 ring-emerald-500/50 bg-white/10'
                          : 'border-white/5 hover:border-white/20 bg-white/5'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${sv.bgClass} shrink-0`} />
                      <span className="text-[11px] font-medium text-gray-200 truncate">
                        {sv.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Badge Text & Status Aktif */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Label Badge Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={linkForm.badgeText}
                    onChange={(e) => setLinkForm({ ...linkForm, badgeText: e.target.value })}
                    placeholder="Contoh: BARU, POPULER, PROMO"
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

                <div className="flex items-center gap-2 sm:pt-6">
                  <input
                    type="checkbox"
                    id="linkActiveCheck"
                    checked={linkForm.isActive}
                    onChange={(e) => setLinkForm({ ...linkForm, isActive: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="linkActiveCheck" className="text-xs font-semibold text-gray-300 cursor-pointer">
                    Aktifkan tombol ini di Linktree
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  {editingIndex !== null ? 'Perbarui Tombol' : 'Tambahkan Tombol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
