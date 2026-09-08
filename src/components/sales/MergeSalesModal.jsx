import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select } from '../ui/Input';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useSales } from '../../context/SalesContext';
import {
  PAYMENT_METHODS,
  ORDER_SOURCES,
  SHIPPING_COURIERS,
} from '../../constants/profitSharingConfig';
import { calculateOrderTotals } from '../../utils/calculateProfitSharing';
import toast from 'react-hot-toast';

export default function MergeSalesModal({
  isOpen,
  onClose,
  selectedTransactions = [],
  onSuccess,
}) {
  const { mergeTransactions, profitSharingConfig } = useSales();
  const [submitting, setSubmitting] = useState(false);

  // Form State untuk Transaksi Gabungan
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [namaPenerima, setNamaPenerima] = useState('');
  const [noHpPenerima, setNoHpPenerima] = useState('');
  const [alamatPenerima, setAlamatPenerima] = useState('');
  const [ekspedisi, setEkspedisi] = useState('J&T Express');
  const [resi, setResi] = useState('');
  const [catatanPengiriman, setCatatanPengiriman] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transfer Bank');
  const [sumberPesanan, setSumberPesanan] = useState('WhatsApp');
  const [status, setStatus] = useState('Terjual');

  // Ekstrak seluruh barang dari transaksi-transaksi yang dipilih
  const combinedItems = useMemo(() => {
    const list = [];
    selectedTransactions.forEach((tx, txIdx) => {
      if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach((item, itemIdx) => {
          list.push({
            id: item.id || `merge_${tx.id}_${itemIdx}`,
            itemName: item.itemName || 'Barang',
            category: item.category || 'Baju',
            ownerName: item.ownerName || tx.ownerName || 'Akbar',
            costPrice: Number(item.costPrice || 0),
            sellingPrice: Number(item.sellingPrice || 0),
            kodeBarang: item.kodeBarang || null,
            inventoryItemId: item.inventoryItemId || null,
            skemaCustom: item.skemaCustom || tx.skemaCustom || tx.ownerCustomScheme || null,
            sourceTxId: tx.id,
            sourceTxDate: tx.date,
          });
        });
      } else {
        // Transaksi lama format single item
        list.push({
          id: `merge_${tx.id}_0`,
          itemName: tx.itemName || 'Barang',
          category: tx.category || 'Baju',
          ownerName: tx.ownerName || 'Akbar',
          costPrice: Number(tx.costPrice || 0),
          sellingPrice: Number(tx.sellingPrice || 0),
          kodeBarang: tx.kodeBarang || null,
          inventoryItemId: tx.inventoryItemId || null,
          skemaCustom: tx.skemaCustom || tx.ownerCustomScheme || null,
          sourceTxId: tx.id,
          sourceTxDate: tx.date,
        });
      }
    });
    return list;
  }, [selectedTransactions]);

  // Hitung akumulasi total order
  const orderTotals = useMemo(() => {
    return calculateOrderTotals(combinedItems, profitSharingConfig);
  }, [combinedItems, profitSharingConfig]);

  // Inisialisasi data penerima dari transaksi yang paling lengkap
  useEffect(() => {
    if (!isOpen || selectedTransactions.length === 0) return;

    // Cari transaksi dengan alamat atau nama penerima paling lengkap
    const bestCandidate =
      selectedTransactions.find((t) => t.alamatPenerima && t.namaPenerima) ||
      selectedTransactions.find((t) => t.namaPenerima) ||
      selectedTransactions[0];

    if (bestCandidate) {
      setDate(bestCandidate.date || new Date().toISOString().split('T')[0]);
      setNamaPenerima(bestCandidate.namaPenerima || '');
      setNoHpPenerima(bestCandidate.noHpPenerima || '');
      setAlamatPenerima(bestCandidate.alamatPenerima || '');
      setEkspedisi(bestCandidate.ekspedisi || 'J&T Express');
      setResi(bestCandidate.resi || '');
      setCatatanPengiriman(bestCandidate.catatanPengiriman || '');
      setPaymentMethod(bestCandidate.paymentMethod || 'Transfer Bank');
      setSumberPesanan(bestCandidate.sumberPesanan || 'WhatsApp');
      setStatus(bestCandidate.status || 'Terjual');
    }
  }, [isOpen, selectedTransactions]);

  const handleSelectPresetRecipient = (tx) => {
    setNamaPenerima(tx.namaPenerima || '');
    setNoHpPenerima(tx.noHpPenerima || '');
    setAlamatPenerima(tx.alamatPenerima || '');
    setEkspedisi(tx.ekspedisi || ekspedisi);
    setResi(tx.resi || resi);
    setPaymentMethod(tx.paymentMethod || paymentMethod);
    setSumberPesanan(tx.sumberPesanan || sumberPesanan);
    toast.success(`Data penerima disetel dari transaksi ${tx.namaPenerima || tx.id.slice(0, 6)}!`);
  };

  const handleConfirmMerge = async (e) => {
    e.preventDefault();
    if (selectedTransactions.length < 2) {
      toast.error('Pilih minimal 2 transaksi untuk digabungkan');
      return;
    }

    setSubmitting(true);
    try {
      const sourceIds = selectedTransactions.map((t) => t.id);

      const mergedPayload = {
        date,
        items: combinedItems,
        paymentMethod,
        sumberPesanan,
        status,
        namaPenerima: namaPenerima.trim(),
        noHpPenerima: noHpPenerima.trim(),
        alamatPenerima: alamatPenerima.trim(),
        ekspedisi: ekspedisi || 'J&T Express',
        resi: resi.trim(),
        catatanPengiriman: catatanPengiriman.trim(),
      };

      await mergeTransactions(sourceIds, mergedPayload);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to merge transactions:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span>🔗 Gabungkan Transaksi Menjadi 1 Order</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent border border-accent/30">
            {selectedTransactions.length} Transaksi Terpilih
          </span>
        </div>
      }
      size="xl"
    >
      <form onSubmit={handleConfirmMerge} className="space-y-5">
        {/* Banner Info */}
        <div className="p-3.5 rounded-2xl bg-accent/10 border border-accent/25 flex items-start gap-3">
          <span className="text-xl">📦</span>
          <div className="text-xs space-y-1">
            <h4 className="font-bold dark:text-white text-gray-900">
              Penggabungan Pesanan Pelanggan yang Sama
            </h4>
            <p className="dark:text-gray-300 text-gray-600 leading-relaxed">
              Transaksi-transaksi yang dipilih akan disatukan menjadi <strong>1 transaksi utuh</strong> dengan{' '}
              <strong>{combinedItems.length} barang</strong>. Seluruh status barang di inventaris akan otomatis
              diperbarui ke transaksi baru ini, dan data pengiriman/label paket hanya perlu dicetak 1 kali.
            </p>
          </div>
        </div>

        {/* Pilihan Cepat Sumber Data Penerima */}
        {selectedTransactions.some((t) => t.namaPenerima) && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700">
              Pilih Sumber Data Penerima dari Transaksi:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedTransactions.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => handleSelectPresetRecipient(tx)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-start justify-between ${
                    namaPenerima === tx.namaPenerima && alamatPenerima === tx.alamatPenerima
                      ? 'border-accent bg-accent/10 font-medium'
                      : 'dark:border-white/10 border-gray-200 dark:bg-surface-300/40 bg-gray-50 hover:border-accent/50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="font-bold dark:text-white text-gray-900 truncate">
                      {tx.namaPenerima || 'Tanpa Nama'} {tx.noHpPenerima ? `(${tx.noHpPenerima})` : ''}
                    </p>
                    <p className="text-[11px] dark:text-gray-400 text-gray-500 truncate">
                      {tx.alamatPenerima || 'Alamat belum ada'}
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 shrink-0 font-mono">
                    {formatDate(tx.date)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section Data Penerima & Pengiriman Bersama */}
        <div className="p-4 rounded-2xl border dark:border-white/10 border-gray-200 dark:bg-surface-300/50 bg-gray-50/70 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <div>
              <h4 className="text-xs font-bold dark:text-white text-gray-900">
                Data Penerima & Pengiriman (Untuk Label 10x15 cm & Struk)
              </h4>
              <p className="text-[11px] dark:text-gray-400 text-gray-500">
                Data ini akan dicetak pada satu label paket untuk seluruh barang yang digabung.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Lengkap Penerima"
              placeholder="Contoh: Budi Santoso"
              value={namaPenerima}
              onChange={(e) => setNamaPenerima(e.target.value)}
            />
            <Input
              label="No. WhatsApp / HP Penerima"
              placeholder="Contoh: 081234567890"
              value={noHpPenerima}
              onChange={(e) => setNoHpPenerima(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium dark:text-gray-400 text-gray-500 mb-1">
              Alamat Lengkap Pengiriman (Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Kode Pos)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Jl. Mawar No. 12, RT 04/RW 02, Kel. Menteng, Jakarta Pusat 10310"
              value={alamatPenerima}
              onChange={(e) => setAlamatPenerima(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm
                dark:bg-surface-200 bg-white dark:text-white text-gray-900
                dark:border-white/10 border-gray-300 border
                dark:placeholder-gray-500 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                transition-all duration-200 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Kurir / Ekspedisi"
              value={ekspedisi}
              onChange={(e) => setEkspedisi(e.target.value)}
            >
              {SHIPPING_COURIERS.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </Select>

            <Input
              label="Nomor Resi (Opsional)"
              placeholder="Contoh: JT1234567890"
              value={resi}
              onChange={(e) => setResi(e.target.value)}
            />

            <Select
              label="Metode Pembayaran"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Sumber Pesanan / Channel"
              value={sumberPesanan}
              onChange={(e) => setSumberPesanan(e.target.value)}
            >
              {ORDER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            <Input
              label="Catatan Khusus Pengiriman (Opsional)"
              placeholder="Contoh: Tolong gabung dalam 1 kardus"
              value={catatanPengiriman}
              onChange={(e) => setCatatanPengiriman(e.target.value)}
            />
          </div>
        </div>

        {/* Section Rincian Barang yang Digabung */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold dark:text-white text-gray-900 flex items-center gap-1.5">
              <span>🛍️</span>
              <span>Barang-Barang yang Akan Disatukan ({combinedItems.length} Barang):</span>
            </h4>
            <span className="text-xs text-accent font-bold">
              Total Jual: {formatCurrency(orderTotals.totalSelling)}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 p-3 rounded-2xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200">
            {combinedItems.map((it, idx) => (
              <div
                key={it.id || idx}
                className="p-2.5 rounded-xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-5 h-5 rounded-md bg-accent/15 text-accent font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  {it.kodeBarang && (
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent shrink-0">
                      🏷️ {it.kodeBarang}
                    </span>
                  )}
                  <div className="truncate">
                    <p className="font-bold dark:text-white text-gray-900 truncate">{it.itemName}</p>
                    <p className="text-[10px] text-gray-400">
                      Pemilik: <span className="text-emerald-400">{it.ownerName}</span> • Kat:{' '}
                      {it.category}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-accent">{formatCurrency(it.sellingPrice)}</p>
                  <p className="text-[10px] text-gray-400">Modal: {formatCurrency(it.costPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Ringkasan Total Finansial */}
        <div className="p-3.5 rounded-2xl dark:bg-surface-200 bg-gray-100 border dark:border-white/10 border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div>
            <span className="text-[10px] text-gray-400 block">Total Modal</span>
            <span className="font-bold dark:text-white text-gray-900">
              {formatCurrency(orderTotals.totalCost)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block">Total Jual</span>
            <span className="font-bold text-accent">
              {formatCurrency(orderTotals.totalSelling)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block">Total Laba Bersih</span>
            <span className="font-bold text-emerald-400">
              {formatCurrency(orderTotals.totalProfit)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block">Hak Pemilik Total</span>
            <span className="font-bold text-purple-400">
              {formatCurrency(orderTotals.totalSharing?.pemilikBarang || 0)}
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" loading={submitting}>
            🔗 Gabungkan Menjadi 1 Transaksi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
