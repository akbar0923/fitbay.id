import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useSales } from '../../context/SalesContext';
import toast from 'react-hot-toast';

export default function RequestTestimonialModal({ isOpen, onClose, transaction }) {
  const { updateTransaction } = useSales();
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Generate or reuse kodeTestimoni
  const kodeTestimoni = useMemo(() => {
    if (!transaction) return '';
    if (transaction.kodeTestimoni) return transaction.kodeTestimoni;
    // Format: TESTI-{6 char id/random}
    const shortId = (transaction.id || '').replace(/\D/g, '').slice(-4) || '88';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TESTI-${shortId}${rand}`;
  }, [transaction]);

  if (!transaction) return null;

  const namaPenerima = transaction.namaPenerima || 'Kakak Pembeli';
  const namaBarang = transaction.itemName || 'Barang Preloved';
  const noHp = transaction.noHpPenerima || '';

  // Buat link unik dengan query params
  const origin = window.location.origin;
  const testimonialUrl = `${origin}/testimoni?ref=${encodeURIComponent(kodeTestimoni)}&nama=${encodeURIComponent(namaPenerima)}&barang=${encodeURIComponent(namaBarang)}&trxId=${encodeURIComponent(transaction.id)}`;

  // Buat draft pesan WhatsApp yang ramah dan profesional
  const waMessage = `Halo Kak ${namaPenerima}! Terima kasih banyak sudah berbelanja ${namaBarang} di Fitbay.id 🙏\n\nBoleh minta tolong luangkan waktu 30 detik untuk memberikan ulasan pengalaman belanja Kakak di link resmi kami? Ulasan Kakak sangat berharga bagi kami:\n\n${testimonialUrl}\n\nTerima kasih banyak ya Kak! Sehat selalu ✨`;

  // Helper update status di Firestore
  const ensureStatusUpdated = async () => {
    if (transaction.statusTestimoni !== 'sudah_diisi') {
      try {
        setUpdating(true);
        await updateTransaction(transaction.id, {
          ...transaction,
          kodeTestimoni: kodeTestimoni,
          statusTestimoni: 'sudah_diminta',
        });
      } catch (err) {
        console.error('Gagal update status transaksi:', err);
      } finally {
        setUpdating(false);
      }
    }
  };

  // Salin Link ke Clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(testimonialUrl);
      setCopied(true);
      toast.success('Link ulasan unik berhasil disalin!');
      await ensureStatusUpdated();
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  // Buka WhatsApp
  const handleSendWhatsApp = async () => {
    let cleanPhone = String(noHp).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('62') && cleanPhone.length > 5) {
      cleanPhone = '62' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error('Nomor WhatsApp penerima tidak valid pada transaksi ini.');
      return;
    }

    await ensureStatusUpdated();
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
    window.open(waUrl, '_blank');
    toast.success('Membuka chat WhatsApp pembeli...');
  };

  const isSudahDiisi = transaction.statusTestimoni === 'sudah_diisi';
  const isSudahDiminta = transaction.statusTestimoni === 'sudah_diminta';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minta Testimoni Pembeli">
      <div className="space-y-5">
        {/* Banner Info Transaksi */}
        <div className="p-4 rounded-2xl dark:bg-white/5 bg-gray-50 border dark:border-white/10 border-gray-200 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Penerima Pesanan</span>
            {isSudahDiisi ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span>✓</span>
                <span>Ulasan Sudah Diisi</span>
              </span>
            ) : isSudahDiminta ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <span>⏳</span>
                <span>Sudah Pernah Diminta</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <span>Belum Diminta</span>
              </span>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-base font-bold dark:text-white text-gray-900 flex items-center gap-2">
              <span>{namaPenerima}</span>
              {noHp && <span className="text-xs font-normal text-gray-400 font-mono">({noHp})</span>}
            </p>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span>🏷️</span>
              <span className="truncate">{namaBarang}</span>
            </p>
            <p className="text-[11px] text-gray-400">
              Kode Transaksi: <span className="font-mono text-gray-300">{kodeTestimoni}</span>
            </p>
          </div>
        </div>

        {/* Kotak Link Testimoni Unik */}
        <div>
          <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1.5">
            Link Testimoni Khusus (Nama & Barang Terisi Otomatis)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={testimonialUrl}
              className="w-full text-xs font-mono dark:bg-black/30 bg-gray-100 border dark:border-white/10 border-gray-300 rounded-xl px-3 py-2.5 dark:text-gray-300 text-gray-800 select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              disabled={updating}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'dark:bg-white/10 bg-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 dark:text-white text-gray-800'
              }`}
            >
              <span>{copied ? '✓ Disalin' : '📋 Salin Link'}</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
            Link ini sudah membawa informasi pembeli. Ketika dibuka, form akan langsung terisi nama dan produk tanpa perlu diketik ulang.
          </p>
        </div>

        {/* Preview Pesan WhatsApp */}
        <div>
          <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1.5">
            Draft Pesan WhatsApp ke Pembeli
          </label>
          <div className="p-3 rounded-xl dark:bg-black/20 bg-gray-50 border dark:border-white/5 border-gray-200 text-xs dark:text-gray-300 text-gray-700 whitespace-pre-line leading-relaxed font-sans italic">
            "{waMessage}"
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t dark:border-white/10 border-gray-200">
          <div className="text-[11px] text-gray-400">
            {isSudahDiisi
              ? '✅ Pembeli sudah mengirim ulasan untuk pesanan ini.'
              : 'Status transaksi otomatis ditandai "Sudah Diminta" setelah Anda menyalin atau mengirim link.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Tutup
            </Button>

            {noHp && (
              <button
                onClick={handleSendWhatsApp}
                disabled={updating}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>💬</span>
                <span>Kirim via WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
