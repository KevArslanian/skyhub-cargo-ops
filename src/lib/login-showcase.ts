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
    label: "Admin",
    email: "admin@skyhub.test",
    password: "operator123",
    description: "Kontrol penuh untuk konfigurasi, pengguna, audit, dan review state lintas modul.",
  },
  {
    label: "Supervisor",
    email: "supervisor@skyhub.test",
    password: "operator123",
    description: "Monitoring flight readiness, review exception, dan pengawasan manifest aktif.",
  },
  {
    label: "Operator",
    email: "operator@skyhub.test",
    password: "operator123",
    description: "Workflow harian untuk ledger shipment, tracking AWB, dan tindakan operasional cepat.",
  },
  {
    label: "Customer",
    email: "customer@skyhub.test",
    password: "operator123",
    description: "Portal pelanggan untuk visibilitas shipment yang terkontrol dan berbasis akun.",
  },
] as const;

export const LOGIN_EDITORIAL_SUPPORT = [
  "Manual scene switching tanpa autoplay agar operator tetap memegang kontrol visual.",
  "Structured error mapping untuk kredensial, status akun, dan backend setup issue.",
  "Public preface dan access portal tetap dipisah agar hierarchy narasi brand tidak bercampur dengan auth form.",
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
    label: "Demo personas",
    value: "4 akun aktif untuk admin, supervisor, operator, customer",
  },
];

export const LOGIN_CAPABILITY_CARDS = [
  {
    label: "Tracking Signal",
    title: "Timeline AWB terasa dekat dengan keputusan.",
    copy: "Status, milestone, exception, dan event log ditempatkan untuk kecepatan scan, bukan sekadar dekorasi dashboard.",
  },
  {
    label: "Manifest Review",
    title: "Ledger padat data tetap punya ritme yang tenang.",
    copy: "Filter, table, detail panel, urgency, dan confidence tetap terbaca bahkan saat shift sedang padat.",
  },
  {
    label: "Controlled Access",
    title: "Satu gate, scope berbeda untuk tiap persona.",
    copy: "Admin, supervisor, operator, dan customer berbagi identitas visual yang sama dengan batas kerja yang jelas.",
  },
] as const;

export const LOGIN_SHOWCASE_SCENES: LoginShowcaseScene[] = [
  {
    id: "charter",
    label: "Scene 01",
    eyebrow: "Editorial Access Deck",
    title: "Quiet authority for cargo operations access.",
    description:
      "Scene pertama menempatkan login sebagai ritual masuk ke ruang kontrol yang tenang, premium, dan sangat terarah. Fokus utamanya bukan efek berlebihan, tetapi kesiapan operator untuk mulai bekerja.",
    imageSrc: "/auth/login-scene-charter.svg",
    imageAlt: "Editorial aviation access scene with framed runway lighting and private lounge mood.",
    sceneTag: "Private-grade command entry",
    footerLeft: "Framed for fast sign-in and immediate orientation",
    footerRight: "Aviation mood without turning into marketing landing page",
    filmNote: "Scene ini dipakai untuk membangun rasa calm, premium, dan command-ready sebelum form disentuh.",
    facts: [
      { label: "Mood", value: "Calm, precise, editorial" },
      { label: "Access tone", value: "Premium internal operations system" },
      { label: "Primary cue", value: "Runway glow, deep navy, cream frame" },
    ],
    stats: [
      { label: "CTA priority", value: "Form login tetap paling jelas" },
      { label: "Transition", value: "Crossfade + caption drift ringan" },
      { label: "Focus", value: "Zero clutter before sign-in" },
    ],
    pulses: ["Secure gate", "Manual scene control", "Keyboard friendly"],
  },
  {
    id: "suite",
    label: "Scene 02",
    eyebrow: "Role-Based Entry",
    title: "One portal for internal teams and customer visibility.",
    description:
      "Scene kedua menegaskan bahwa SkyHub melayani dua ritme kerja: command center internal yang padat, dan customer portal yang lebih ringkas. Keduanya dibedakan melalui akses, bukan dengan memecah brand.",
    imageSrc: "/auth/login-scene-suite.svg",
    imageAlt: "Refined split-lounge scene blending executive operations mood and partner access atmosphere.",
    sceneTag: "Shared brand, separated scopes",
    footerLeft: "Admin, supervisor, operator, and customer share one access language",
    footerRight: "Scope dibedakan oleh role-based logic, bukan visual yang terpecah",
    filmNote: "Komposisi split memberi sinyal bahwa satu sistem melayani workflow berbeda tanpa kehilangan disiplin visual.",
    facts: [
      { label: "Personas", value: "Admin, supervisor, operator, customer" },
      { label: "Navigation tone", value: "Structured, manual, non-gimmicky" },
      { label: "Layout cue", value: "Split scene and anchored auth rail" },
    ],
    stats: [
      { label: "Support lane", value: "Demo account fill + inline guidance" },
      { label: "Auth error UX", value: "Specific and machine-readable" },
      { label: "Scene intent", value: "Partnership without mixing hierarchy" },
    ],
    pulses: ["Role-aware access", "Preview and production ready", "Readable on tablet"],
  },
  {
    id: "grid",
    label: "Scene 03",
    eyebrow: "Capability Stage",
    title: "Tracking, manifest, audit, and access in one composed frame.",
    description:
      "Scene ketiga membuat login terasa seperti pintu masuk ke sistem yang benar-benar punya isi. Capability modules, support metrics, dan auth rail ditempatkan sebagai deck editorial yang tetap fokus pada aksi masuk.",
    imageSrc: "/auth/login-scene-grid.svg",
    imageAlt: "Editorial operational capability scene with modular dashboard framing and cargo-ready controls.",
    sceneTag: "Capability-first access portal",
    footerLeft: "Visual stage, film strip, and auth rail move in one system",
    footerRight: "Effects are controlled so form clarity never degrades",
    filmNote: "Scene ini paling operasional: visual tetap atmosferik, tetapi cue-nya langsung mengarah ke fungsi inti SkyHub.",
    facts: [
      { label: "Modules", value: "AWB, ledger, settings, company preface" },
      { label: "Interaction", value: "Thumbnail selector with manual transitions" },
      { label: "Visual base", value: "Cream editorial shell with navy brand accents" },
    ],
    stats: [
      { label: "Motion rule", value: "No autoplay, reduced-motion respected" },
      { label: "Responsive", value: "Form rises above fold on tablet/mobile" },
      { label: "Auth state", value: "Loading, success, setup issue, and error" },
    ],
    pulses: ["Command-ready", "Scene aware", "Stateful form feedback"],
  },
];
