import {
  AtSign,
  BellRing,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  Clock3,
  Files,
  Globe2,
  Gauge,
  LayoutPanelTop,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  PlaneTakeoff,
  Radar,
  Route,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { APP_CANONICAL_URL } from "@/lib/constants";

export type CompanyContactItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
};

export type CompanyFactItem = {
  label: string;
  value: string;
};

export type CompanyHighlightItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type CompanySwipeCard = {
  id: string;
  label: string;
  title: string;
  description: string;
  artworkSrc: string;
  artworkAlt: string;
  stageEyebrow: string;
  stageLabel: string;
  stageNote: string;
  sceneFacts: CompanyFactItem[];
  chips?: string[];
  metrics?: CompanyFactItem[];
  highlights?: CompanyHighlightItem[];
  contacts?: CompanyContactItem[];
  note?: string;
};

export type CompanyTimelineItem = {
  label: string;
  title: string;
  description: string;
};

export const COMPANY_HERO_HEADLINE =
  "Pusat kendali kargo udara yang cepat dipindai, elegan dibaca, dan stabil untuk shift operasional panjang.";

export const COMPANY_HERO_COPY =
  "SkyHub menyatukan pelacakan AWB, papan manifest, pengelolaan pengiriman, audit, peringatan, dan preferensi staf operasional dalam satu sistem operasional yang formal, tenang, dan siap dipakai sepanjang hari.";

export const COMPANY_ABOUT_COPY =
  "Dirancang untuk staf operasional, admin, dan portal pelanggan, SkyHub menjaga hierarki data tetap tegas: status lebih cepat terbaca, masalah lebih cepat terlihat, dan aksi kerja tetap dekat ke konteks pengiriman.";

export const COMPANY_HERO_PILLS = [
  "Sistem operasi kargo internal",
  "Deck informasi yang bisa digeser",
  "Kontrol manual tanpa putar otomatis",
] as const;

export const COMPANY_OPERATOR_NOTE =
  "Setiap panel dibuat untuk keputusan cepat: identifier selalu lebih dominan daripada ornamen, status penting selalu memiliki affordance yang jelas, dan ritme panel sengaja dijaga agar padat informasi tanpa terasa bising.";

export const COMPANY_HERO_METRICS: CompanyFactItem[] = [
  {
    label: "Mode Operasional",
    value: "Ruang kerja operasi kargo internal",
  },
  {
    label: "Cakupan",
    value: "Pelacakan AWB, manifest, audit, peringatan, preferensi pengguna",
  },
  {
    label: "Akses",
    value: "Staf operasional, admin, dan portal pelanggan",
  },
];

export const COMPANY_FACTS: CompanyFactItem[] = [
  {
    label: "Industri",
    value: "Operasional kargo udara dan logistik digital",
  },
  {
    label: "Platform",
    value: "Pusat kendali internal dengan portal akun pelanggan",
  },
  {
    label: "Cakupan layanan",
    value: "Pemantauan pengiriman, manifest, penugasan penerbangan, audit, peringatan, dan tinjauan kesiapan",
  },
  {
    label: "Karakter produk",
    value: "Dasbor operasional yang fokus pada kecepatan pemindaian dan kejelasan keputusan",
  },
];

export const COMPANY_CONTACT_ITEMS: CompanyContactItem[] = [
  {
    icon: Building2,
    label: "Kantor",
    value: "Pusat Operasi SkyHub",
  },
  {
    icon: MapPin,
    label: "Alamat",
    value: "Jl. Kargo Internasional No. 12, Area Logistik Bandara, Jakarta 15126, Indonesia",
  },
  {
    icon: Mail,
    label: "Surel umum",
    value: "info@skyhub.co",
    href: "mailto:info@skyhub.co",
  },
  {
    icon: Mail,
    label: "Surel operasional",
    value: "ops@skyhub.co",
    href: "mailto:ops@skyhub.co",
  },
  {
    icon: Mail,
    label: "Surel dukungan",
    value: "support@skyhub.co",
    href: "mailto:support@skyhub.co",
  },
  {
    icon: Phone,
    label: "Telepon",
    value: "+62 21 500 780",
    href: "tel:+6221500780",
  },
  {
    icon: Smartphone,
    label: "Panel operasional",
    value: "+62 812 9000 1122",
    href: "tel:+6281290001122",
  },
  {
    icon: MessageCircleMore,
    label: "WhatsApp business",
    value: "+62 812 9000 3344",
    href: "https://wa.me/6281290003344",
  },
  {
    icon: Clock3,
    label: "Jam operasional",
    value: "Senin sampai Jumat, 08.00 sampai 20.00 WIB",
  },
  {
    icon: ShieldCheck,
    label: "Jalur dukungan",
    value: "Monitoring dukungan 24 jam untuk eskalasi operasional",
  },
];

export const COMPANY_OPERATIONAL_CONTACT_ITEMS: CompanyContactItem[] = [
  COMPANY_CONTACT_ITEMS[2],
  COMPANY_CONTACT_ITEMS[3],
  COMPANY_CONTACT_ITEMS[4],
  COMPANY_CONTACT_ITEMS[5],
  COMPANY_CONTACT_ITEMS[6],
  COMPANY_CONTACT_ITEMS[7],
  COMPANY_CONTACT_ITEMS[8],
  COMPANY_CONTACT_ITEMS[9],
];

export const COMPANY_DIGITAL_ITEMS: CompanyContactItem[] = [
  {
    icon: Globe2,
    label: "Portal resmi",
    value: APP_CANONICAL_URL,
    href: APP_CANONICAL_URL,
  },
  {
    icon: AtSign,
    label: "Instagram",
    value: "@skyhub.official",
    href: "https://instagram.com/skyhub.official",
  },
  {
    icon: Link2,
    label: "LinkedIn",
    value: "SkyHub Cargo Systems",
    href: "https://www.linkedin.com/company/skyhub-cargo-systems",
  },
];

export const COMPANY_SWIPE_CARDS: CompanySwipeCard[] = [
  {
    id: "ringkasan",
    label: "Ringkasan Perusahaan",
    title: "SkyHub mempertemukan pemantauan kargo, alur tinjauan, dan kendali peran dalam satu ruang kontrol.",
    description:
      "Platform ini dibuat untuk operasional harian yang padat. Data inti selalu berada di depan, masalah tidak tenggelam, dan staf dapat berpindah dari pelacakan ke manifest tanpa kehilangan konteks.",
    artworkSrc: "/auth/about-stage-atlas.svg",
    artworkAlt: "Adegan ringkasan perusahaan dengan pencahayaan aviasi dan komposisi ruang kendali.",
    stageEyebrow: "Panggung Identitas Perusahaan",
    stageLabel: "Atlas operasional dengan hierarki tenang",
    stageNote: "Kartu aktif mendorong visual hero agar identitas perusahaan, cakupan layanan, dan posisi produk terasa hidup sejak layar pertama.",
    sceneFacts: [
      { label: "Status operasional", value: "Normal dan aktif sepanjang shift" },
      { label: "Cakupan layanan", value: "Pengiriman, penerbangan, audit, portal pelanggan" },
      { label: "Nada visual", value: "Biru-putih, editorial, enterprise" },
    ],
    chips: ["Ruang kerja operasional", "Sistem biru berbasis brand", "Layout enterprise membulat"],
    metrics: [
      { label: "Ruang kendali", value: "Pusat operasi kargo internal" },
      { label: "Narasi utama", value: "Cepat dipindai tanpa kehilangan ketenangan" },
      { label: "Arah visual", value: "Sistem operasi internal premium" },
    ],
    note: "Ringkasan perusahaan harus terasa seperti satu deck identitas yang siap dibaca cepat, bukan paragraf profil statis.",
  },
  {
    id: "fokus",
    label: "Fokus Platform",
    title: "Lima kapabilitas utama dipusatkan untuk mempercepat pemindaian dan keputusan staf.",
    description:
      "Alih-alih daftar fitur panjang, kapabilitas platform dipresentasikan sebagai blok kerja yang langsung menjawab aktivitas shift dan pemantauan kiriman.",
    artworkSrc: "/auth/about-stage-operations.svg",
    artworkAlt: "Adegan kapabilitas operasional dengan lapisan pelacakan kargo dan bingkai seperti runway.",
    stageEyebrow: "Panggung Kapabilitas",
    stageLabel: "Blok fungsi yang terbaca seperti ruang kendali",
    stageNote: "Panggung visual diarahkan ke kapabilitas kerja: pelacakan, manifest, penugasan penerbangan, audit, dan pemberitahuan tersusun sebagai jalur informasi.",
    sceneFacts: [
      { label: "Pelacakan", value: "Linimasa AWB, status aktif, masalah, update terakhir" },
      { label: "Manifest", value: "Papan, filter cepat, tinjauan status, panel detail" },
      { label: "Audit", value: "Peringatan, kronologi, dan jalur eskalasi" },
    ],
    highlights: [
      {
        icon: Radar,
        title: "Pemantauan pengiriman",
        description: "Linimasa AWB, status aktif, masalah, dan update terakhir tampil sebagai konteks utama.",
      },
      {
        icon: Workflow,
        title: "Papan manifest",
        description: "Daftar pengiriman, filter cepat, tinjauan status, dan relasi ke panel detail dalam satu alur.",
      },
      {
        icon: PlaneTakeoff,
        title: "Assignment penerbangan",
        description: "Pengiriman yang terhubung ke penerbangan aktif tetap terlihat bersama kesiapan dan urgensinya.",
      },
      {
        icon: BellRing,
        title: "Audit & peringatan",
        description: "Catatan kronologis, peringatan masalah, dan jalur eskalasi dibangun untuk tindakan cepat.",
      },
    ],
    note: "Highlight kapabilitas harus terasa seperti blok kerja staf, bukan copy pemasaran generik.",
  },
  {
    id: "kualitas",
    label: "Kualitas Operasional",
    title: "Kepadatan informasi dibuat tinggi, tetapi ritme baca tetap dijaga.",
    description:
      "SkyHub menempatkan angka, waktu, identitas data, dan tingkat masalah sebagai hierarki primer. Efek visual dipakai seperlunya untuk memperjelas kondisi tampilan, bukan mengganggu fokus staf.",
    artworkSrc: "/auth/about-stage-network.svg",
    artworkAlt: "Adegan kualitas operasional dengan lapisan data, jarak rapi, dan cahaya koridor aviasi.",
    stageEyebrow: "Sinyal Kualitas",
    stageLabel: "Padat, terbaca, dan mudah diprediksi saat tekanan tinggi",
    stageNote: "Hero visual untuk card ini menegaskan bahwa ketenangan layout adalah bagian dari kualitas operasional, bukan hanya pilihan estetika.",
    sceneFacts: [
      { label: "Keterbacaan", value: "Angka dan identifier selalu paling kontras" },
      { label: "Desain state", value: "Hover, terpilih, peringatan, sinkron, kosong, memuat" },
      { label: "Stabilitas", value: "Panel terbatas dan mudah diprediksi selama shift" },
    ],
    metrics: [
      { label: "Kecepatan akses", value: "Pola layout konsisten untuk tugas berulang" },
      { label: "Struktur informasi", value: "Header, summary, table, detail panel terhubung jelas" },
      { label: "Stabilitas dasbor", value: "Panel terbatas dengan kondisi tampilan yang mudah diprediksi" },
      { label: "Akurasi data", value: "Status, log, dan dokumen diringkas dari sumber yang sama" },
      { label: "Kegunaan staf", value: "Pemindaian cepat di desktop, tetap nyaman di tablet/mobile" },
    ],
    note: "Prinsip kualitas dipresentasikan seperti KPI produk agar halaman profil terasa hidup dan dapat dipindai.",
  },
  {
    id: "akses",
    label: "Akses & Lingkungan",
    title: "Sistem menangani beberapa tipe pengguna dan perilaku ruang kerja yang berbeda.",
    description:
      "Operator internal membutuhkan pusat kendali yang padat. Portal pelanggan membutuhkan status yang lebih ringkas. Keduanya tetap memakai identitas visual yang sama, namun konteksnya dibedakan oleh akses berbasis peran.",
    artworkSrc: "/auth/about-stage-atlas.svg",
    artworkAlt: "Adegan lingkungan akses dengan lapisan ruang dan zona kontrol berbasis peran.",
    stageEyebrow: "Lingkungan Akses",
    stageLabel: "Identitas bersama dengan ruang kerja sadar peran",
    stageNote: "Kartu ini menegaskan bahwa pemisahan portal internal dan portal pelanggan dilakukan lewat akses, bukan lewat brand yang tercerai-berai.",
    sceneFacts: [
      { label: "Pengguna internal", value: "Staf operasional dan admin" },
      { label: "Portal pelanggan", value: "Status pengiriman dan dokumen ringkas berbasis akun" },
      { label: "Perilaku", value: "Menu samping, bar atas, penyegaran, preferensi bersifat personal" },
    ],
    highlights: [
      {
        icon: Users,
        title: "Pengguna internal",
        description: "Staf operasional dan admin mengelola manifest, pelacakan, tinjauan, dan masalah harian.",
      },
      {
        icon: BriefcaseBusiness,
        title: "Portal pelanggan",
        description: "Akun pelanggan melihat status pengiriman, linimasa, dan ringkasan dokumen secara terbatas.",
      },
      {
        icon: LockKeyhole,
        title: "Akses berbasis peran",
        description: "Panel, aksi, dan data yang tersedia menyesuaikan peran dan relasi akun.",
      },
      {
        icon: LayoutPanelTop,
        title: "Perilaku ruang kerja",
        description: "Menu samping, bar atas, preferensi, dan perilaku penyegaran tersimpan sebagai lingkungan kerja personal.",
      },
    ],
    note: "Perbedaan antar mode akses harus jelas, tetapi transisi mental pengguna tetap ringan karena bahasa visualnya konsisten.",
  },
  {
    id: "kontak",
    label: "Kontak Operasional",
    title: "Kontak penting diringkas dalam satu card besar yang bisa dipindai tanpa kelelahan visual.",
    description:
      "Alih-alih ditumpuk ke bawah sebagai banyak kartu kecil, kanal dukungan dirangkum menjadi daftar berhierarki dengan label, jalur utama, dan support path yang jelas.",
    artworkSrc: "/auth/about-stage-operations.svg",
    artworkAlt: "Operational contact scene with premium communication cards and calm enterprise framing.",
    stageEyebrow: "Support Lanes",
    stageLabel: "Escalation paths that do not exhaust the eye",
    stageNote: "Kontak operasional harus terasa seperti satu panel eskalasi yang siap dipakai, bukan deretan card kecil yang melelahkan.",
    sceneFacts: [
      { label: "General path", value: "Info, ops, support, telepon, panel operasional" },
      { label: "Availability", value: "Support monitoring 24 jam untuk isu kritis" },
      { label: "Reading rhythm", value: "Grid modular dengan label jelas dan ruang cukup" },
    ],
    contacts: COMPANY_OPERATIONAL_CONTACT_ITEMS,
    note: "Urutan kontak diprioritaskan untuk jalur umum, jalur operasional, eskalasi, dan ketersediaan support.",
  },
  {
    id: "jejak",
    label: "Lokasi & Jejak Digital",
    title: "Jejak perusahaan dirangkum sebagai lokasi operasional, kanal resmi, dan coverage digital.",
    description:
      "Card ini menjaga konteks organisasi tetap lengkap tanpa memecah perhatian dari command center utama.",
    artworkSrc: "/auth/about-stage-network.svg",
    artworkAlt: "Digital footprint scene with air route lattice and premium locator markers.",
    stageEyebrow: "Location and Coverage",
    stageLabel: "Operational footprint, not decorative marketing filler",
    stageNote: "Lokasi dan jejak digital ditempatkan sebagai context layer terakhir agar profile terasa lengkap, tetap ringkas, dan tidak berubah menjadi halaman marketing.",
    sceneFacts: [
      { label: "Lokasi utama", value: "Area logistik bandara Jakarta" },
      { label: "Rute prioritas", value: "SOQ, UPG, CGK, DPS, SUB, dan bandara konektor" },
      { label: "Jejak digital", value: "Website resmi, Instagram, dan LinkedIn perusahaan" },
    ],
    metrics: [
      { label: "Coverage", value: "Domestic trunk dan connector routes" },
      { label: "Digital channels", value: "Website, Instagram, LinkedIn" },
      { label: "Context", value: "Identitas operasional yang tetap terukur" },
    ],
    contacts: COMPANY_DIGITAL_ITEMS,
    note: "Digital footprint ditampilkan sebagai bagian dari identitas operasional, bukan elemen marketing yang dominan.",
  },
];

export const COMPANY_SUPPORT_SLA: CompanyFactItem[] = [
  {
    label: "Batas tindak lanjut",
    value: "< 5 menit untuk eskalasi operasional aktif",
  },
  {
    label: "Pembaruan status",
    value: "Sinkronisasi status dan audit trail per perubahan kerja",
  },
  {
    label: "Jalur tinjauan",
    value: "Masalah, hold, dan dokumen belum lengkap diarahkan ke tinjauan terpusat",
  },
];

export const COMPANY_SUPPORT_TIMELINE: CompanyTimelineItem[] = [
  {
    label: "01",
    title: "Penerimaan & validasi",
    description: "Pengiriman diterima, divalidasi, dan langsung masuk ke papan manifest serta konteks pelacakan.",
  },
  {
    label: "02",
    title: "Manifest & penugasan",
    description: "Operator mengaitkan pengiriman ke penerbangan, memeriksa kesiapan, dan menandai isu dokumen bila perlu.",
  },
  {
    label: "03",
    title: "Pemantauan perjalanan",
    description: "Linimasa AWB, status perjalanan, dan log kejadian diperbarui agar masalah tidak terlambat ditindak.",
  },
  {
    label: "04",
    title: "Penutupan & audit",
    description: "Riwayat aktivitas, dokumen, dan hasil status akhir tetap bisa ditelusuri untuk kebutuhan tinjauan.",
  },
];

export const COMPANY_OPERATIONAL_PRINCIPLES: CompanyHighlightItem[] = [
  {
    icon: Gauge,
    title: "Hierarki cepat pindai",
    description: "AWB, angka, dan tingkat masalah selalu tampil lebih kontras daripada dekorasi visual.",
  },
  {
    icon: ScanSearch,
    title: "Padat tetapi tenang",
    description: "Informasi dipadatkan secara disiplin tanpa menjadikan layar terasa sesak.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Data di atas ornamen",
    description: "Border, badge, dan hover dipakai untuk keputusan, bukan sekadar pemanis.",
  },
  {
    icon: Files,
    title: "Siap audit",
    description: "Log, status, dan dokumen dirancang agar mudah ditelusuri kembali saat tinjauan.",
  },
  {
    icon: Route,
    title: "Lingkungan sadar peran",
    description: "Perbedaan portal internal dan portal pelanggan diatur dari akses, bukan dari brand yang tercerai.",
  },
];
