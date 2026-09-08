import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const SETTINGS_DOC_ID = 'links_page';
const LOCAL_STORAGE_KEY = 'fitbay_links_page_config_cache';

export const DEFAULT_LINKS_CONFIG = {
  profile: {
    storeName: 'Fitbay.id',
    tagline: 'Thrift & Preloved Curated Store ✨',
    description: 'Pilihan baju thrift & preloved berkualitas tinggi. Fast response, aman, dan siap kirim ke seluruh Indonesia.',
    avatarUrl: '',
    showStatusBadge: true,
    statusBadgeText: 'Online & Fast Response',
  },
  announcement: {
    enabled: true,
    icon: '🔥',
    text: 'Drop Koleksi Baru Setiap Minggu! Cek barang sekarang sebelum kehabisan.',
  },
  socials: {
    whatsappNumber: '6285121009699',
    whatsappDefaultMsg: 'Halo Admin Fitbay.id! Saya mau tanya seputar produk katalog preloved...',
    instagramUrl: 'https://instagram.com/fitbay.id',
    tiktokUrl: 'https://tiktok.com/@fitbay.id',
    shopeeUrl: '',
    websiteUrl: '',
  },
  links: [
    {
      id: 'wa-order',
      title: 'Chat WhatsApp (Admin Order)',
      subtitle: 'Tanya stok, katalog terbaru & pemesanan',
      type: 'whatsapp',
      url: '',
      waMessage: 'Halo Admin Fitbay.id! Saya mau tanya seputar produk katalog preloved...',
      icon: 'whatsapp',
      emoji: '💬',
      styleVariant: 'emerald',
      badgeText: '',
      isActive: true,
    },
    {
      id: 'titip-jual',
      title: 'Titip Jual Barang (Konsinyasi)',
      subtitle: 'Punya baju preloved bagus? Titip jual di Fitbay.id',
      type: 'whatsapp',
      url: '',
      waMessage: 'Halo Admin Fitbay.id! Saya ingin titip jual / konsinyasi barang preloved saya...',
      icon: 'handshake',
      emoji: '🤝',
      styleVariant: 'purple',
      badgeText: '',
      isActive: true,
    },
    {
      id: 'testimoni',
      title: 'Testimoni & Ulasan Pembeli',
      subtitle: 'Lihat ulasan asli atau bagikan pengalaman belanja Anda',
      type: 'internal',
      url: '/testimoni',
      icon: 'star',
      emoji: '⭐',
      styleVariant: 'amber',
      badgeText: 'Terpercaya',
      isActive: true,
    },
    {
      id: 'cek-barang',
      title: 'Portal Cek Barang Penitip',
      subtitle: 'Cek status penjualan & saldo barang konsinyasi Anda',
      type: 'internal',
      url: '/cek-barang',
      icon: 'box',
      emoji: '📦',
      styleVariant: 'emerald',
      badgeText: '',
      isActive: true,
    },
    {
      id: 'instagram',
      title: 'Instagram Official',
      subtitle: '@fitbay.id • Feed katalog, review & jadwal drop',
      type: 'external',
      url: 'https://instagram.com/fitbay.id',
      icon: 'instagram',
      emoji: '📸',
      styleVariant: 'pink',
      badgeText: '',
      isActive: true,
    },
    {
      id: 'tiktok',
      title: 'TikTok Live & Video',
      subtitle: 'Spill detail barang & info flash sale',
      type: 'external',
      url: 'https://tiktok.com/@fitbay.id',
      icon: 'tiktok',
      emoji: '🎵',
      styleVariant: 'cyan',
      badgeText: '',
      isActive: true,
    },
  ],
  footer: {
    showHoursBadge: true,
    hoursLabel: 'Jam Operasional',
    hoursValue: '09:00 - 22:00 WITA',
    showGuaranteeBadge: true,
    guaranteeLabel: '100% Aman & Terpercaya',
    guaranteeValue: 'Garansi Sesuai Foto',
    copyrightText: 'Fitbay.id',
  },
};

/**
 * Normalisasi data config jika ada data warisan berbentuk flat di Firestore
 */
export function normalizeLinksConfig(raw) {
  if (!raw) return DEFAULT_LINKS_CONFIG;

  return {
    profile: {
      storeName: raw.profile?.storeName || raw.storeName || DEFAULT_LINKS_CONFIG.profile.storeName,
      tagline: raw.profile?.tagline || raw.tagline || DEFAULT_LINKS_CONFIG.profile.tagline,
      description: raw.profile?.description || raw.description || DEFAULT_LINKS_CONFIG.profile.description,
      avatarUrl: raw.profile?.avatarUrl ?? raw.avatarUrl ?? DEFAULT_LINKS_CONFIG.profile.avatarUrl,
      showStatusBadge: raw.profile?.showStatusBadge ?? DEFAULT_LINKS_CONFIG.profile.showStatusBadge,
      statusBadgeText: raw.profile?.statusBadgeText || DEFAULT_LINKS_CONFIG.profile.statusBadgeText,
    },
    announcement: {
      enabled: raw.announcement?.enabled ?? (Boolean(raw.announcement && typeof raw.announcement === 'string') || DEFAULT_LINKS_CONFIG.announcement.enabled),
      icon: raw.announcement?.icon || DEFAULT_LINKS_CONFIG.announcement.icon,
      text: typeof raw.announcement === 'string' ? raw.announcement : (raw.announcement?.text ?? DEFAULT_LINKS_CONFIG.announcement.text),
    },
    socials: {
      whatsappNumber: raw.socials?.whatsappNumber || raw.whatsappNumber || DEFAULT_LINKS_CONFIG.socials.whatsappNumber,
      whatsappDefaultMsg: raw.socials?.whatsappDefaultMsg || raw.whatsappMessage || DEFAULT_LINKS_CONFIG.socials.whatsappDefaultMsg,
      instagramUrl: raw.socials?.instagramUrl || raw.instagramUrl || DEFAULT_LINKS_CONFIG.socials.instagramUrl,
      tiktokUrl: raw.socials?.tiktokUrl || raw.tiktokUrl || DEFAULT_LINKS_CONFIG.socials.tiktokUrl,
      shopeeUrl: raw.socials?.shopeeUrl || raw.shopeeUrl || DEFAULT_LINKS_CONFIG.socials.shopeeUrl,
      websiteUrl: raw.socials?.websiteUrl || raw.websiteUrl || DEFAULT_LINKS_CONFIG.socials.websiteUrl,
    },
    links: Array.isArray(raw.links) && raw.links.length > 0 ? raw.links : DEFAULT_LINKS_CONFIG.links,
    footer: {
      showHoursBadge: raw.footer?.showHoursBadge ?? DEFAULT_LINKS_CONFIG.footer.showHoursBadge,
      hoursLabel: raw.footer?.hoursLabel || DEFAULT_LINKS_CONFIG.footer.hoursLabel,
      hoursValue: raw.footer?.hoursValue || DEFAULT_LINKS_CONFIG.footer.hoursValue,
      showGuaranteeBadge: raw.footer?.showGuaranteeBadge ?? DEFAULT_LINKS_CONFIG.footer.showGuaranteeBadge,
      guaranteeLabel: raw.footer?.guaranteeLabel || DEFAULT_LINKS_CONFIG.footer.guaranteeLabel,
      guaranteeValue: raw.footer?.guaranteeValue || DEFAULT_LINKS_CONFIG.footer.guaranteeValue,
      copyrightText: raw.footer?.copyrightText || DEFAULT_LINKS_CONFIG.footer.copyrightText,
    },
  };
}

export function getLocalLinksConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return normalizeLinksConfig(JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Gagal membaca cache lokal links config:', e);
  }
  return DEFAULT_LINKS_CONFIG;
}

export function saveLocalLinksConfig(config) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Gagal menyimpan cache lokal links config:', e);
  }
}

export async function getLinksConfig() {
  const localConfig = getLocalLinksConfig();
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const normalized = normalizeLinksConfig(docSnap.data());
      saveLocalLinksConfig(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('Gagal mengambil konfigurasi linktree dari Firestore, menggunakan fallback cache:', err);
  }
  return localConfig;
}

export async function updateLinksConfig(newConfig) {
  const normalized = normalizeLinksConfig(newConfig);
  const toSave = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  saveLocalLinksConfig(toSave);
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, toSave, { merge: true });
  } catch (err) {
    console.error('Gagal menyimpan konfigurasi linktree ke Firestore:', err);
    throw err;
  }
  return toSave;
}
