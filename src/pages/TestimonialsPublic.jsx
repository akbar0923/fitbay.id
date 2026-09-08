import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getPublicTestimonials, submitPublicTestimonial } from '../firebase/testimonialService';
import logoImg from '../assets/logo.png';
import toast from 'react-hot-toast';

const COOLDOWN_KEY = 'fitbay_testimonial_last_sent';
const COOLDOWN_DURATION_MS = 10 * 60 * 1000; // 10 menit

export default function TestimonialsPublic() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination / Load More
  const ITEMS_PER_PAGE = 9;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [form, setForm] = useState({
    namaPembeli: '',
    rating: 5,
    namaBarang: '',
    isiTestimoni: '',
    fotoUrl: '',
    honeypot: '', // honeypot trap
  });
  const [hoverRating, setHoverRating] = useState(0);

  // Modal Image Preview
  const [previewImage, setPreviewImage] = useState(null);

  // Fetch approved testimonials
  const loadTestimonials = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPublicTestimonials();
      setTestimonials(data);
    } catch (err) {
      console.error('Gagal mengambil testimoni:', err);
      setError('Gagal memuat testimoni. Silakan segarkan halaman.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Testimoni & Ulasan Pembeli — Fitbay.id';
    loadTestimonials();
  }, []);

  // Summary statistics
  const stats = useMemo(() => {
    const total = testimonials.length;
    if (total === 0) return { avg: 5.0, total: 0, count5: 0, percentage5: 100 };
    const sum = testimonials.reduce((acc, t) => acc + (Number(t.rating) || 5), 0);
    const avg = (sum / total).toFixed(1);
    const count5 = testimonials.filter((t) => Number(t.rating) >= 5).length;
    const percentage5 = Math.round((count5 / total) * 100);
    return { avg, total, count5, percentage5 };
  }, [testimonials]);

  // Compressed Image Handler (Canvas WebP/JPEG max 200KB)
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Kompres ke WebP/JPEG ringan
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setForm((prev) => ({ ...prev, fotoUrl: compressedDataUrl }));
        toast.success('Foto berhasil dilampirkan');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Honeypot check
    if (form.honeypot) {
      console.warn('Bot submission blocked via honeypot.');
      return;
    }

    // 2. Cooldown check
    const lastSent = localStorage.getItem(COOLDOWN_KEY);
    if (lastSent) {
      const timePassed = Date.now() - Number(lastSent);
      if (timePassed < COOLDOWN_DURATION_MS) {
        const remainingMinutes = Math.ceil((COOLDOWN_DURATION_MS - timePassed) / (60 * 1000));
        toast.error(`Mohon tunggu ${remainingMinutes} menit lagi sebelum mengirim ulasan baru.`);
        return;
      }
    }

    // 3. Validation
    const nama = form.namaPembeli.trim();
    const isi = form.isiTestimoni.trim();

    if (nama.length < 2) {
      toast.error('Nama pembeli minimal 2 karakter');
      return;
    }
    if (isi.length < 5) {
      toast.error('Isi ulasan minimal 5 karakter');
      return;
    }

    setSubmitting(true);
    try {
      await submitPublicTestimonial({
        namaPembeli: nama,
        isiTestimoni: isi,
        rating: form.rating,
        namaBarang: form.namaBarang.trim(),
        fotoUrl: form.fotoUrl,
      });

      // Simpan timestamp cooldown
      localStorage.setItem(COOLDOWN_KEY, Date.now().toString());

      setFormSuccess(true);
      toast.success('Ulasan berhasil dikirim! Menunggu persetujuan admin.');
      setForm({
        namaPembeli: '',
        rating: 5,
        namaBarang: '',
        isiTestimoni: '',
        fotoUrl: '',
        honeypot: '',
      });
    } catch (err) {
      console.error('Error kirim ulasan:', err);
      toast.error(err.message || 'Gagal mengirim ulasan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper render rating stars
  const renderStars = (ratingCount) => {
    const num = Math.round(Number(ratingCount) || 5);
    return (
      <div className="flex items-center gap-1 text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= num ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  // Format date helper
  const formatTanggal = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 relative overflow-x-hidden selection:bg-emerald-500 selection:text-black font-sans">
      {/* Background Glow Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-96 bg-gradient-to-b from-emerald-500/15 via-purple-500/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-5xl flex flex-col items-center z-10">
        {/* Top Bar Navigation */}
        <div className="w-full flex items-center justify-between py-3 mb-6 border-b border-white/5">
          <Link
            to="/links"
            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Kembali ke Linktree</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/cek-barang"
              className="text-xs sm:text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-1.5 rounded-full border border-emerald-500/20"
            >
              Cek Barang Penitip →
            </Link>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-8 flex flex-col items-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-1 bg-gradient-to-tr from-emerald-500 to-purple-500 shadow-xl shadow-emerald-500/20 mb-4 hover:scale-105 transition-transform duration-300">
            <img
              src={logoImg}
              alt="Fitbay.id Logo"
              className="w-full h-full object-cover rounded-[22px] bg-[#16181d]"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Ulasan Asli Pembeli Terverifikasi
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
            Testimoni & Pengalaman Belanja
          </h1>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-lg">
            Kepercayaan Anda adalah prioritas kami. Simak apa kata pelanggan setia tentang kualitas barang thrift & preloved original di <span className="text-emerald-400 font-semibold">Fitbay.id</span>.
          </p>

          {/* Quick Stats Pill */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4 sm:px-8 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 flex items-center gap-1">
                <span>{stats.avg}</span>
                <span className="text-base text-amber-400/80">★</span>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-400">Rata-rata Rating</div>
                <div className="text-[11px] text-emerald-400 font-medium">{stats.percentage5}% Puas Bintang 5</div>
              </div>
            </div>

            <div className="w-px h-8 bg-white/10 hidden sm:block" />

            <div className="text-left">
              <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-gray-400">Total Ulasan Disetujui</div>
            </div>

            <div className="w-px h-8 bg-white/10 hidden sm:block" />

            <button
              onClick={() => {
                setIsFormOpen(true);
                setTimeout(() => {
                  document.getElementById('form-ulasan-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Tulis Ulasan</span>
            </button>
          </div>
        </div>

        {/* Section Form Ulasan Publik (Collapsible) */}
        <div id="form-ulasan-section" className="w-full max-w-2xl mb-12">
          {!isFormOpen ? (
            <div className="text-center">
              <button
                onClick={() => setIsFormOpen(true)}
                className="group w-full p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-emerald-500/40 transition-all duration-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    ✍️
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      Pernah belanja di Fitbay.id?
                    </h3>
                    <p className="text-xs text-gray-400">Bagikan pengalaman Anda dan bantu pembeli lainnya.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                  <span>Beri Ulasan</span>
                  <span>→</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="bg-[#14171d]/90 border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all animate-fadeIn">
              {/* Top Bar Form */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                    ✍️
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Tulis Ulasan Belanja Anda</h2>
                    <p className="text-xs text-gray-400">Ulasan akan ditinjau admin sebelum ditampilkan di web.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Tutup Form"
                >
                  ✕
                </button>
              </div>

              {formSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-3xl flex items-center justify-center mx-auto animate-bounce">
                    ✓
                  </div>
                  <h3 className="text-lg font-bold text-white">Terima Kasih atas Ulasan Anda!</h3>
                  <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
                    Testimoni Anda telah berhasil terkirim dan kini berstatus <span className="text-amber-400 font-semibold">Menunggu Persetujuan</span>. Admin Fitbay.id akan segera meninjaunya agar ulasan Anda segera tampil di sini.
                  </p>
                  <div className="pt-3">
                    <button
                      onClick={() => {
                        setFormSuccess(false);
                        setIsFormOpen(false);
                      }}
                      className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Honeypot field (hidden from real users, caught by bots) */}
                  <div style={{ display: 'none' }} aria-hidden="true">
                    <label htmlFor="website_url_hp">Website</label>
                    <input
                      type="text"
                      id="website_url_hp"
                      name="website_url_hp"
                      value={form.honeypot}
                      onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {/* Rating Stars Input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Rating Kepuasan <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded-xl w-fit">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setForm({ ...form, rating: star })}
                            className="p-1 hover:scale-125 transition-transform"
                            title={`Beri Rating ${star} Bintang`}
                          >
                            <svg
                              className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                                (hoverRating || form.rating) >= star
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-gray-600'
                              }`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-amber-400 ml-2">
                        {form.rating === 5 && '⭐⭐⭐⭐⭐ Sangat Puas!'}
                        {form.rating === 4 && '⭐⭐⭐⭐ Puas'}
                        {form.rating === 3 && '⭐⭐⭐ Cukup'}
                        {form.rating === 2 && '⭐⭐ Kurang'}
                        {form.rating === 1 && '⭐ Sangat Kurang'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Nama Pembeli */}
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Nama Lengkap / Panggilan <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        placeholder="Misal: Kak Rian atau Sarah"
                        value={form.namaPembeli}
                        onChange={(e) => setForm({ ...form, namaPembeli: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      />
                    </div>

                    {/* Nama Barang yang dibeli (Opsional) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Nama Barang yang Dibeli <span className="text-gray-500 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={100}
                        placeholder="Misal: Crewneck Stussy / Hoodie Nike"
                        value={form.namaBarang}
                        onChange={(e) => setForm({ ...form, namaBarang: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Isi Testimoni */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-gray-300">
                        Isi Ulasan / Pengalaman Belanja <span className="text-red-400">*</span>
                      </label>
                      <span className={`text-[11px] ${form.isiTestimoni.length > 450 ? 'text-amber-400' : 'text-gray-500'}`}>
                        {form.isiTestimoni.length}/500 karakter
                      </span>
                    </div>
                    <textarea
                      required
                      rows={3}
                      maxLength={500}
                      placeholder="Ceritakan kondisi barang, kecepatan pengiriman, atau respon admin Fitbay.id..."
                      value={form.isiTestimoni}
                      onChange={(e) => setForm({ ...form, isiTestimoni: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
                    />
                  </div>

                  {/* Foto Barang / Bukti Belanja (Opsional) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Foto Barang / Bukti Belanja <span className="text-gray-500 font-normal">(Opsional)</span>
                    </label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-colors">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Pilih Foto dari Galeri</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>

                      {form.fotoUrl ? (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                          <img
                            src={form.fotoUrl}
                            alt="Preview"
                            className="w-8 h-8 rounded-lg object-cover border border-white/10"
                          />
                          <span className="text-xs text-emerald-400 font-medium">Foto Terpasang</span>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, fotoUrl: '' })}
                            className="text-gray-400 hover:text-red-400 text-xs ml-1"
                            title="Hapus foto"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500">Maksimal 8MB (otomatis dioptimasi).</span>
                      )}
                    </div>
                  </div>

                  {/* Anti-Spam Notice & Submit Button */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Sistem anti-spam aktif (1 ulasan / 10 menit per perangkat).</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl transition-colors"
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-black font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Mengirim...</span>
                          </>
                        ) : (
                          <>
                            <span>Kirim Testimoni</span>
                            <span>→</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Section List of Testimonials */}
        <div className="w-full mb-12">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/10">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span>Daftar Ulasan Pelanggan</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                  {testimonials.length} Ulasan
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">Diurutkan dari testimoni paling baru ke lama.</p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 animate-pulse">Memuat testimoni pelanggan...</p>
            </div>
          ) : error ? (
            <div className="py-12 px-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-md mx-auto">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={loadTestimonials}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl"
              >
                Coba Lagi
              </button>
            </div>
          ) : testimonials.length === 0 ? (
            <div className="py-16 px-6 bg-white/[0.02] border border-white/5 rounded-3xl text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-2xl mx-auto mb-4 text-emerald-400">
                ✨
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Belum Ada Testimoni yang Tampil</h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Jadilah pelanggan pertama yang membagikan pengalaman belanja barang preloved original di Fitbay.id!
              </p>
              <button
                onClick={() => {
                  setIsFormOpen(true);
                  document.getElementById('form-ulasan-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all"
              >
                Tulis Ulasan Sekarang
              </button>
            </div>
          ) : (
            <>
              {/* Testimonials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {testimonials.slice(0, visibleCount).map((item) => {
                  const initial = (item.namaPembeli || 'P').charAt(0).toUpperCase();
                  return (
                    <div
                      key={item.id}
                      className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-emerald-500/30 rounded-2xl p-5 backdrop-blur-sm transition-all duration-300 flex flex-col justify-between group shadow-lg shadow-black/20"
                    >
                      <div>
                        {/* Header Kartu: Avatar, Nama, Tanggal, Rating */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-700 text-black font-black text-base flex items-center justify-center shadow-md flex-shrink-0">
                              {initial}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                                  {item.namaPembeli}
                                </h4>
                                <span
                                  className="w-3.5 h-3.5 text-emerald-400"
                                  title="Pembeli Terverifikasi Fitbay.id"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-400">
                                {formatTanggal(item.tanggal || item.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {renderStars(item.rating)}
                          </div>
                        </div>

                        {/* Nama Barang Tag */}
                        {item.namaBarang && (
                          <div className="mb-2.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-medium text-emerald-400">
                              <span>🏷️</span>
                              <span className="truncate max-w-[200px]">{item.namaBarang}</span>
                            </span>
                          </div>
                        )}

                        {/* Isi Testimoni */}
                        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed italic mb-3 whitespace-pre-line">
                          "{item.isiTestimoni}"
                        </p>
                      </div>

                      {/* Foto Barang / Bukti Belanja jika ada */}
                      {item.fotoUrl && (
                        <div className="pt-2 mt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ url: item.fotoUrl, title: `${item.namaPembeli} - ${item.namaBarang || 'Ulasan'}` })}
                            className="relative group/img overflow-hidden rounded-xl border border-white/10 w-full h-36 bg-black/40 block"
                          >
                            <img
                              src={item.fotoUrl}
                              alt="Foto Testimoni"
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-medium">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                              <span>Perbesar Foto</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {visibleCount < testimonials.length && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 text-white font-semibold text-xs sm:text-sm rounded-2xl transition-all shadow-lg backdrop-blur-md flex items-center gap-2 mx-auto"
                  >
                    <span>Muat Lebih Banyak Ulasan</span>
                    <span className="text-xs text-gray-400">
                      ({visibleCount} dari {testimonials.length})
                    </span>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Call to Action */}
        <div className="w-full bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-teal-500/10 border border-white/10 rounded-3xl p-6 sm:p-8 text-center backdrop-blur-xl mb-8 flex flex-col items-center">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
            Ingin Berbelanja atau Titip Jual di Fitbay.id?
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-5 leading-relaxed">
            Admin kami siap melayani pertanyaan seputar katalog barang preloved pilihan atau prosedur titip jual konsinyasi dengan amanah.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/6285121009699?text=Halo%20Admin%20Fitbay.id!%20Saya%20tertarik%20dengan%20katalog%20barang%20preloved..."
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>Chat WhatsApp Admin</span>
              <span>💬</span>
            </a>
            <Link
              to="/links"
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all"
            >
              Lihat Semua Tautan Bio
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full text-center py-4 border-t border-white/5 text-[11px] text-gray-500">
          © {new Date().getFullYear()} Fitbay.id — Thrift & Preloved Curated Store. All rights reserved.
        </div>
      </div>

      {/* Lightbox / Modal Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-[#14171d] rounded-2xl border border-white/20 p-2 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-xs font-semibold text-gray-300 truncate">{previewImage.title}</span>
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
