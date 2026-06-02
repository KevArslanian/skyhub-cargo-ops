// Lightweight bilingual i18n system for Skyhub (ID ↔ EN)
// Full support for UI, errors, navigation, and print pages.

export type Locale = 'id' | 'en';

type Messages = Record<string, string>;

export const messages: Record<Locale, Messages> = {
  id: {
    // General
    'general.save': 'Simpan',
    'general.cancel': 'Batal',
    'general.loading': 'Memuat...',
    'general.error': 'Terjadi kesalahan. Silakan coba lagi.',
    'general.success': 'Berhasil',
    'general.print': 'Cetak',
    'general.refresh': 'Muat Ulang',

    // Settings
    'settings.title': 'Pengaturan',
    'settings.profile': 'Profil',
    'settings.preferences': 'Preferensi',
    'settings.language': 'Bahasa',
    'settings.timezone': 'Zona Waktu',
    'settings.defaultLanding': 'Halaman Awal Default',
    'settings.filterOwnStation': 'Tampilkan hanya data stasiun saya secara default',
    'settings.timeFormat': 'Format Waktu',
    'settings.timeFormat.24h': '24 Jam',
    'settings.timeFormat.12h': '12 Jam (AM/PM)',
    'settings.timezone.smartNote': 'Otomatis disarankan sesuai stasiun yang dipilih.',
    'settings.saveSuccess': 'Pengaturan berhasil disimpan.',

    // Navigation & Shell
    'nav.dashboard': 'Dashboard',
    'nav.shipmentLedger': 'Ledger Shipment',
    'nav.awbTracking': 'Pelacakan AWB',
    'nav.flightBoard': 'Papan Penerbangan',
    'nav.alerts': 'Alert Center',
    'nav.activityLog': 'Log Aktivitas',
    'nav.settings': 'Pengaturan',
    'shell.controlRoom': 'Ruang Kontrol',
    'shell.searchPlaceholder': 'Cari...',
    'shell.notifications': 'Notifikasi',

    // Errors - Common
    'error.general.connection': 'Koneksi bermasalah. Periksa internet Anda.',
    'error.general.invalidInput': 'Input tidak valid. Periksa kembali data yang diisi.',
    'error.general.unauthorized': 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
    'error.general.notFound': 'Data tidak ditemukan.',

    // AWB Tracking
    'awb.invalid': 'Format AWB tidak valid. Contoh yang benar: 160-12345678',
    'awb.notFound': 'AWB tidak ditemukan. Pastikan nomor yang dimasukkan sudah benar dan terdaftar.',
    'awb.fetchFailed': 'Gagal memuat data AWB. Silakan coba lagi dalam beberapa saat.',
    'awb.noTracking': 'Belum ada catatan perjalanan untuk AWB ini. Status akan muncul otomatis setelah barang diproses.',

    // Shipment / Ledger
    'shipment.createSuccess': 'Shipment berhasil dibuat.',
    'shipment.updateSuccess': 'Shipment berhasil diperbarui.',
    'shipment.deleteSuccess': 'Shipment berhasil dihapus.',
    'shipment.createError': 'Gagal membuat shipment. Periksa kembali data yang diisi.',
  },
  en: {
    // General
    'general.save': 'Save',
    'general.cancel': 'Cancel',
    'general.loading': 'Loading...',
    'general.error': 'An error occurred. Please try again.',
    'general.success': 'Success',
    'general.print': 'Print',
    'general.refresh': 'Refresh',

    // Settings
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.preferences': 'Preferences',
    'settings.language': 'Language',
    'settings.timezone': 'Timezone',
    'settings.defaultLanding': 'Default Landing Page',
    'settings.filterOwnStation': 'Show only my station data by default',
    'settings.timeFormat': 'Time Format',
    'settings.timeFormat.24h': '24-hour',
    'settings.timeFormat.12h': '12-hour (AM/PM)',
    'settings.timezone.smartNote': 'Auto-suggested based on selected station.',
    'settings.saveSuccess': 'Settings saved successfully.',

    // Navigation & Shell
    'nav.dashboard': 'Dashboard',
    'nav.shipmentLedger': 'Shipment Ledger',
    'nav.awbTracking': 'AWB Tracking',
    'nav.flightBoard': 'Flight Board',
    'nav.alerts': 'Alert Center',
    'nav.activityLog': 'Activity Log',
    'nav.settings': 'Settings',
    'shell.controlRoom': 'Control Room',
    'shell.searchPlaceholder': 'Search...',
    'shell.notifications': 'Notifications',

    // Errors - Common
    'error.general.connection': 'Connection problem. Please check your internet.',
    'error.general.invalidInput': 'Invalid input. Please check the data entered.',
    'error.general.unauthorized': 'Authentication required. Please log in first.',
    'error.general.notFound': 'Data not found.',

    // AWB Tracking
    'awb.invalid': 'Invalid AWB format. Correct example: 160-12345678',
    'awb.notFound': 'AWB not found. Please ensure the number is correct and registered.',
    'awb.fetchFailed': 'Failed to load AWB data. Please try again shortly.',
    'awb.noTracking': 'No tracking events yet for this AWB. Status will appear automatically after processing.',

    // Shipment / Ledger
    'shipment.createSuccess': 'Shipment created successfully.',
    'shipment.updateSuccess': 'Shipment updated successfully.',
    'shipment.deleteSuccess': 'Shipment deleted successfully.',
    'shipment.createError': 'Failed to create shipment. Please check the entered data.',
  },
};

export type MessageKey = keyof typeof messages.id;

let currentLocale: Locale = 'id';

export function setLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem('skyhub-locale', locale);
    window.dispatchEvent(new Event('skyhub:locale-changed'));
  }
}

export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('skyhub-locale') as Locale | null;
    if (saved === 'id' || saved === 'en') return saved;
  }
  return currentLocale;
}

export function t(key: MessageKey, fallback?: string): string {
  const localeMessages = messages[getLocale()] as Record<string, string>;
  return localeMessages[key] || fallback || String(key);
}

// Smart timezone helper
export function getRecommendedTimezoneForStation(station: string): string {
  const map: Record<string, string> = {
    CGK: 'Asia/Jakarta',
    SUB: 'Asia/Jakarta',
    DPS: 'Asia/Makassar',
    SOQ: 'Asia/Jayapura',
    UPG: 'Asia/Makassar',
    BPN: 'Asia/Makassar',
  };
  return map[station] || 'Asia/Jakarta';
}

// Helper to get current user language from settings (to be used in server components if needed)
export function getUserLanguage(settings?: { language?: string }): Locale {
  if (settings?.language === 'en') return 'en';
  return 'id';
}


