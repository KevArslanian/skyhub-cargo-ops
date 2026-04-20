import {
  AtSign,
  Building2,
  Clock3,
  Globe2,
  Link2,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  ShieldCheck,
  Smartphone,
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

export const COMPANY_HERO_HEADLINE = "Tracking kargo udara yang cepat, padat, dan tetap tenang dibaca.";

export const COMPANY_HERO_COPY =
  "SkyHub membantu operator memantau AWB, papan flight, manifest, dan log audit dalam satu sistem yang stabil, rapi, dan siap digunakan sepanjang shift operasional.";

export const COMPANY_ABOUT_COPY =
  "SkyHub menghadirkan sistem operasional cargo udara yang menyatukan monitoring shipment, manifest, papan flight, dan log audit dalam antarmuka yang formal, stabil, dan mudah dibaca untuk kebutuhan harian ruang kontrol.";

export const COMPANY_OPERATOR_NOTE =
  "Tampilan dibuat dengan fokus pada keterbacaan cepat, struktur yang stabil, dan navigasi yang mudah dipahami untuk kebutuhan operasional harian.";

export const COMPANY_FACTS: CompanyFactItem[] = [
  {
    label: "Industri",
    value: "Operasional Kargo Udara dan Logistik Digital",
  },
  {
    label: "Layanan",
    value: "Pelacakan AWB, Papan Flight, Monitoring Manifest, Audit, dan Alert",
  },
  {
    label: "Cakupan",
    value: "Koordinasi Kargo Domestik dan Internasional",
  },
  {
    label: "Status",
    value: "Platform Operasional Kargo Enterprise",
  },
] as const;

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
    label: "Email Umum",
    value: "info@skyhub.co",
    href: "mailto:info@skyhub.co",
  },
  {
    icon: Mail,
    label: "Email Operasional",
    value: "ops@skyhub.co",
    href: "mailto:ops@skyhub.co",
  },
  {
    icon: Mail,
    label: "Email Dukungan",
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
    label: "Ponsel Operasional",
    value: "+62 812 9000 1122",
    href: "tel:+6281290001122",
  },
  {
    icon: MessageCircleMore,
    label: "WhatsApp Business",
    value: "+62 812 9000 3344",
    href: "https://wa.me/6281290003344",
  },
  {
    icon: Globe2,
    label: "Situs Web",
    value: "www.skyhub.co",
    href: "https://www.skyhub.co",
  },
  {
    icon: Clock3,
    label: "Jam Operasional",
    value: "Senin sampai Jumat, 08.00 sampai 20.00 WIB",
  },
  {
    icon: ShieldCheck,
    label: "Jalur Darurat Operasional",
    value: "24 jam monitoring support",
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
    href: "https://www.linkedin.com",
  },
] as const;

export const COMPANY_CONTACT_TEASER = [
  COMPANY_CONTACT_ITEMS[0],
  COMPANY_CONTACT_ITEMS[3],
  COMPANY_CONTACT_ITEMS[5],
  COMPANY_CONTACT_ITEMS[7],
] as const;
