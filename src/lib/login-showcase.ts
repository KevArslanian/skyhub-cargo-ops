export const DEMO_LOGIN_ACCOUNTS = [
  {
    label: "Admin",
    email: "admin@skyhub.test",
    password: "operator123",
    description: "Kontrol penuh untuk konfigurasi, pengguna, dan audit.",
  },
  {
    label: "Supervisor",
    email: "supervisor@skyhub.test",
    password: "operator123",
    description: "Monitoring performa flight, review, dan manifest oversight.",
  },
  {
    label: "Operator",
    email: "operator@skyhub.test",
    password: "operator123",
    description: "Workflow harian untuk ledger shipment dan tracking AWB.",
  },
  {
    label: "Customer",
    email: "customer@skyhub.test",
    password: "operator123",
    description: "Akses portal pelanggan untuk shipment visibility yang terkurasi.",
  },
] as const;

export const LOGIN_EDITORIAL_SUPPORT = [
  "Postgres-backed session auth",
  "4 role demo siap pakai",
  "Operator-first command workspace",
] as const;

export const LOGIN_CAPABILITY_CARDS = [
  {
    label: "Tracking Signal",
    title: "AWB lookup yang cepat dipindai",
    copy: "Status, milestone, alert exception, dan event log disusun untuk pengambilan keputusan yang lebih cepat.",
  },
  {
    label: "Manifest Focus",
    title: "Ledger yang tetap tajam saat padat data",
    copy: "Filter operasional, sticky table, dan panel detail menjaga alur review tetap presisi sepanjang shift.",
  },
  {
    label: "Controlled Access",
    title: "Role-based login untuk tiap persona",
    copy: "Admin, supervisor, operator, dan customer tetap berada pada workspace serta level akses yang relevan.",
  },
] as const;

export const LOGIN_SHOWCASE_SCENES = [
  {
    id: "charter",
    label: "Scene 01",
    eyebrow: "Editorial Access",
    title: "Private-grade calm for cargo command.",
    description:
      "Nuansa premium yang tenang dipakai sebagai pintu masuk ke ruang kontrol, agar operator langsung masuk ke mode kerja yang fokus dan rapi.",
    imageSrc: "/auth/login-scene-charter.svg",
    imageAlt: "Editorial dusk scene with aircraft silhouette and premium command framing.",
    footerLeft: "Structured for fast operational decisions",
    footerRight: "SkyHub control access",
    facts: [
      { label: "Mood", value: "Calm, premium, operational" },
      { label: "Primary use", value: "Daily sign-in for ops center" },
      { label: "Visual anchor", value: "Aviation silhouette and dusk gradient" },
    ],
  },
  {
    id: "suite",
    label: "Scene 02",
    eyebrow: "Role-Based Entry",
    title: "One gate for internal teams and customer visibility.",
    description:
      "Komposisi split-panel menandai bahwa satu sistem melayani operator internal sekaligus akses pelanggan, tanpa mencampur hirarki kerja masing-masing.",
    imageSrc: "/auth/login-scene-suite.svg",
    imageAlt: "Premium split-panel scene showing executive operations and business lounge atmosphere.",
    footerLeft: "Supervisor, operator, admin, customer",
    footerRight: "Shared brand, separated access scope",
    facts: [
      { label: "Personas", value: "Admin, supervisor, operator, customer" },
      { label: "CTA hierarchy", value: "Login tetap paling dominan" },
      { label: "Visual cue", value: "Split scene for internal and partner access" },
    ],
  },
  {
    id: "grid",
    label: "Scene 03",
    eyebrow: "Capability Deck",
    title: "Tracking, manifest, audit, and support in one editorial frame.",
    description:
      "Scene ketiga menegaskan bahwa halaman login bukan sekadar form, tetapi entry point ke sistem operasional yang jelas kapabilitas dan ritmenya.",
    imageSrc: "/auth/login-scene-grid.svg",
    imageAlt: "Cream editorial capability layout with modular panels and operational cards.",
    footerLeft: "Capability-first login canvas",
    footerRight: "Readable even before first interaction",
    facts: [
      { label: "Core modules", value: "AWB tracking, ledger, settings, profile" },
      { label: "Interaction", value: "Scene switcher with framed thumbnails" },
      { label: "Tone", value: "Cream editorial surface with navy brand accents" },
    ],
  },
] as const;
