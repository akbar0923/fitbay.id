import { useState, useEffect } from 'react';
import logoImg from '../../assets/logo.png';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Cek apakah sudah di-install / mode standalone
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // Cek apakah pengguna sudah menutup prompt baru-baru ini
    const dismissedUntil = localStorage.getItem('fitbay_pwa_prompt_dismissed');
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      return;
    }

    // Deteksi iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    
    if (isIosDevice && isSafari && !isStandaloneMode) {
      setIsIOS(true);
      // Tampilkan banner iOS setelah jeda 3 detik
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome / Chromium event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Munculkan prompt setelah jeda 2 detik
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Tunda kemunculan prompt selama 7 hari jika ditutup
    localStorage.setItem(
      'fitbay_pwa_prompt_dismissed',
      (Date.now() + 7 * 24 * 60 * 60 * 1000).toString()
    );
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-slide-up">
      <div className="dark:bg-surface-200/95 bg-white/95 backdrop-blur-xl border dark:border-white/10 border-gray-200 p-4 rounded-2xl shadow-2xl flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <img
            src={logoImg}
            alt="Fitbay.id"
            className="w-11 h-11 rounded-xl bg-[#F5F3EF] p-1 shadow-sm object-contain shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold dark:text-white text-gray-900 leading-tight">
              Install Aplikasi Fitbay.id
            </h4>
            <p className="text-xs dark:text-gray-400 text-gray-500 mt-0.5">
              Pasang di layar utama HP untuk akses lebih cepat, layar penuh & praktis!
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
            title="Tutup"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isIOS ? (
          <div className="dark:bg-white/5 bg-gray-100 p-2.5 rounded-xl text-xs dark:text-gray-300 text-gray-700 flex items-center gap-2">
            <span>💡</span>
            <span>
              Di iPhone: Tekan tombol <strong>Share</strong> (ikon kotak tanda panah atas), lalu pilih <strong>"Add to Home Screen"</strong>.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Install Sekarang</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2 px-3 rounded-xl dark:bg-white/5 bg-gray-100 dark:text-gray-400 text-gray-600 font-medium text-xs hover:dark:bg-white/10 hover:bg-gray-200 transition-colors"
            >
              Nanti Saja
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
