import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getOwners } from '../firebase/ownerService';
import { getInventoryItems } from '../firebase/inventoryService';
import { getWithdrawals } from '../firebase/withdrawalService';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import logoImg from '../assets/logo.png';

export default function OwnerPortal() {
  const [owners, setOwners] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'withdrawals'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'ready' | 'sold'
  const [itemSearch, setItemSearch] = useState('');

  // Nomor WhatsApp Admin Fitbay.id untuk pengajuan pencairan saldo
  const ADMIN_WA_NUMBER = '62895325852230'; // Bisa disesuaikan

  // Fetch initial dataset
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [ownersData, invData, withData] = await Promise.all([
          getOwners().catch(() => []),
          getInventoryItems().catch(() => []),
          getWithdrawals().catch(() => []),
        ]);
        setOwners(ownersData);
        setInventory(invData);
        setWithdrawals(withData);
      } catch (err) {
        console.error('Error loading portal data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Fungsi Pencarian Pemilik berdasarkan No. HP atau Nama
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    const query = searchInput.trim().toLowerCase();
    if (!query) {
      setErrorMessage('Silakan masukkan Nama atau No. Handphone yang terdaftar');
      return;
    }

    setErrorMessage('');
    setHasSearched(true);

    // Normalisasi query no hp
    const cleanPhoneQuery = query.replace(/\D/g, '');

    const found = owners.find((o) => {
      const ownerName = (o.name || '').trim().toLowerCase();
      const ownerPhone = (o.phone || '').replace(/\D/g, '');

      if (ownerName === query || ownerName.includes(query)) return true;
      if (cleanPhoneQuery && ownerPhone && (ownerPhone.includes(cleanPhoneQuery) || cleanPhoneQuery.includes(ownerPhone))) {
        return true;
      }
      return false;
    });

    if (found) {
      setSelectedOwner(found);
    } else {
      setSelectedOwner(null);
      setErrorMessage(
        `Data penitip dengan kata kunci "${searchInput}" tidak ditemukan. Pastikan nama atau nomor HP sesuai dengan yang terdaftar di Fitbay.id.`
      );
    }
  };

  // Filter barang milik pemilik yang dipilih
  const ownerItems = useMemo(() => {
    if (!selectedOwner) return [];
    const targetName = (selectedOwner.name || '').trim().toLowerCase();
    return inventory.filter(
      (item) => (item.pemilikBarang || '').trim().toLowerCase() === targetName
    );
  }, [selectedOwner, inventory]);

  // Filter riwayat penarikan milik pemilik yang dipilih
  const ownerWithdrawalsList = useMemo(() => {
    if (!selectedOwner) return [];
    const targetName = (selectedOwner.name || '').trim().toLowerCase();
    return withdrawals.filter(
      (w) => (w.ownerName || '').trim().toLowerCase() === targetName
    );
  }, [selectedOwner, withdrawals]);

  // Perhitungan Keuangan & Statistik Barang
  const stats = useMemo(() => {
    if (!selectedOwner || ownerItems.length === 0) {
      const totalWithdrawn = ownerWithdrawalsList.reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
      return {
        totalItems: 0,
        readyItems: 0,
        soldItems: 0,
        totalEarned: 0,
        totalWithdrawn,
        remainingBalance: 0,
      };
    }

    let readyCount = 0;
    let soldCount = 0;
    let earned = 0;

    ownerItems.forEach((item) => {
      const isSold = item.status === 'Terjual';
      if (isSold) {
        soldCount++;
        // Hitung hak pemilik dari barang terjual
        if (selectedOwner.isCustomScheme && selectedOwner.customScheme) {
          const ownerPct = selectedOwner.customScheme.ownerPercentage || 85;
          const sellPrice = Number(item.hargaJual) || Number(item.hargaModal) || 0;
          earned += (sellPrice * ownerPct) / 100;
        } else {
          // Sistem konsinyasi standar: hargaModal adalah hak penitip
          earned += Number(item.hargaModal) || 0;
        }
      } else {
        readyCount++;
      }
    });

    const totalWithdrawn = ownerWithdrawalsList.reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
    const remainingBalance = Math.max(0, earned - totalWithdrawn);

    return {
      totalItems: ownerItems.length,
      readyItems: readyCount,
      soldItems: soldCount,
      totalEarned: earned,
      totalWithdrawn,
      remainingBalance,
    };
  }, [selectedOwner, ownerItems, ownerWithdrawalsList]);

  // Filter list barang sesuai tab/search
  const filteredItems = useMemo(() => {
    return ownerItems.filter((item) => {
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ready' && item.status !== 'Terjual') ||
        (statusFilter === 'sold' && item.status === 'Terjual');

      const matchText =
        !itemSearch ||
        (item.namaBarang && item.namaBarang.toLowerCase().includes(itemSearch.toLowerCase())) ||
        (item.kodeBarang && item.kodeBarang.toLowerCase().includes(itemSearch.toLowerCase())) ||
        (item.kategori && item.kategori.toLowerCase().includes(itemSearch.toLowerCase()));

      return matchStatus && matchText;
    });
  }, [ownerItems, statusFilter, itemSearch]);

  // URL WhatsApp untuk pengajuan pencairan dana
  const waWithdrawalUrl = useMemo(() => {
    if (!selectedOwner) return '';
    const message = `Halo Admin Fitbay.id, saya *${selectedOwner.name}* ingin mengajukan pencairan saldo titip jual sebesar *${formatCurrency(
      stats.remainingBalance
    )}*.\n\nMohon diproses ke rekening saya:\nNama Bank: \nNo. Rekening: \nAtas Nama: \n\nTerima kasih!`;
    return `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [selectedOwner, stats.remainingBalance]);

  return (
    <div className="min-h-screen dark:bg-[#0F0F0F] bg-gray-50 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Header Portal Publik */}
      <header className="sticky top-0 z-30 dark:bg-surface-300/90 bg-white/90 backdrop-blur-xl border-b dark:border-white/10 border-gray-200 px-4 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt="Fitbay.id"
              className="w-9 h-9 object-contain rounded-xl bg-[#F5F3EF] p-1 shadow-sm"
            />
            <div>
              <h1 className="text-base font-bold dark:text-white text-gray-900 leading-tight">
                Portal Penitip Barang
              </h1>
              <p className="text-[11px] text-accent font-medium">Fitbay.id Consignor Center</p>
            </div>
          </div>

          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold dark:bg-white/5 bg-gray-100 dark:text-gray-300 text-gray-700 hover:dark:bg-white/10 hover:bg-gray-200 transition-colors border dark:border-white/5 border-gray-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            <span>Login Staff/Admin</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        {/* Form Pencarian */}
        <section className="mb-8">
          <div className="max-w-2xl mx-auto text-center mb-6">
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight mb-2">
              Pantau Barang & Saldo Titip Jual Anda
            </h2>
            <p className="text-sm dark:text-gray-400 text-gray-600">
              Masukkan Nama atau Nomor Handphone yang Anda daftarkan saat menitipkan barang di Fitbay.id.
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Contoh: Maya atau 08123456789"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl dark:bg-surface-200 bg-white border dark:border-white/10 border-gray-300 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loadingData}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-accent hover:bg-accent-dark text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <span>Cek Status</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>

            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5 animate-shake">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </section>

        {/* Detail Pemilik & Hasil Statistik */}
        {selectedOwner && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Profil Pemilik & Tombol WA */}
            <div className="p-5 lg:p-6 rounded-3xl dark:bg-surface-200 bg-white border dark:border-white/10 border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple flex items-center justify-center text-white font-bold text-lg shadow-md uppercase">
                  {selectedOwner.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold dark:text-white text-gray-900 capitalize">
                      {selectedOwner.name}
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                      Penitip Aktif
                    </span>
                  </div>
                  <p className="text-xs dark:text-gray-400 text-gray-500">
                    No. Handphone: <span className="font-mono">{selectedOwner.phone || '-'}</span>
                  </p>
                </div>
              </div>

              {/* Tombol Ajukan Pencairan WA */}
              <a
                href={waWithdrawalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto px-5 py-2.5 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Ajukan Pencairan ke Admin</span>
              </a>
            </div>

            {/* Kartu Metrik Keuangan & Saldo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Sisa Saldo Siap Dicairkan (Utama) */}
              <div className="col-span-2 p-5 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-surface-200 to-surface-200 dark:border-emerald-500/30 border border-emerald-500/20 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Sisa Saldo Siap Dicairkan
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-2xl lg:text-3xl font-extrabold text-emerald-400">
                  {formatCurrency(stats.remainingBalance)}
                </p>
                <p className="text-[11px] dark:text-gray-400 text-gray-500 mt-1">
                  Total hak dari barang terjual dikurangi pencairan yang sudah ditransfer.
                </p>
              </div>

              {/* Total Hak Bersih Terjual */}
              <div className="p-4.5 rounded-3xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 shadow-sm">
                <span className="text-[11px] font-medium dark:text-gray-400 text-gray-500">
                  Total Hak Barang Terjual
                </span>
                <p className="text-lg font-bold dark:text-white text-gray-900 mt-1">
                  {formatCurrency(stats.totalEarned)}
                </p>
                <p className="text-[10px] text-accent mt-0.5">
                  {stats.soldItems} barang sudah laku
                </p>
              </div>

              {/* Total Sudah Dicairkan */}
              <div className="p-4.5 rounded-3xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 shadow-sm">
                <span className="text-[11px] font-medium dark:text-gray-400 text-gray-500">
                  Sudah Ditransfer Admin
                </span>
                <p className="text-lg font-bold text-purple-400 mt-1">
                  {formatCurrency(stats.totalWithdrawn)}
                </p>
                <p className="text-[10px] dark:text-gray-400 text-gray-500 mt-0.5">
                  {ownerWithdrawalsList.length} kali pencairan
                </p>
              </div>
            </div>

            {/* Tab Navigasi: Barang vs Riwayat Pencairan */}
            <div className="flex items-center gap-2 border-b dark:border-white/10 border-gray-200 pb-2">
              <button
                onClick={() => setActiveTab('items')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'items'
                    ? 'dark:bg-white/10 bg-gray-200 dark:text-white text-gray-900 shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 hover:dark:bg-white/5 hover:bg-gray-100'
                }`}
              >
                <span>Daftar Barang Titipan</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-accent/20 text-accent font-semibold">
                  {ownerItems.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('withdrawals')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'withdrawals'
                    ? 'dark:bg-white/10 bg-gray-200 dark:text-white text-gray-900 shadow-sm'
                    : 'dark:text-gray-400 text-gray-600 hover:dark:bg-white/5 hover:bg-gray-100'
                }`}
              >
                <span>Riwayat Pencairan Dana</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-purple/20 text-purple font-semibold">
                  {ownerWithdrawalsList.length}
                </span>
              </button>
            </div>

            {/* Konten Tab 1: Daftar Barang Titipan */}
            {activeTab === 'items' && (
              <div className="space-y-4 animate-fade-in">
                {/* Filter & Search Bar Barang */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                        statusFilter === 'all'
                          ? 'bg-accent text-white font-semibold'
                          : 'dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700'
                      }`}
                    >
                      Semua ({stats.totalItems})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ready')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                        statusFilter === 'ready'
                          ? 'bg-amber-500 text-white font-semibold'
                          : 'dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700'
                      }`}
                    >
                      Belum Terjual ({stats.readyItems})
                    </button>
                    <button
                      onClick={() => setStatusFilter('sold')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                        statusFilter === 'sold'
                          ? 'bg-emerald-500 text-white font-semibold'
                          : 'dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 dark:text-gray-300 text-gray-700'
                      }`}
                    >
                      Terjual ({stats.soldItems})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Cari barang / kode SKU..."
                    className="w-full sm:w-64 px-3.5 py-2 rounded-xl dark:bg-surface-200 bg-white border dark:border-white/10 border-gray-200 text-xs focus:outline-none focus:border-accent"
                  />
                </div>

                {/* List Barang */}
                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200">
                    <p className="text-xs dark:text-gray-400 text-gray-500">
                      Tidak ada barang titipan yang sesuai dengan filter.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredItems.map((item) => {
                      const isSold = item.status === 'Terjual';
                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 shadow-sm flex flex-col justify-between gap-3 hover:border-accent/30 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[11px] font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                                {item.kodeBarang || 'FB-ITEM'}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isSold
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {isSold ? 'Terjual' : 'Belum Terjual'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold dark:text-white text-gray-900 leading-snug line-clamp-2">
                              {item.namaBarang}
                            </h4>
                            <p className="text-[11px] dark:text-gray-400 text-gray-500 mt-0.5">
                              Kategori: <span className="text-gray-300">{item.kategori || 'Umum'}</span>
                            </p>
                          </div>

                          <div className="pt-2.5 border-t dark:border-white/5 border-gray-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] dark:text-gray-500 text-gray-400 block">
                                {isSold ? 'Hak Pembagian Hasil' : 'Estimasi Hak Bersih'}
                              </span>
                              <span className="text-xs font-bold text-emerald-400">
                                {formatCurrency(item.hargaModal || 0)}
                              </span>
                            </div>
                            <span className="text-[10px] dark:text-gray-500 text-gray-400">
                              {item.tanggalMasuk ? formatDate(item.tanggalMasuk) : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Konten Tab 2: Riwayat Pencairan Dana */}
            {activeTab === 'withdrawals' && (
              <div className="space-y-3 animate-fade-in">
                {ownerWithdrawalsList.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200">
                    <p className="text-xs dark:text-gray-400 text-gray-500">
                      Belum ada catatan pencairan dana yang ditransfer oleh admin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {ownerWithdrawalsList.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-2xl dark:bg-surface-200 bg-white border dark:border-white/5 border-gray-200 flex items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0 0a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 20.25 14.25V6H19.5a.75.75 0 0 1-.75-.75V4.5m-15 0a2.25 2.25 0 0 1 2.25-2.25h10.5A2.25 2.25 0 0 1 18.75 4.5m-15 0h15M12 9.75v3m0 0-1.5-1.5m1.5 1.5 1.5-1.5" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-bold dark:text-white text-gray-900">
                              Pencairan Dana: {formatCurrency(w.amount || 0)}
                            </p>
                            <p className="text-[11px] dark:text-gray-400 text-gray-500">
                              Metode: <span className="font-semibold text-gray-300">{w.method || 'Transfer Bank'}</span> • {w.date ? formatDate(w.date) : '-'}
                            </p>
                            {w.notes && (
                              <p className="text-[10px] text-gray-400 italic mt-0.5">
                                Catatan: {w.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                          Selesai Ditransfer
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Portal */}
      <footer className="mt-16 py-6 border-t dark:border-white/5 border-gray-200 text-center text-xs dark:text-gray-500 text-gray-400">
        <p>© 2026 Fitbay.id — Sistem Manajemen Titip Jual & Preloved</p>
      </footer>
    </div>
  );
}
