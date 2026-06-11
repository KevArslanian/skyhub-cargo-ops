export const LOGIN_ERROR_CODES = {
  INVALID_INPUT: "invalid_input",
  INVALID_CREDENTIALS: "invalid_credentials",
  ACCOUNT_INACTIVE: "account_inactive",
  CUSTOMER_ACCOUNT_INACTIVE: "customer_account_inactive",
  CUSTOMER_LOGIN_DISABLED: "customer_login_disabled",
  DATABASE_NOT_READY: "database_not_ready",
  AUTH_UNAVAILABLE: "auth_unavailable",
} as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[keyof typeof LOGIN_ERROR_CODES];

export type LoginResponse = {
  success?: boolean;
  role?: "admin" | "staff" | "customer";
  error?: string;
  code?: LoginErrorCode;
};

type LoginErrorDetail = {
  title: string;
  message: string;
  note?: string;
  tone: "warning" | "danger";
};

const LOGIN_ERROR_DETAILS: Record<LoginErrorCode, LoginErrorDetail> = {
  [LOGIN_ERROR_CODES.INVALID_INPUT]: {
    title: "Input belum lengkap",
    message: "Periksa kembali surel dan kata sandi yang dimasukkan.",
    note: "Surel harus valid dan kata sandi minimal 6 karakter.",
    tone: "warning",
  },
  [LOGIN_ERROR_CODES.INVALID_CREDENTIALS]: {
    title: "Kredensial tidak cocok",
    message: "Surel atau kata sandi yang dimasukkan tidak sesuai.",
    note: "Gunakan salah satu akun demo yang tersedia jika Anda sedang menguji sistem.",
    tone: "warning",
  },
  [LOGIN_ERROR_CODES.ACCOUNT_INACTIVE]: {
    title: "Akun belum aktif",
    message: "Akun ini belum aktif atau sudah dinonaktifkan.",
    note: "Hubungi admin operasional jika akses ini seharusnya masih berlaku.",
    tone: "warning",
  },
  [LOGIN_ERROR_CODES.CUSTOMER_ACCOUNT_INACTIVE]: {
    title: "Akun pelanggan belum aktif",
    message: "Akun pelanggan ini belum bisa mengakses portal.",
    note: "Aktivasi akun pelanggan diperlukan sebelum akses masuk dapat digunakan.",
    tone: "warning",
  },
  [LOGIN_ERROR_CODES.CUSTOMER_LOGIN_DISABLED]: {
    title: "Pelanggan tidak memiliki akun masuk",
    message: "Pelacakan AWB tersedia tanpa login di halaman Tentang Kami.",
    note: "Gunakan portal publik /about-us#tracking untuk mengecek status pengiriman.",
    tone: "warning",
  },
  [LOGIN_ERROR_CODES.DATABASE_NOT_READY]: {
    title: "Lingkungan masuk belum siap",
    message: "Skema autentikasi belum tersedia di basis data target.",
    note: "Bootstrap basis data perlu dijalankan agar akun demo dapat digunakan.",
    tone: "danger",
  },
  [LOGIN_ERROR_CODES.AUTH_UNAVAILABLE]: {
    title: "Layanan masuk terganggu",
    message: "Sistem belum dapat memproses akses masuk untuk sementara.",
    note: "Coba lagi sesaat atau periksa koneksi basis data dan rahasia sesi.",
    tone: "danger",
  },
};

export function getLoginErrorDetail(code?: LoginErrorCode, fallbackMessage?: string): LoginErrorDetail {
  const detail = (code && LOGIN_ERROR_DETAILS[code]) || LOGIN_ERROR_DETAILS[LOGIN_ERROR_CODES.AUTH_UNAVAILABLE];

  return fallbackMessage ? { ...detail, message: fallbackMessage } : detail;
}

export function isSetupLoginError(code?: LoginErrorCode) {
  return code === LOGIN_ERROR_CODES.DATABASE_NOT_READY || code === LOGIN_ERROR_CODES.AUTH_UNAVAILABLE;
}
