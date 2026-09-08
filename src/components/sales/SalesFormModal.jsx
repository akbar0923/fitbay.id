import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Input, { Select } from '../ui/Input';
import Button from '../ui/Button';
import {
  CATEGORIES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  ORDER_SOURCES,
  SHIPPING_COURIERS,
} from '../../constants/profitSharingConfig';
import { formatCurrency } from '../../utils/formatCurrency';
import { useOwners } from '../../context/OwnerContext';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { calculateOrderTotals, calculateItemProfitAndSharing } from '../../utils/calculateProfitSharing';
import toast from 'react-hot-toast';

const defaultCustomPercentages = {
  pemilikBarang: 70,
  operational: 10,
  akbar: 5,
  nesa: 5,
  andin: 5,
  ritza: 5,
};

function generateItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function createDefaultItem(defaultOwner = 'Akbar') {
  return {
    id: generateItemId(),
    itemName: '',
    ownerName: defaultOwner,
    category: 'Baju',
    costPrice: '',
    sellingPrice: '',
    kodeBarang: '',
    inventoryItemId: null,
    isCustomScheme: false,
    customPercentages: { ...defaultCustomPercentages },
  };
}

export default function SalesFormModal({ isOpen, onClose, onSubmit, editData }) {
  const { owners, addOwner } = useOwners();
  const { profitSharingConfig } = useSales();
  const { isSuperAdmin, isAdmin } = useAuth();
  const { availableItems } = useInventory();

  // Order level state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Transfer Bank');
  const [sumberPesanan, setSumberPesanan] = useState('WhatsApp');
  const [status, setStatus] = useState('Terjual');

  // Shipping & Recipient data
  const [namaPenerima, setNamaPenerima] = useState('');
  const [noHpPenerima, setNoHpPenerima] = useState('');
  const [alamatPenerima, setAlamatPenerima] = useState('');
  const [ekspedisi, setEkspedisi] = useState('J&T Express');
  const [resi, setResi] = useState('');
  const [catatanPengiriman, setCatatanPengiriman] = useState('');

  // Items list
  const [items, setItems] = useState([createDefaultItem('Akbar')]);
  const [itemErrors, setItemErrors] = useState({});
  const [generalErrors, setGeneralErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Quick add owner state
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [addingOwnerLoading, setAddingOwnerLoading] = useState(false);
  const [targetItemIndexForNewOwner, setTargetItemIndexForNewOwner] = useState(null);

  // Reset or populate on open / editData change
  useEffect(() => {
    if (!isOpen) return;

    const firstOwner = owners[0]?.name || 'Akbar';

    if (editData) {
      setDate(editData.date || new Date().toISOString().split('T')[0]);
      setPaymentMethod(editData.paymentMethod || 'Transfer Bank');
      setSumberPesanan(editData.sumberPesanan || 'WhatsApp');
      setStatus(editData.status || 'Terjual');

      setNamaPenerima(editData.namaPenerima || '');
      setNoHpPenerima(editData.noHpPenerima || '');
      setAlamatPenerima(editData.alamatPenerima || '');
      setEkspedisi(editData.ekspedisi || 'J&T Express');
      setResi(editData.resi || '');
      setCatatanPengiriman(editData.catatanPengiriman || '');

      if (editData.items && Array.isArray(editData.items) && editData.items.length > 0) {
        setItems(
          editData.items.map((it) => ({
            id: it.id || generateItemId(),
            itemName: it.itemName || '',
            ownerName: it.ownerName || firstOwner,
            category: it.category || 'Baju',
            costPrice: String(it.costPrice ?? 0),
            sellingPrice: String(it.sellingPrice ?? ''),
            kodeBarang: it.kodeBarang || '',
            inventoryItemId: it.inventoryItemId || null,
            isCustomScheme: Boolean(it.skemaCustom || it.ownerCustomScheme),
            customPercentages: it.skemaCustom || it.ownerCustomScheme || { ...defaultCustomPercentages },
          }))
        );
      } else {
        // Fallback for single item legacy transaction
        const savedCustom = editData.skemaCustom || editData.ownerCustomScheme;
        setItems([
          {
            id: generateItemId(),
            itemName: editData.itemName || '',
            ownerName: editData.ownerName || firstOwner,
            category: editData.category || 'Baju',
            costPrice: String(editData.costPrice ?? 0),
            sellingPrice: String(editData.sellingPrice ?? ''),
            kodeBarang: editData.kodeBarang || '',
            inventoryItemId: editData.inventoryItemId || null,
            isCustomScheme: Boolean(savedCustom),
            customPercentages: savedCustom || { ...defaultCustomPercentages },
          },
        ]);
      }
    } else {
      // Create new
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Transfer Bank');
      setSumberPesanan('WhatsApp');
      setStatus('Terjual');
      setNamaPenerima('');
      setNoHpPenerima('');
      setAlamatPenerima('');
      setEkspedisi('J&T Express');
      setResi('');
      setCatatanPengiriman('');
      setItems([createDefaultItem(firstOwner)]);
    }

    setItemErrors({});
    setGeneralErrors({});
    setIsAddingOwner(false);
    setNewOwnerName('');
  }, [editData, isOpen, owners]);

  // Set of selected inventory item IDs to avoid duplicates across rows
  const selectedInventoryIds = useMemo(() => {
    return new Set(items.map((it) => it.inventoryItemId).filter(Boolean));
  }, [items]);

  // Handle item field change
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    if (itemErrors[`${index}_${field}`]) {
      setItemErrors((prev) => {
        const next = { ...prev };
        delete next[`${index}_${field}`];
        return next;
      });
    }
  };

  // Quick select inventory item for a row
  const handleSelectInventoryItem = (index, itemId) => {
    if (!itemId) return;
    const selected = (availableItems || []).find((i) => i.id === itemId);
    if (selected) {
      setItems((prev) => {
        const updated = [...prev];
        const ownerObj = owners.find(
          (o) => o.name.toLowerCase() === (selected.pemilikBarang || '').toLowerCase()
        );

        let customPct = { ...defaultCustomPercentages };
        let isCustom = false;
        if (ownerObj?.isCustomScheme && ownerObj.customScheme) {
          isCustom = true;
          customPct = { ...ownerObj.customScheme };
        }

        updated[index] = {
          ...updated[index],
          itemName: selected.namaBarang || '',
          category: selected.kategori || 'Baju',
          ownerName: selected.pemilikBarang || owners[0]?.name || 'Akbar',
          costPrice: String(selected.hargaModal || 0),
          sellingPrice: selected.hargaJual ? String(selected.hargaJual) : (selected.sellingPrice ? String(selected.sellingPrice) : updated[index].sellingPrice || ''),
          kodeBarang: selected.kodeBarang || '',
          inventoryItemId: selected.id,
          isCustomScheme: isCustom,
          customPercentages: customPct,
        };
        return updated;
      });
      toast.success(`Barang [${selected.kodeBarang}] ${selected.namaBarang} terisi otomatis!`);
    }
  };

  const handleUnlinkInventoryItem = (index) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        kodeBarang: '',
        inventoryItemId: null,
      };
      return updated;
    });
  };

  // Add new item row
  const handleAddItem = () => {
    const firstOwner = owners[0]?.name || 'Akbar';
    setItems((prev) => [...prev, createDefaultItem(firstOwner)]);
  };

  // Remove item row
  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      toast.error('Transaksi harus memiliki minimal 1 barang');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Custom percentages per item
  const handlePercentageChange = (index, field, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        customPercentages: {
          ...updated[index].customPercentages,
          [field]: num,
        },
      };
      return updated;
    });
  };

  const applyPresetToItem = (index, scheme) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        customPercentages: {
          pemilikBarang: scheme.pemilikBarang ?? 70,
          operational: scheme.operational ?? 10,
          akbar: scheme.akbar ?? 0,
          nesa: scheme.nesa ?? 0,
          andin: scheme.andin ?? 0,
          ritza: scheme.ritza ?? 0,
        },
      };
      return updated;
    });
  };

  // Quick add owner
  const handleQuickAddOwner = async () => {
    if (!newOwnerName.trim()) {
      toast.error('Nama pemilik tidak boleh kosong');
      return;
    }
    const cleanName = newOwnerName.trim();
    if (owners.some((o) => o.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`Pemilik "${cleanName}" sudah ada di daftar`);
      if (targetItemIndexForNewOwner !== null) {
        handleItemChange(targetItemIndexForNewOwner, 'ownerName', cleanName);
      }
      setIsAddingOwner(false);
      return;
    }

    setAddingOwnerLoading(true);
    try {
      await addOwner({
        name: cleanName,
        phone: '-',
        notes: 'Dibuat cepat dari Form Penjualan',
      });
      if (targetItemIndexForNewOwner !== null) {
        handleItemChange(targetItemIndexForNewOwner, 'ownerName', cleanName);
      }
      setIsAddingOwner(false);
      setNewOwnerName('');
      toast.success(`Pemilik "${cleanName}" berhasil ditambahkan!`);
    } catch (err) {
      toast.error('Gagal menambahkan pemilik baru');
    } finally {
      setAddingOwnerLoading(false);
    }
  };

  // Calculate order totals in real-time
  const orderTotals = useMemo(() => {
    const processedItems = items.map((it) => {
      let customScheme = null;
      if (it.isCustomScheme) {
        customScheme = it.customPercentages;
      } else {
        const ownerObj = owners.find(
          (o) => o.name.toLowerCase() === (it.ownerName || '').toLowerCase()
        );
        if (ownerObj?.isCustomScheme && ownerObj.customScheme) {
          customScheme = ownerObj.customScheme;
        }
      }
      return {
        ...it,
        costPrice: Number(it.costPrice || 0),
        sellingPrice: Number(it.sellingPrice || 0),
        skemaCustom: customScheme,
      };
    });

    return calculateOrderTotals(processedItems, profitSharingConfig);
  }, [items, owners, profitSharingConfig]);

  // Validation
  const validate = () => {
    const newGeneralErrors = {};
    const newItemErrors = {};

    if (!date) newGeneralErrors.date = 'Tanggal transaksi wajib diisi';
    if (!items || items.length === 0) newGeneralErrors.items = 'Minimal 1 barang harus dimasukkan';

    items.forEach((it, idx) => {
      if (!it.itemName?.trim()) {
        newItemErrors[`${idx}_itemName`] = 'Nama barang wajib diisi';
      }
      if (!it.ownerName?.trim()) {
        newItemErrors[`${idx}_ownerName`] = 'Pemilik barang wajib dipilih';
      }
      if (it.costPrice === '' || it.costPrice === undefined || Number(it.costPrice) < 0) {
        newItemErrors[`${idx}_costPrice`] = 'Modal tidak boleh kosong / negatif';
      }
      if (!it.sellingPrice || Number(it.sellingPrice) <= 0) {
        newItemErrors[`${idx}_sellingPrice`] = 'Harga jual harus lebih dari 0';
      }

      if (it.isCustomScheme) {
        const totalPct =
          Number(it.customPercentages?.pemilikBarang || 0) +
          Number(it.customPercentages?.operational || 0) +
          Number(it.customPercentages?.akbar || 0) +
          Number(it.customPercentages?.nesa || 0) +
          Number(it.customPercentages?.andin || 0) +
          Number(it.customPercentages?.ritza || 0);

        if (totalPct !== 100) {
          newItemErrors[`${idx}_percentages`] = `Total persentase harus 100% (saat ini ${totalPct}%)`;
        }
      }
    });

    setGeneralErrors(newGeneralErrors);
    setItemErrors(newItemErrors);

    const isValid = Object.keys(newGeneralErrors).length === 0 && Object.keys(newItemErrors).length === 0;
    if (!isValid) {
      toast.error('Mohon lengkapi semua data barang yang diperlukan.');
    }
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const finalItemsPayload = items.map((it) => {
        let customScheme = null;
        if (it.isCustomScheme) {
          customScheme = it.customPercentages;
        } else {
          const ownerObj = owners.find(
            (o) => o.name.toLowerCase() === (it.ownerName || '').toLowerCase()
          );
          if (ownerObj?.isCustomScheme && ownerObj.customScheme) {
            customScheme = ownerObj.customScheme;
          }
        }

        const { profit, sharing } = calculateItemProfitAndSharing(
          {
            sellingPrice: Number(it.sellingPrice),
            costPrice: Number(it.costPrice || 0),
            skemaCustom: customScheme,
          },
          profitSharingConfig
        );

        return {
          id: it.id || generateItemId(),
          itemName: it.itemName.trim(),
          category: it.category || 'Baju',
          ownerName: it.ownerName.trim(),
          costPrice: Number(it.costPrice || 0),
          sellingPrice: Number(it.sellingPrice),
          profit,
          profitSharing: sharing,
          skemaCustom: customScheme,
          kodeBarang: it.kodeBarang || null,
          inventoryItemId: it.inventoryItemId || null,
        };
      });

      await onSubmit({
        date,
        items: finalItemsPayload,
        paymentMethod,
        sumberPesanan: sumberPesanan || 'WhatsApp',
        status,
        // Data Pengiriman & Penerima
        namaPenerima: namaPenerima.trim(),
        noHpPenerima: noHpPenerima.trim(),
        alamatPenerima: alamatPenerima.trim(),
        ekspedisi: ekspedisi || 'J&T Express',
        resi: resi.trim(),
        catatanPengiriman: catatanPengiriman.trim(),
      });

      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span>{editData ? '✏️ Edit Transaksi' : '➕ Tambah Transaksi Penjualan'}</span>
          {items.length > 1 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent border border-accent/30">
              {items.length} Barang
            </span>
          )}
        </div>
      }
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================================= */}
        {/* 1. INFORMASI ORDER & WAKTU */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-2xl dark:bg-surface-300/40 bg-gray-50 border dark:border-white/5 border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Input
              label="Tanggal Transaksi"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={generalErrors.date}
            />
          </div>
          <div>
            <Select
              label="Sumber / Channel"
              value={sumberPesanan}
              onChange={(e) => setSumberPesanan(e.target.value)}
            >
              {ORDER_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select
              label="Metode Bayar"
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
          <div>
            <Select
              label="Status Transaksi"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. DAFTAR BARANG YANG DIPESAN (MULTI-ITEM) */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛍️</span>
              <div>
                <h3 className="text-sm font-bold dark:text-white text-gray-900">
                  Daftar Barang ({items.length} Barang)
                </h3>
                <p className="text-xs dark:text-gray-400 text-gray-500">
                  Bisa gabungkan beberapa barang sekaligus dalam 1 paket/transaksi untuk pelanggan yang sama.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddItem}
              className="text-xs shadow-sm"
            >
              ➕ Tambah Barang Lagi
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const itemProfit = Number(item.sellingPrice || 0) - Number(item.costPrice || 0);
              const customTotal =
                Number(item.customPercentages?.pemilikBarang || 0) +
                Number(item.customPercentages?.operational || 0) +
                Number(item.customPercentages?.akbar || 0) +
                Number(item.customPercentages?.nesa || 0) +
                Number(item.customPercentages?.andin || 0) +
                Number(item.customPercentages?.ritza || 0);
              const isPctValid = !item.isCustomScheme || customTotal === 100;

              // Filter available items that aren't picked in OTHER rows
              const filteredInventoryOptions = (availableItems || []).filter(
                (inv) => inv.id === item.inventoryItemId || !selectedInventoryIds.has(inv.id)
              );

              return (
                <div
                  key={item.id || index}
                  className="p-4 rounded-2xl border dark:border-white/10 border-gray-200 dark:bg-surface-300/60 bg-white shadow-sm space-y-3 relative transition-all"
                >
                  {/* Header Baris Barang */}
                  <div className="flex items-center justify-between pb-2 border-b dark:border-white/5 border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-extrabold text-xs flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-bold dark:text-white text-gray-900">
                        {item.itemName || `Barang #${index + 1}`}
                      </span>
                      {item.kodeBarang && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30">
                          🏷️ {item.kodeBarang}
                        </span>
                      )}
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 font-semibold"
                        title="Hapus barang ini dari daftar pesanan"
                      >
                        ✕ Hapus Barang
                      </button>
                    )}
                  </div>

                  {/* Pilih dari Data Inventaris / Hubungkan Kode */}
                  {item.kodeBarang ? (
                    <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-between text-xs">
                      <span className="text-accent font-medium">
                        ✓ Terhubung dengan inventaris kode:{' '}
                        <strong className="font-mono font-bold">{item.kodeBarang}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkInventoryItem(index)}
                        className="text-[11px] text-gray-400 hover:text-red-400 font-semibold"
                      >
                        ✕ Lepas Keterhubungan
                      </button>
                    </div>
                  ) : (
                    filteredInventoryOptions.length > 0 && (
                      <div className="p-2.5 rounded-xl dark:bg-surface-200/70 bg-gray-50 border dark:border-white/5 border-gray-200">
                        <label className="block text-[11px] font-semibold dark:text-accent text-accent-dark mb-1 flex items-center gap-1">
                          <span>⚡</span>
                          <span>Auto-fill dari Inventaris Barang Masuk:</span>
                        </label>
                        <select
                          onChange={(e) => handleSelectInventoryItem(index, e.target.value)}
                          defaultValue=""
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-medium dark:bg-surface-100 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                        >
                          <option value="">-- Pilih barang siap jual untuk isi otomatis --</option>
                          {filteredInventoryOptions.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              [{inv.kodeBarang}] {inv.namaBarang} — {inv.pemilikBarang} (Modal: {formatCurrency(inv.hargaModal)}{inv.hargaJual ? ` | Jual: ${formatCurrency(inv.hargaJual)}` : ''})
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  )}

                  {/* Form Input Barang */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        label="Nama Barang"
                        placeholder="contoh: Nike Air Force 1 / Hoodie Smith"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                        error={itemErrors[`${index}_itemName`]}
                      />
                    </div>
                    <div>
                      <Select
                        label="Kategori"
                        value={item.category}
                        onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Pemilik Barang */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium dark:text-gray-300 text-gray-700">
                          Pemilik (Titipan)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetItemIndexForNewOwner(index);
                            setIsAddingOwner(true);
                          }}
                          className="text-[11px] text-accent hover:underline font-semibold"
                        >
                          + Pemilik Baru
                        </button>
                      </div>
                      <Select
                        value={item.ownerName}
                        onChange={(e) => handleItemChange(index, 'ownerName', e.target.value)}
                        error={itemErrors[`${index}_ownerName`]}
                      >
                        {owners.map((owner) => (
                          <option key={owner.id || owner.name} value={owner.name}>
                            {owner.name}{' '}
                            {owner.isCustomScheme
                              ? `(${owner.customScheme?.pemilikBarang}% / ${owner.customScheme?.operational}% Ops)`
                              : ''}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <Input
                        label="Harga Modal (Rp)"
                        type="number"
                        placeholder="0"
                        value={item.costPrice}
                        onChange={(e) => handleItemChange(index, 'costPrice', e.target.value)}
                        error={itemErrors[`${index}_costPrice`]}
                        min="0"
                      />
                    </div>

                    <div>
                      <Input
                        label="Harga Jual (Rp)"
                        type="number"
                        placeholder="0"
                        value={item.sellingPrice}
                        onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)}
                        error={itemErrors[`${index}_sellingPrice`]}
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Quick Profit Badge per item */}
                  {(item.costPrice !== '' || item.sellingPrice !== '') && (
                    <div className="flex items-center justify-between text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 border dark:border-white/5 border-gray-200">
                      <span className="text-gray-500 dark:text-gray-400">Laba Bersih Barang Ini:</span>
                      <span className={itemProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {formatCurrency(itemProfit)}
                      </span>
                    </div>
                  )}

                  {/* Custom Profit Sharing Toggle per item (Admin Only) */}
                  {isAdmin && (
                    <div className="pt-2 border-t dark:border-white/5 border-gray-100">
                      <div className="flex items-center justify-between text-xs">
                        <label
                          className="dark:text-gray-400 text-gray-600 font-medium cursor-pointer flex items-center gap-1.5"
                          onClick={() => handleItemChange(index, 'isCustomScheme', !item.isCustomScheme)}
                        >
                          <span>⚙️</span>
                          <span>Skema Bagi Hasil Custom Barang Ini</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'isCustomScheme', !item.isCustomScheme)}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            item.isCustomScheme ? 'bg-accent' : 'dark:bg-surface-200 bg-gray-300'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                              item.isCustomScheme ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {item.isCustomScheme && (
                        <div className="mt-2.5 p-3 rounded-xl dark:bg-surface-200 bg-gray-50 border dark:border-white/5 border-gray-200 space-y-2.5 animate-fade-in text-xs">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="text-gray-500">Preset Cepat:</span>
                            {[
                              { label: '70/10/20%', scheme: { pemilikBarang: 70, operational: 10, akbar: 5, nesa: 5, andin: 5, ritza: 5 } },
                              { label: '85/15%', scheme: { pemilikBarang: 85, operational: 15, akbar: 0, nesa: 0, andin: 0, ritza: 0 } },
                              { label: '90/10%', scheme: { pemilikBarang: 90, operational: 10, akbar: 0, nesa: 0, andin: 0, ritza: 0 } },
                              { label: '100% Pemilik', scheme: { pemilikBarang: 100, operational: 0, akbar: 0, nesa: 0, andin: 0, ritza: 0 } },
                            ].map((preset, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => applyPresetToItem(index, preset.scheme)}
                                className="px-2 py-0.5 rounded dark:bg-white/5 bg-white border dark:border-white/10 border-gray-300 hover:border-accent font-medium text-gray-700 dark:text-gray-300"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
                            <div>
                              <label className="text-emerald-400 font-bold block mb-0.5">Pemilik (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.customPercentages?.pemilikBarang || 0}
                                onChange={(e) => handlePercentageChange(index, 'pemilikBarang', e.target.value)}
                                className="w-full px-2 py-1 rounded text-center font-bold dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="text-purple-400 font-bold block mb-0.5">Ops (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.customPercentages?.operational || 0}
                                onChange={(e) => handlePercentageChange(index, 'operational', e.target.value)}
                                className="w-full px-2 py-1 rounded text-center font-bold dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="text-blue-400 font-bold block mb-0.5">Akbar (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.customPercentages?.akbar || 0}
                                onChange={(e) => handlePercentageChange(index, 'akbar', e.target.value)}
                                className="w-full px-2 py-1 rounded text-center font-bold dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="text-pink-400 font-bold block mb-0.5">Nesa (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.customPercentages?.nesa || 0}
                                onChange={(e) => handlePercentageChange(index, 'nesa', e.target.value)}
                                className="w-full px-2 py-1 rounded text-center font-bold dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="text-amber-400 font-bold block mb-0.5">Andin (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.customPercentages?.andin || 0}
                                onChange={(e) => handlePercentageChange(index, 'andin', e.target.value)}
                                className="w-full px-2 py-1 rounded text-center font-bold dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="text-cyan-400 font-bold block mb-0.5">Ritza (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.customPercentages?.ritza || 0}
                                onChange={(e) => handlePercentageChange(index, 'ritza', e.target.value)}
                                className="w-full px-2 py-1 rounded text-center font-bold dark:bg-surface-300 bg-white border dark:border-white/10 border-gray-300"
                              />
                            </div>
                          </div>

                          {!isPctValid && (
                            <p className="text-[11px] text-rose-400 font-bold">
                              ⚠️ Total persentase harus 100% (saat ini: {customTotal}%)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddItem}
              className="w-full sm:w-auto text-xs py-2 px-6 border-dashed border-2 hover:border-accent"
            >
              ➕ Tambah Barang Lagi ke Transaksi Ini
            </Button>
          </div>
        </div>

        {/* Quick Modal Tambah Pemilik Baru */}
        {isAddingOwner && (
          <div className="p-3.5 rounded-2xl bg-accent/10 border border-accent/30 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-accent">
              <span>Tambah Pemilik Penitip Baru:</span>
              <button
                type="button"
                onClick={() => setIsAddingOwner(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕ Batal
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nama pemilik baru..."
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm dark:bg-surface-200 bg-white dark:text-white text-gray-900 border dark:border-white/10 border-gray-300 focus:outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddOwner();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={handleQuickAddOwner} loading={addingOwnerLoading}>
                Simpan
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CARD RINGKASAN AKUMULASI ORDER */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-2xl dark:bg-surface-300/80 bg-gray-50 border dark:border-white/10 border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold dark:text-white text-gray-900 flex items-center gap-1.5">
              <span>📊</span>
              <span>Ringkasan Total Transaksi ({items.length} Barang):</span>
            </span>
            <span
              className={`text-sm font-extrabold ${
                orderTotals.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Laba Bersih: {formatCurrency(orderTotals.totalProfit)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Total Modal</span>
              <span className="font-bold dark:text-white text-gray-900">
                {formatCurrency(orderTotals.totalCost)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Total Penjualan</span>
              <span className="font-bold text-accent">
                {formatCurrency(orderTotals.totalSelling)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Hak Pemilik Total</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(orderTotals.totalSharing?.pemilikBarang || 0)}
              </span>
            </div>
          </div>

          {isSuperAdmin && orderTotals.totalProfit > 0 && (
            <div className="pt-2 border-t dark:border-white/5 border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-purple-400 font-medium">Ops:</span>{' '}
                <span className="font-bold dark:text-white text-gray-900">
                  {formatCurrency(orderTotals.totalSharing?.operational || 0)}
                </span>
              </div>
              <div>
                <span className="text-blue-400 font-medium">Akbar:</span>{' '}
                <span className="font-bold dark:text-white text-gray-900">
                  {formatCurrency(orderTotals.totalSharing?.akbar || 0)}
                </span>
              </div>
              <div>
                <span className="text-pink-400 font-medium">Nesa:</span>{' '}
                <span className="font-bold dark:text-white text-gray-900">
                  {formatCurrency(orderTotals.totalSharing?.nesa || 0)}
                </span>
              </div>
              <div>
                <span className="text-amber-400 font-medium">Andin:</span>{' '}
                <span className="font-bold dark:text-white text-gray-900">
                  {formatCurrency(orderTotals.totalSharing?.andin || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. DATA PENERIMA & ALAMAT PENGIRIMAN PELANGGAN */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-2xl border dark:border-white/10 border-gray-200 dark:bg-surface-300/40 bg-gray-50/70 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <div>
              <h4 className="text-xs font-bold dark:text-white text-gray-900">
                Data Penerima & Alamat Pengiriman (1 Paket Bersama)
              </h4>
              <p className="text-[11px] dark:text-gray-400 text-gray-500">
                Semua barang di atas akan dikirimkan bersama dalam satu paket label pengiriman ini.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          <Input
            label="Catatan Khusus Pengiriman (Opsional)"
            placeholder="Contoh: Tolong titipkan di pos satpam / Fragile"
            value={catatanPengiriman}
            onChange={(e) => setCatatanPengiriman(e.target.value)}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-white/5 border-gray-200">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" loading={submitting}>
            {editData ? 'Simpan Perubahan' : `Tambah Transaksi (${items.length} Barang)`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
