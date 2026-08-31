import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { getStoreConfig, updateStoreConfig } from '../../services/storeSettingsService';
import logoImg from '../../assets/logo.png';
import toast from 'react-hot-toast';

export default function ShippingLabelModal({ isOpen, onClose, transaction }) {
  const [storeConfig, setStoreConfig] = useState(getStoreConfig());
  const [printType, setPrintType] = useState('shipping_label'); // 'shipping_label' | 'receipt'
  const [isEditingSender, setIsEditingSender] = useState(false);
  const [senderForm, setSenderForm] = useState({
    storeName: '',
    storePhone: '',
    storeAddress: '',
  });

  useEffect(() => {
    if (isOpen) {
      getStoreConfig().then((cfg) => {
        setStoreConfig(cfg);
        setSenderForm({
          storeName: cfg.storeName || 'Fitbay.id',
          storePhone: cfg.storePhone || '085121009699',
          storeAddress: cfg.storeAddress || 'Jakarta Selatan',
        });
      });
    }
  }, [isOpen]);

  if (!transaction) return null;

  const handleSaveSender = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateStoreConfig({
        ...storeConfig,
        ...senderForm,
      });
      setStoreConfig(updated);
      setIsEditingSender(false);
      toast.success('Data pengirim toko berhasil disimpan!');
    } catch (err) {
      toast.error('Gagal menyimpan data pengirim');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const copyAddressText = () => {
    const text = `Penerima: ${transaction.namaPenerima || '-'}\nNo. HP: ${transaction.noHpPenerima || '-'}\nAlamat: ${transaction.alamatPenerima || '-'}\nEkspedisi: ${transaction.ekspedisi || 'Reguler'}\nBarang: ${transaction.itemName || '-'} (${transaction.kodeBarang || '-'})`;
    navigator.clipboard.writeText(text);
    toast.success('Alamat lengkap berhasil disalin ke clipboard!');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>🖨️ Cetak Dokumen Pengiriman & Transaksi</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-mono font-bold">
            {transaction.kodeBarang || transaction.id?.slice(0, 8)}
          </span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-5">
        {/* Pilihan Format Cetak & Action Salin */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl dark:bg-white/5 bg-gray-100 border dark:border-white/5 border-gray-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintType('shipping_label')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                printType === 'shipping_label'
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'dark:text-gray-400 text-gray-600 hover:dark:text-white'
              }`}
            >
              🏷️ Label Pengiriman (10x15 cm)
            </button>
            <button
              type="button"
              onClick={() => setPrintType('receipt')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                printType === 'receipt'
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'dark:text-gray-400 text-gray-600 hover:dark:text-white'
              }`}
            >
              🧾 Struk / Invoice Penjualan
            </button>
          </div>

          <div className="flex items-center gap-2">
            {transaction.alamatPenerima && (
              <button
                type="button"
                onClick={copyAddressText}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold dark:bg-white/10 bg-gray-200 hover:bg-accent hover:text-white transition-all flex items-center gap-1.5"
                title="Salin Alamat Lengkap"
              >
                <span>📋 Salin Alamat</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditingSender(!isEditingSender)}
              className="text-xs text-accent hover:underline font-medium"
            >
              {isEditingSender ? '✕ Tutup Pengaturan Toko' : '⚙️ Atur Data Toko/Pengirim'}
            </button>
          </div>
        </div>

        {/* Form Edit Pengirim Toko (Jika Dibuka) */}
        {isEditingSender && (
          <form onSubmit={handleSaveSender} className="p-4 rounded-2xl dark:bg-surface-300 bg-gray-50 border border-accent/30 space-y-3 animate-fade-in">
            <h4 className="text-xs font-bold text-accent uppercase tracking-wider">
              Pengaturan Alamat Pengirim Toko (Fitbay.id)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium dark:text-gray-400 text-gray-600 mb-1">Nama Toko Pengirim</label>
                <input
                  type="text"
                  value={senderForm.storeName}
                  onChange={(e) => setSenderForm({ ...senderForm, storeName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl dark:bg-surface-200 bg-white border dark:border-white/10 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium dark:text-gray-400 text-gray-600 mb-1">No. WhatsApp / HP Toko</label>
                <input
                  type="text"
                  value={senderForm.storePhone}
                  onChange={(e) => setSenderForm({ ...senderForm, storePhone: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl dark:bg-surface-200 bg-white border dark:border-white/10 border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium dark:text-gray-400 text-gray-600 mb-1">Alamat Lengkap Toko</label>
              <textarea
                rows={2}
                value={senderForm.storeAddress}
                onChange={(e) => setSenderForm({ ...senderForm, storeAddress: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl dark:bg-surface-200 bg-white border dark:border-white/10 border-gray-300 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingSender(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm">
                Simpan Data Toko
              </Button>
            </div>
          </form>
        )}

        {/* PREVIEW CONTAINER (Yang akan dicetak) */}
        <div className="flex justify-center bg-gray-900/50 p-4 lg:p-6 rounded-3xl overflow-x-auto">
          
          {/* ========================================================================= */}
          {/* 1. LABEL PENGIRIMAN 10x15 CM */}
          {/* ========================================================================= */}
          {printType === 'shipping_label' ? (
            <div
              id="printable-shipping-label"
              className="bg-white text-black p-6 rounded-xl shadow-2xl w-[380px] min-h-[520px] font-sans border-2 border-black flex flex-col justify-between"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {/* Header Label: Logo + Ekspedisi + Channel */}
              <div>
                <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <img src={logoImg} alt="Fitbay.id" className="w-8 h-8 object-contain" />
                    <div>
                      <h2 className="text-base font-black tracking-tight leading-none uppercase">
                        {storeConfig.storeName || 'FITBAY.ID'}
                      </h2>
                      <p className="text-[10px] text-gray-700 font-semibold tracking-wider">
                        PRELOVED & THRIFT
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-block px-2.5 py-1 rounded bg-black text-white font-black text-xs uppercase tracking-wider">
                      {transaction.ekspedisi || 'REGULER'}
                    </div>
                    <p className="text-[10px] text-gray-700 font-bold mt-0.5 uppercase">
                      {transaction.sumberPesanan || 'NON-SHOPEE'}
                    </p>
                  </div>
                </div>

                {/* Section Penerima (Besar & Utama) */}
                <div className="bg-gray-100 p-3 rounded-lg border border-black mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                      KEPADA (PENERIMA):
                    </span>
                    <span className="text-xs font-black font-mono">
                      📞 {transaction.noHpPenerima || '-'}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-black uppercase tracking-tight mb-1">
                    {transaction.namaPenerima || 'PELANGGAN FITBAY'}
                  </h3>
                  <p className="text-xs text-gray-900 font-medium leading-relaxed">
                    {transaction.alamatPenerima || 'Alamat belum diinput'}
                  </p>
                </div>

                {/* Section Pengirim (Kompak) */}
                <div className="p-2.5 rounded-lg border border-gray-400 mb-3 text-[11px]">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold uppercase text-[9px] text-gray-500">DARI (PENGIRIM):</span>
                    <span className="font-bold font-mono text-[10px]">{storeConfig.storePhone || '085121009699'}</span>
                  </div>
                  <p className="font-bold uppercase text-xs">{storeConfig.storeName || 'Fitbay.id'}</p>
                  <p className="text-[10px] text-gray-700 leading-snug">{storeConfig.storeAddress}</p>
                </div>

                {/* Section Rincian Paket */}
                <div className="border border-black rounded-lg p-2.5 mb-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 border-b border-gray-300 pb-1 mb-1.5 uppercase">
                    <span>Isi Paket ({transaction.kodeBarang || 'ITEM'})</span>
                    <span>Qty</span>
                  </div>
                  <div className="flex justify-between items-start text-xs font-bold">
                    <span className="pr-2">{transaction.itemName || '-'}</span>
                    <span className="font-mono">1x</span>
                  </div>
                  {transaction.catatanPengiriman && (
                    <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-300 text-[10px] text-gray-700 font-medium">
                      ⚠️ <span className="font-bold">Instruksi:</span> {transaction.catatanPengiriman}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Label: Barcode Dekoratif & No. Resi */}
              <div className="border-t-2 border-black pt-2 flex items-center justify-between text-[10px]">
                <div>
                  <p className="font-mono font-bold text-xs">{transaction.resi ? `RESI: ${transaction.resi}` : `ORDER: ${transaction.id?.slice(0, 10).toUpperCase()}`}</p>
                  <p className="text-[9px] text-gray-500">{formatDate(transaction.date)}</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-xs">FITBAY.ID</span>
                  <p className="text-[8px] text-gray-500">FRAGILE / JANGAN DIBANTING</p>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. STRUK / INVOICE PENJUALAN */
            /* ========================================================================= */
            <div
              id="printable-receipt"
              className="bg-white text-black p-6 rounded-xl shadow-2xl w-[340px] font-mono text-xs border border-gray-300"
            >
              <div className="text-center border-b border-dashed border-black pb-3 mb-3">
                <img src={logoImg} alt="Fitbay.id" className="w-10 h-10 object-contain mx-auto mb-1" />
                <h3 className="text-sm font-black uppercase">{storeConfig.storeName || 'FITBAY.ID'}</h3>
                <p className="text-[10px] text-gray-600">{storeConfig.storeAddress}</p>
                <p className="text-[10px] text-gray-600">WA: {storeConfig.storePhone || '085121009699'}</p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-black pb-2 mb-2">
                <div className="flex justify-between">
                  <span>No. Transaksi:</span>
                  <span className="font-bold">{transaction.kodeBarang || transaction.id?.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{formatDate(transaction.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sumber:</span>
                  <span className="font-bold">{transaction.sumberPesanan || 'WhatsApp/Direct'}</span>
                </div>
                {transaction.namaPenerima && (
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-bold">{transaction.namaPenerima}</span>
                  </div>
                )}
                {transaction.hostLive && (
                  <div className="flex justify-between">
                    <span>Host Live:</span>
                    <span>{transaction.hostLive}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-black pb-2 mb-2">
                <div className="flex justify-between font-bold mb-1">
                  <span>{transaction.itemName || 'Barang'}</span>
                  <span>{formatCurrency(transaction.sellingPrice)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Kode: {transaction.kodeBarang || '-'}</span>
                  <span>1x</span>
                </div>
              </div>

              {/* Total & Payment */}
              <div className="space-y-1 text-xs border-b border-dashed border-black pb-2 mb-3">
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL BAYAR</span>
                  <span>{formatCurrency(transaction.sellingPrice)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Metode Bayar:</span>
                  <span>{transaction.paymentMethod || 'Transfer Bank'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Status:</span>
                  <span className="font-bold text-emerald-700">LUNAS</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-700 space-y-1">
                <p className="font-bold">~ TERIMA KASIH TELAH BERBELANJA ~</p>
                <p>{storeConfig.footerNote}</p>
                <p className="text-[9px] text-gray-500 mt-2">www.fitbay.id</p>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t dark:border-white/5 border-gray-200">
          <p className="text-xs dark:text-gray-400 text-gray-500">
            💡 <span className="font-medium">Siap cetak thermal (Direct Print)</span> tanpa perlu download PDF.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Tutup
            </Button>
            <Button onClick={handlePrint} className="font-bold shadow-lg shadow-accent/25 px-6">
              🖨️ Cetak Sekarang
            </Button>
          </div>
        </div>
      </div>

      {/* Print Stylesheet khusus Thermal 10x15 cm & Invoice */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-shipping-label, #printable-shipping-label *,
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-shipping-label, #printable-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100mm !important;
            margin: 0 !important;
            padding: 15px !important;
            box-shadow: none !important;
            border: 2px solid black !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: 100mm 150mm;
            margin: 0;
          }
        }
      `}</style>
    </Modal>
  );
}
