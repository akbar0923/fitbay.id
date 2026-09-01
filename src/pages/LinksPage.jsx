import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function LinksPage() {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [linksConfig, setLinksConfig] = useState({
    storeName: 'Fitbay.id',
    tagline: 'Thrift & Preloved Curated Store ✨',
    description: 'Pilihan baju thrift & preloved berkualitas tinggi. Fast response, aman, dan siap kirim ke seluruh Indonesia.',
    whatsappNumber: '6281350907489',
    whatsappMessage: 'Halo Admin Fitbay.id! Saya mau tanya seputar produk katalog preloved...',
    whatsappTitipMessage: 'Halo Admin Fitbay.id! Saya ingin titip jual / konsinyasi barang preloved saya...',
    instagramUrl: 'https://instagram.com/fitbay.id',
    tiktokUrl: 'https://tiktok.com/@fitbay.id',
    shopeeUrl: '',
    announcement: '🔥 Drop Koleksi Baru Setiap Minggu! Cek barang sekarang sebelum kehabisan.',
  });

  // Ambil konfigurasi dinamis jika sudah pernah disimpan admin di Firestore
  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'links_page'));
        if (snap.exists()) {
          setLinksConfig((prev) => ({ ...prev, ...snap.data() }));
        }
      } catch (err) {
        console.warn('Menggunakan konfigurasi default linktree:', err);
      }
    }
    loadConfig();
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Fitbay.id - Linktree Official',
          text: 'Official Links & WhatsApp Fitbay.id Preloved Store',
          url: url,
        });
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWaLink = (msg) => {
    const cleanNumber = (linksConfig.whatsappNumber || '6281350907489').replace(/\D/g, '');
    const encodedMsg = encodeURIComponent(msg || linksConfig.whatsappMessage);
    return `https://wa.me/${cleanNumber}?text=${encodedMsg}`;
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-x-hidden selection:bg-emerald-500 selection:text-black font-sans">
      {/* Background Glow Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-emerald-500/15 via-purple-500/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 -left-20 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Bar Floating Actions */}
      <div className="w-full max-w-md flex items-center justify-between py-2 mb-2 z-10">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-medium text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Online & Fast Response</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQr(true)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all backdrop-blur-md active:scale-95 cursor-pointer"
            title="Tampilkan QR Code"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75ZM6.75 16.5h.008v.008H6.75V16.5ZM16.5 6.75h.008v.008H16.5V6.75ZM13.5 13.5h.008v.008H13.5V13.5ZM13.5 19.5h.008v.008H13.5V19.5ZM19.5 13.5h.008v.008H19.5V13.5ZM19.5 19.5h.008v.008H19.5V19.5ZM16.5 16.5h.008v.008H16.5V16.5Z" />
            </svg>
          </button>
          <button
            onClick={handleShare}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all backdrop-blur-md active:scale-95 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Bagikan Tautan"
          >
            {copied ? (
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="w-full max-w-md flex flex-col items-center z-10 transition-all duration-300">
        {/* Profile Card Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-purple-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse" />
            <img
              src="/logo.png"
              alt="Fitbay.id Logo"
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-white/20 bg-surface-200 shadow-2xl"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://ui-avatars.com/api/?name=Fitbay+Id&background=10B981&color=fff&size=128';
              }}
            />
            <div className="absolute bottom-1 right-1 bg-emerald-500 text-black p-1 rounded-full border-2 border-[#0d0f12] shadow-md" title="Official Verified">
              <svg className="w-3.5 h-3.5 fill-current text-black" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
            {linksConfig.storeName}
            <span className="text-emerald-400">.</span>
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1">
            <span>✨</span>
            <span>{linksConfig.tagline}</span>
          </p>

          <p className="text-xs text-gray-400 mt-2 max-w-xs leading-relaxed px-2">
            {linksConfig.description}
          </p>
        </div>

        {/* Announcement Banner */}
        {linksConfig.announcement && (
          <div className="w-full mb-5 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-purple-500/10 border border-emerald-500/20 backdrop-blur-md flex items-center gap-2.5 shadow-lg shadow-emerald-500/5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 text-base">
              🔥
            </div>
            <p className="text-xs text-gray-200 font-medium leading-snug">
              {linksConfig.announcement}
            </p>
          </div>
        )}

        {/* Action Buttons List */}
        <div className="w-full space-y-3.5">
          {/* PRIMARY CTA: WhatsApp Order / Tanya Katalog */}
          <a
            href={getWaLink(linksConfig.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white font-bold shadow-xl shadow-emerald-600/25 border border-emerald-400/40 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-black/20 text-white backdrop-blur-md">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.974.531 1.802.78 2.796.78 3.18 0 5.767-2.586 5.768-5.766 0-3.18-2.587-5.766-5.768-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.748 0-3.385-.45-4.819-1.239l-5.181 1.359 1.385-5.06c-.854-1.488-1.385-3.212-1.385-5.06 0-5.518 4.482-10 10-10s10 4.482 10 10z"/>
                </svg>
              </div>
              <div className="text-left">
                <span className="text-sm sm:text-base font-extrabold block tracking-tight">
                  Chat WhatsApp (Admin Order)
                </span>
                <span className="text-[11px] font-normal text-emerald-100 block">
                  Tanya stok, katalog terbaru & pemesanan
                </span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </a>

          {/* SECONDARY CTA: Titip Jual / Konsinyasi */}
          <a
            href={getWaLink(linksConfig.whatsappTitipMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-4 rounded-2xl bg-surface-200/90 hover:bg-surface-200 border border-white/10 hover:border-emerald-500/40 text-gray-200 hover:text-white transition-all duration-300 shadow-md backdrop-blur-md hover:scale-[1.01] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors text-lg">
                🤝
              </div>
              <div className="text-left">
                <span className="text-sm font-bold block">
                  Titip Jual Barang (Konsinyasi)
                </span>
                <span className="text-[11px] text-gray-400 block">
                  Punya baju preloved bagus? Titip jual di Fitbay.id
                </span>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>

          {/* SOCIAL & CATALOG CHANNELS */}
          {linksConfig.instagramUrl && (
            <a
              href={linksConfig.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-4 rounded-2xl bg-surface-200/90 hover:bg-surface-200 border border-white/10 hover:border-pink-500/40 text-gray-200 hover:text-white transition-all duration-300 shadow-md backdrop-blur-md hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">
                    Instagram Official
                  </span>
                  <span className="text-[11px] text-gray-400 block">
                    @fitbay.id • Feed katalog, review & jadwal drop
                  </span>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-pink-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}

          {linksConfig.tiktokUrl && (
            <a
              href={linksConfig.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-4 rounded-2xl bg-surface-200/90 hover:bg-surface-200 border border-white/10 hover:border-cyan-500/40 text-gray-200 hover:text-white transition-all duration-300 shadow-md backdrop-blur-md hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.86-4.47V8.62a8.27 8.27 0 0 0 4.91 1.6V6.78a4.81 4.81 0 0 1-1-.09z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">
                    TikTok Live & Video
                  </span>
                  <span className="text-[11px] text-gray-400 block">
                    Spill detail barang & info flash sale
                  </span>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}

          {linksConfig.shopeeUrl && (
            <a
              href={linksConfig.shopeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-4 rounded-2xl bg-surface-200/90 hover:bg-surface-200 border border-white/10 hover:border-orange-500/40 text-gray-200 hover:text-white transition-all duration-300 shadow-md backdrop-blur-md hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 transition-colors text-lg">
                  🛍️
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">
                    Shopee Official
                  </span>
                  <span className="text-[11px] text-gray-400 block">
                    Order via Shopee dengan gratis ongkir
                  </span>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>

        {/* Operating Hours & Guarantee Badges */}
        <div className="w-full mt-6 grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm text-center flex flex-col items-center justify-center">
            <span className="text-base mb-1">⏰</span>
            <span className="text-[11px] font-bold text-gray-200">Jam Operasional</span>
            <span className="text-[10px] text-gray-400">09:00 - 22:00 WITA</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm text-center flex flex-col items-center justify-center">
            <span className="text-base mb-1">🛡️</span>
            <span className="text-[11px] font-bold text-gray-200">100% Aman & Terpercaya</span>
            <span className="text-[10px] text-gray-400">Garansi Sesuai Foto</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-6 mt-4 border-t border-white/5 z-10 flex flex-col items-center gap-2">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()}{' '}
          <span className="text-gray-300 font-semibold">{linksConfig.storeName}</span>. All rights reserved.
        </p>
        <Link
          to="/login"
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          Staff & Admin Portal 🔐
        </Link>
      </footer>

      {/* QR Code Modal Popup */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-200 border border-white/10 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl relative">
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-base font-bold text-white mb-1">Scan QR Code</h3>
            <p className="text-xs text-gray-400 mb-4">
              Scan untuk membuka tautan WhatsApp & Linktree Fitbay.id
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  window.location.href
                )}&color=0d0f12&bgcolor=ffffff&margin=1`}
                alt="QR Code Fitbay.id"
                className="w-44 h-44 object-contain"
              />
            </div>

            <button
              onClick={copyToClipboard}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>Tautan Tersalin!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  <span>Salin Tautan</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
