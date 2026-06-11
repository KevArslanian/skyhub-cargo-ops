export type LoginFactItem = {
  label: string;
  value: string;
};

export type LoginShowcaseScene = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  sceneTag: string;
  footerLeft: string;
  footerRight: string;
  filmNote: string;
  facts: LoginFactItem[];
  stats: LoginFactItem[];
  pulses: string[];
};

export const DEMO_LOGIN_ACCOUNTS = [
  {
    label: "Administrator",
    email: "admin@skyhub.test",
    password: "operator123",
    description: "Kontrol penuh untuk konfigurasi, pengguna, audit, dan review state lintas modul.",
  },
  {
    label: "Staf",
    email: "staff@skyhub.test",
    password: "operator123",
    description: "Alur kerja harian untuk buku pengiriman, pelacakan AWB, tinjauan masalah, dan pemantauan manifest aktif.",
  },
  {
    label: "Pelanggan",
    email: "customer@skyhub.test",
    password: "operator123",
    description: "Portal pelanggan untuk visibilitas pengiriman yang terkontrol dan berbasis akun.",
  },
] as const;

export const LOGIN_EDITORIAL_SUPPORT = [
  "Pergantian adegan manual tanpa putar otomatis agar staf tetap memegang kontrol visual.",
  "Pemetaan error terstruktur untuk kredensial, status akun, dan masalah setup backend.",
  "Pengantar publik dan portal akses tetap dipisah agar hierarki narasi brand tidak bercampur dengan form autentikasi.",
] as const;

export const LOGIN_SUPPORT_METRICS: LoginFactItem[] = [
  {
    label: "Runtime",
    value: "Next.js App Router + session cookie",
  },
  {
    label: "Database",
    value: "Postgres / Neon via Vercel environment",
  },
  {
    label: "Persona demo",
    value: "3 akun aktif untuk admin, staf, pelanggan",
  },
];

export const LOGIN_CAPABILITY_CARDS = [
  {
    label: "Sinyal Pelacakan",
    title: "Linimasa AWB terasa dekat dengan keputusan.",
    copy: "Status, milestone, masalah, dan log kejadian ditempatkan untuk kecepatan baca, bukan sekadar dekorasi dasbor.",
  },
  {
    label: "Tinjauan Manifest",
    title: "Buku pengiriman padat data tetap punya ritme yang tenang.",
    copy: "Filter, tabel, panel detail, urgensi, dan tingkat keyakinan tetap terbaca bahkan saat shift sedang padat.",
  },
  {
    label: "Akses Terkendali",
    title: "Satu pintu, cakupan berbeda untuk tiap persona.",
    copy: "Administrator, staf operasional, dan pelanggan berbagi identitas visual yang sama dengan batas kerja yang jelas.",
  },
] as const;

export const LOGIN_SHOWCASE_SCENES: LoginShowcaseScene[] = [
  {
    id: "charter",
    label: "Adegan 01",
    eyebrow: "Pintu Akses Operasional",
    title: "Akses operasi kargo yang tenang dan tegas.",
    description:
      "Adegan pertama menempatkan akses masuk sebagai ritual ke ruang kontrol yang tenang, premium, dan sangat terarah. Fokus utamanya bukan efek berlebihan, tetapi kesiapan staf untuk mulai bekerja.",
    imageSrc: "/auth/login-scene-charter.svg",
    imageAlt: "Editorial aviation access scene with framed runway lighting and private lounge mood.",
    sceneTag: "Akses ruang kendali privat",
    footerLeft: "Dibingkai untuk akses masuk cepat dan orientasi langsung",
    footerRight: "Nuansa aviasi tanpa berubah menjadi landing page pemasaran",
    filmNote: "Adegan ini membangun rasa tenang, premium, dan siap komando sebelum form disentuh.",
    facts: [
      { label: "Nuansa", value: "Tenang, presisi, editorial" },
      { label: "Nada akses", value: "Sistem operasi internal premium" },
      { label: "Isyarat utama", value: "Cahaya runway, biru gelap, bingkai krem" },
    ],
    stats: [
      { label: "Prioritas aksi", value: "Form masuk tetap paling jelas" },
      { label: "Transisi", value: "Crossfade dan gerak caption ringan" },
      { label: "Fokus", value: "Tanpa distraksi sebelum masuk" },
    ],
    pulses: ["Gerbang aman", "Kontrol adegan manual", "Ramah keyboard"],
  },
  {
    id: "suite",
    label: "Adegan 02",
    eyebrow: "Akses Berbasis Peran",
    title: "Satu pintu untuk tim internal dan visibilitas resi pelanggan.",
    description:
      "Adegan kedua menegaskan bahwa SkyHub melayani dua ritme kerja: pusat kendali internal yang padat, dan cek resi pelanggan yang lebih ringkas. Keduanya dibedakan melalui akses, bukan dengan memecah brand.",
    imageSrc: "/auth/login-scene-suite.svg",
    imageAlt: "Refined split-lounge scene blending executive operations mood and partner access atmosphere.",
    sceneTag: "Brand sama, cakupan terpisah",
    footerLeft: "Administrator, staf, dan pelanggan memakai satu bahasa akses",
    footerRight: "Cakupan dibedakan oleh logika peran, bukan visual yang terpecah",
    filmNote: "Komposisi split memberi sinyal bahwa satu sistem melayani workflow berbeda tanpa kehilangan disiplin visual.",
    facts: [
      { label: "Persona", value: "Administrator, staf, pelanggan cek resi" },
      { label: "Nada navigasi", value: "Terstruktur, manual, tidak gimmick" },
      { label: "Isyarat layout", value: "Adegan terbagi dan panel autentikasi tetap" },
    ],
    stats: [
      { label: "Jalur bantuan", value: "Isi akun demo dan panduan langsung" },
      { label: "Galat autentikasi", value: "Spesifik dan terbaca sistem" },
      { label: "Tujuan adegan", value: "Kemitraan tanpa mencampur hierarki" },
    ],
    pulses: ["Akses sadar peran", "Pratinjau siap produksi", "Terbaca di tablet"],
  },
  {
    id: "grid",
    label: "Adegan 03",
    eyebrow: "Panggung Kapabilitas",
    title: "Pelacakan, manifest, audit, dan akses dalam satu bingkai.",
    description:
      "Adegan ketiga membuat akses masuk terasa seperti pintu ke sistem yang benar-benar punya isi. Modul kapabilitas, metrik bantuan, dan panel autentikasi ditempatkan sebagai deck editorial yang tetap fokus pada aksi masuk.",
    imageSrc: "/auth/login-scene-grid.svg",
    imageAlt: "Adegan operasional editorial dengan bingkai dasbor modular dan kontrol kargo.",
    sceneTag: "Portal akses berbasis kapabilitas",
    footerLeft: "Panggung visual, strip film, dan panel autentikasi bergerak dalam satu sistem",
    footerRight: "Efek dikendalikan agar kejelasan form tidak turun",
    filmNote: "Adegan ini paling operasional: visual tetap atmosferik, tetapi isyaratnya langsung mengarah ke fungsi inti SkyHub.",
    facts: [
      { label: "Modul", value: "AWB, buku pengiriman, pengaturan, profil perusahaan" },
      { label: "Interaksi", value: "Pemilih thumbnail dengan transisi manual" },
      { label: "Basis visual", value: "Shell editorial krem dengan aksen biru tua" },
    ],
    stats: [
      { label: "Aturan gerak", value: "Tanpa putar otomatis, reduced-motion dihormati" },
      { label: "Responsif", value: "Form naik ke area utama di tablet dan mobile" },
      { label: "Status autentikasi", value: "Memuat, sukses, masalah setup, dan error" },
    ],
    pulses: ["Siap komando", "Sadar adegan", "Umpan balik form jelas"],
  },
];
