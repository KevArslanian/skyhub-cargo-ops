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
  "SkyHub menyatukan pelacakan AWB, manifest board, pengelolaan shipment, audit, alert, dan preferensi operator dalam satu sistem operasional yang formal, tenang, dan siap dipakai sepanjang hari.";

export const COMPANY_ABOUT_COPY =
  "Dirancang untuk operator, admin, supervisor, dan customer portal, SkyHub menjaga hierarchy data tetap tegas: status lebih cepat terbaca, exception lebih cepat terlihat, dan aksi kerja tetap dekat ke konteks shipment.";

export const COMPANY_HERO_PILLS = [
  "Internal cargo operations system",
  "Swipeable information deck",
  "Manual controls, no autoplay",
] as const;

export const COMPANY_OPERATOR_NOTE =
  "Setiap panel dibuat untuk keputusan cepat: identifier selalu lebih dominan daripada ornamen, status penting selalu memiliki affordance yang jelas, dan ritme panel sengaja dijaga agar padat informasi tanpa terasa bising.";

export const COMPANY_HERO_METRICS: CompanyFactItem[] = [
  {
    label: "Mode Operasional",
    value: "Internal cargo operations workspace",
  },
  {
    label: "Cakupan",
    value: "AWB tracking, manifest, audit, alerts, user preferences",
  },
  {
    label: "Akses",
    value: "Operator, supervisor, admin, dan portal pelanggan",
  },
];

export const COMPANY_FACTS: CompanyFactItem[] = [
  {
    label: "Industri",
    value: "Operasional kargo udara dan logistik digital",
  },
  {
    label: "Platform",
    value: "Command center internal dengan portal akun pelanggan",
  },
  {
    label: "Cakupan layanan",
    value: "Monitoring shipment, manifest, assignment flight, audit, alert, dan review readiness",
  },
  {
    label: "Karakter produk",
    value: "Enterprise dashboard yang fokus pada speed of scanning dan operational clarity",
  },
];

export const COMPANY_CONTACT_ITEMS: CompanyContactItem[] = [
  {
    icon: Building2,
    label: "Kantor",
    value: "SkyHub Operations Center",
  },
  {
    icon: MapPin,
    label: "Alamat",
    value: "Jl. Kargo Internasional No. 12, Area Logistik Bandara, Jakarta 15126, Indonesia",
  },
  {
    icon: Mail,
    label: "Email umum",
    value: "info@skyhub.co",
    href: "mailto:info@skyhub.co",
  },
  {
    icon: Mail,
    label: "Email operasional",
    value: "ops@skyhub.co",
    href: "mailto:ops@skyhub.co",
  },
  {
    icon: Mail,
    label: "Email dukungan",
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
    label: "Support path",
    value: "24 jam monitoring support untuk eskalasi operasional",
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
    label: "Website",
    value: "www.skyhub.co",
    href: "https://www.skyhub.co",
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
    title: "SkyHub mempertemukan monitoring kargo, alur review, dan kendali peran dalam satu ruang kontrol.",
    description:
      "Platform ini dibuat untuk operasional harian yang padat. Data inti selalu berada di depan, exception tidak tenggelam, dan operator dapat berpindah dari tracking ke manifest tanpa kehilangan konteks.",
    artworkSrc: "/auth/about-stage-atlas.svg",
    artworkAlt: "Editorial company summary scene with aviation lighting and command deck composition.",
    stageEyebrow: "Company Identity Stage",
    stageLabel: "Operational atlas with calm hierarchy",
    stageNote: "Card aktif mendorong hero visual agar identitas perusahaan, scope layanan, dan positioning produk terasa hidup sejak fold pertama.",
    sceneFacts: [
      { label: "Status operasional", value: "Normal dan aktif sepanjang shift" },
      { label: "Scope layanan", value: "Shipment, flight, audit, customer portal" },
      { label: "Visual tone", value: "Blue-white, editorial, enterprise" },
    ],
    chips: ["Operational workspace", "Brand-led blue system", "Rounded enterprise layout"],
    metrics: [
      { label: "Ruang kendali", value: "Internal cargo operations center" },
      { label: "Narasi utama", value: "Speed of scanning without losing calm" },
      { label: "Arah visual", value: "Premium internal operations system" },
    ],
    note: "Ringkasan perusahaan harus terasa seperti satu deck identitas yang siap dibaca cepat, bukan paragraf profil statis.",
  },
  {
    id: "fokus",
    label: "Fokus Platform",
    title: "Lima capability utama dipusatkan untuk mempercepat pemindaian dan keputusan operator.",
    description:
      "Alih-alih daftar fitur panjang, capability platform dipresentasikan sebagai blok kerja yang langsung menjawab aktivitas shift dan monitoring kiriman.",
    artworkSrc: "/auth/about-stage-operations.svg",
    artworkAlt: "Operational capability scene with modular cargo tracking overlays and runway-like framing.",
    stageEyebrow: "Capability Stage",
    stageLabel: "Function blocks that read like a control deck",
    stageNote: "Visual stage diarahkan ke kapabilitas kerja: tracking, manifest, flight assignment, audit, dan notifikasi tersusun sebagai runway informasi.",
    sceneFacts: [
      { label: "Tracking", value: "Timeline AWB, status aktif, exception, update terakhir" },
      { label: "Manifest", value: "Board, filter cepat, review status, detail panel" },
      { label: "Audit", value: "Alert, chronology, dan jalur eskalasi" },
    ],
    highlights: [
      {
        icon: Radar,
        title: "Monitoring shipment",
        description: "Timeline AWB, status aktif, exception, dan update terakhir tampil sebagai konteks utama.",
      },
      {
        icon: Workflow,
        title: "Manifest board",
        description: "Daftar shipment, filter cepat, review status, dan relasi ke panel detail dalam satu flow.",
      },
      {
        icon: PlaneTakeoff,
        title: "Flight assignment",
        description: "Shipment yang terhubung ke flight aktif tetap terlihat bersama readiness dan urgensinya.",
      },
      {
        icon: BellRing,
        title: "Audit & alert",
        description: "Log kronologis, exception alerts, dan jalur eskalasi dibangun untuk tindakan cepat.",
      },
    ],
    note: "Capability highlights harus terasa seperti blok kerja operator, bukan copy pemasaran generik.",
  },
  {
    id: "kualitas",
    label: "Kualitas Operasional",
    title: "Kepadatan informasi dibuat tinggi, tetapi ritme baca tetap dijaga.",
    description:
      "SkyHub menempatkan angka, timestamp, identifier, dan severity sebagai hirarki primer. Efek visual dipakai seperlunya untuk memperjelas state, bukan mengganggu fokus operator.",
    artworkSrc: "/auth/about-stage-network.svg",
    artworkAlt: "Operational quality scene with layered data bands, clean spacing, and aviation corridor lighting.",
    stageEyebrow: "Quality Signals",
    stageLabel: "Dense, legible, and predictable under pressure",
    stageNote: "Hero visual untuk card ini menegaskan bahwa ketenangan layout adalah bagian dari kualitas operasional, bukan hanya pilihan estetika.",
    sceneFacts: [
      { label: "Readability", value: "Angka dan identifier selalu paling kontras" },
      { label: "State design", value: "Hover, selected, warning, sync, empty, loading" },
      { label: "Stability", value: "Panel bounded dan mudah diprediksi selama shift" },
    ],
    metrics: [
      { label: "Kecepatan akses", value: "Pola layout konsisten untuk tugas berulang" },
      { label: "Struktur informasi", value: "Header, summary, table, detail panel terhubung jelas" },
      { label: "Stabilitas dashboard", value: "Panel bounded dengan state yang mudah diprediksi" },
      { label: "Akurasi data", value: "Status, log, dan dokumen diringkas dari sumber yang sama" },
      { label: "Usability operator", value: "Scanning cepat di desktop, tetap nyaman di tablet/mobile" },
    ],
    note: "Quality principles dipresentasikan seperti KPI produk agar halaman profile terasa hidup dan dapat dipindai.",
  },
  {
    id: "akses",
    label: "Akses & Environment",
    title: "Sistem menangani beberapa tipe pengguna dan workspace behavior yang berbeda.",
    description:
      "Operator internal membutuhkan command center yang padat. Portal pelanggan membutuhkan status yang lebih ringkas. Keduanya tetap memakai identitas visual yang sama, namun konteksnya dibedakan oleh role-based access.",
    artworkSrc: "/auth/about-stage-atlas.svg",
    artworkAlt: "Access environment scene with layered lounge framing and role-based control zones.",
    stageEyebrow: "Access Environment",
    stageLabel: "Shared identity with role-aware workspaces",
    stageNote: "Card ini harus menegaskan bahwa pemisahan internal portal dan customer portal dilakukan lewat akses, bukan lewat brand yang tercerai-berai.",
    sceneFacts: [
      { label: "Pengguna internal", value: "Operator, supervisor, admin" },
      { label: "Portal pelanggan", value: "Status shipment dan dokumen ringkas berbasis akun" },
      { label: "Behavior", value: "Sidebar, topbar, refresh, preferensi bersifat personal" },
    ],
    highlights: [
      {
        icon: Users,
        title: "Pengguna internal",
        description: "Operator, supervisor, dan admin mengelola manifest, tracking, review, dan exception harian.",
      },
      {
        icon: BriefcaseBusiness,
        title: "Portal pelanggan",
        description: "Akun pelanggan melihat status shipment, timeline, dan ringkasan dokumen secara terbatas.",
      },
      {
        icon: LockKeyhole,
        title: "Role-based access",
        description: "Panel, aksi, dan data yang tersedia menyesuaikan peran dan relasi account.",
      },
      {
        icon: LayoutPanelTop,
        title: "Workspace behavior",
        description: "Sidebar, topbar, preferensi, dan refresh behavior tersimpan sebagai lingkungan kerja personal.",
      },
    ],
    note: "Perbedaan antar mode akses harus jelas, tetapi transisi mental user tetap ringan karena language visualnya konsisten.",
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
    label: "Response target",
    value: "< 5 menit untuk eskalasi operasional aktif",
  },
  {
    label: "Update rhythm",
    value: "Sinkronisasi status dan audit trail per perubahan kerja",
  },
  {
    label: "Review path",
    value: "Exception, hold, dan dokumen incomplete diarahkan ke review terpusat",
  },
];

export const COMPANY_SUPPORT_TIMELINE: CompanyTimelineItem[] = [
  {
    label: "01",
    title: "Intake & validation",
    description: "Shipment diterima, divalidasi, dan langsung masuk ke papan manifest serta tracking context.",
  },
  {
    label: "02",
    title: "Manifest & assignment",
    description: "Operator mengaitkan shipment ke flight, memeriksa readiness, dan menandai isu dokumen bila perlu.",
  },
  {
    label: "03",
    title: "In-transit monitoring",
    description: "Timeline AWB, status perjalanan, dan log event diperbarui agar exception tidak terlambat ditindak.",
  },
  {
    label: "04",
    title: "Closure & audit",
    description: "Riwayat aktivitas, dokumen, dan hasil status akhir tetap bisa ditelusuri untuk kebutuhan review.",
  },
];

export const COMPANY_OPERATIONAL_PRINCIPLES: CompanyHighlightItem[] = [
  {
    icon: Gauge,
    title: "Scan-first hierarchy",
    description: "AWB, angka, dan severity selalu tampil lebih kontras daripada dekorasi visual.",
  },
  {
    icon: ScanSearch,
    title: "Dense but calm",
    description: "Informasi dipadatkan secara disiplin tanpa menjadikan layar terasa sesak.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Data over ornament",
    description: "Border, badge, dan hover dipakai untuk keputusan, bukan sekadar pemanis.",
  },
  {
    icon: Files,
    title: "Audit-ready",
    description: "Log, status, dan dokumen dirancang agar mudah ditelusuri kembali saat review.",
  },
  {
    icon: Route,
    title: "Role-aware environment",
    description: "Perbedaan internal portal dan customer portal diatur dari akses, bukan dari brand yang tercerai.",
  },
];
