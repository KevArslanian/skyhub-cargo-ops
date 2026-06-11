export type AlertResolutionMode = "corrective" | "incident" | "manual_confirm";

export type ComplaintTopic = "shipment" | "flight" | "document" | "service" | "other";

const ALERT_MODE_LABELS: Record<AlertResolutionMode, string> = {
  corrective: "Perbaikan data",
  incident: "Insiden operasional",
  manual_confirm: "Konfirmasi manual",
};

const ALERT_MODE_FOOTNOTES: Record<AlertResolutionMode, string> = {
  corrective:
    "Perbaiki data di modul sumber. Peringatan hilang sendiri setelah kondisi normal. Catat Sedang Ditangani hanya untuk mencatat penanggung jawab.",
  incident:
    "Kejadian sudah terjadi dan tidak bisa di-undo. Koordinasikan dampak, lalu Tutup Peringatan. Status operasional di modul sumber tetap tercatat.",
  manual_confirm:
    "Laporan perlu dicek manusia. Setelah verifikasi di modul terkait, Tutup Peringatan.",
};

const COMPLAINT_ESCALATION_DESK: Record<ComplaintTopic, string> = {
  shipment: "Tim Operasi Kargo (Shift Lead)",
  document: "Tim Operasi Kargo (Shift Lead)",
  flight: "Koordinator Ramp & Slot",
  service: "Lead Layanan Pelanggan",
  other: "Duty Manager Bandara",
};

const COMPLAINT_RESOLUTION_PLACEHOLDER: Partial<Record<ComplaintTopic, string>> = {
  shipment: "Jelaskan update status AWB atau tindakan yang sudah disampaikan ke pelanggan.",
  flight: "Jelaskan informasi jadwal/delay yang sudah dikomunikasikan ke pelanggan (tanpa mengubah status penerbangan).",
  document: "Jelaskan penyesuaian dokumen atau jawaban yang sudah diberikan ke pelanggan.",
  service: "Jelaskan respon layanan dan langkah tindak lanjut ke pelanggan.",
  other: "Jelaskan keputusan atau arahan yang sudah disampaikan ke pelanggan.",
};

const AWB_PATTERN = /^\d{3}-\d{8}$/;

export function getAlertResolutionMode(kind: string, context?: { minutesToCutoff?: number }): AlertResolutionMode {
  if (kind === "reported-awb-issue") return "manual_confirm";
  if (kind === "departure-overdue") return "corrective";
  if (kind === "cutoff-risk" && typeof context?.minutesToCutoff === "number" && context.minutesToCutoff < 0) {
    return "incident";
  }
  return "corrective";
}

export function getAlertResolutionModeLabel(mode: AlertResolutionMode) {
  return ALERT_MODE_LABELS[mode];
}

export function getAlertResolutionFootnote(mode: AlertResolutionMode) {
  return ALERT_MODE_FOOTNOTES[mode];
}

export function alertAllowsManualClose(mode: AlertResolutionMode) {
  return mode === "incident" || mode === "manual_confirm";
}

const ALERT_GROUP_LABELS: Record<string, string> = {
  "cutoff-risk": "Waktu",
  "stale-update": "Waktu",
  "departure-overdue": "Jadwal",
  "shipment-hold": "Manifest",
  "readiness-gate": "Manifest",
  "unassigned-flight": "Manifest",
  "capacity-risk": "Risiko Muatan",
  "reported-awb-issue": "Laporan Luar",
};

export type AlertGroupFilter = "all" | "waktu" | "jadwal" | "manifest" | "muatan" | "laporan";

const ALERT_GROUP_KINDS: Record<Exclude<AlertGroupFilter, "all">, string[]> = {
  waktu: ["cutoff-risk", "stale-update"],
  jadwal: ["departure-overdue"],
  manifest: ["shipment-hold", "readiness-gate", "unassigned-flight"],
  muatan: ["capacity-risk"],
  laporan: ["reported-awb-issue"],
};

export const ALERT_GROUP_FILTER_OPTIONS: { value: AlertGroupFilter; label: string }[] = [
  { value: "all", label: "Semua kelompok" },
  { value: "waktu", label: "Waktu" },
  { value: "jadwal", label: "Jadwal" },
  { value: "manifest", label: "Manifest" },
  { value: "muatan", label: "Risiko Muatan" },
  { value: "laporan", label: "Laporan Luar" },
];

export const ALERT_WORKFLOW_FILTER_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "open", label: "Belum ditangani" },
  { value: "acknowledged", label: "Sedang ditangani" },
] as const;

export function getAlertGroupLabel(kind: string) {
  return ALERT_GROUP_LABELS[kind] ?? "Operasional";
}

export function isAlertGroupFilter(value: string): value is AlertGroupFilter {
  return ALERT_GROUP_FILTER_OPTIONS.some((option) => option.value === value);
}

export function alertMatchesGroupFilter(kind: string, group: AlertGroupFilter) {
  if (group === "all") return true;
  return ALERT_GROUP_KINDS[group].includes(kind);
}

export function formatAlertSlaLabel(input: { kind: string; slaMinutes: number; slaRemainingMinutes: number }) {
  if (input.kind === "cutoff-risk") {
    if (input.slaRemainingMinutes < 0) {
      return `Batas terima lewat ${Math.abs(input.slaRemainingMinutes)} menit`;
    }
    return `Batas terima dalam ${input.slaRemainingMinutes} menit`;
  }

  if (input.kind === "departure-overdue") {
    if (input.slaRemainingMinutes < 0) {
      return `STD lewat ${Math.abs(input.slaRemainingMinutes)} menit`;
    }
    return `Ambang konfirmasi ${input.slaMinutes} menit`;
  }

  if (input.slaRemainingMinutes < 0) {
    return `Lewat ambang ${Math.abs(input.slaRemainingMinutes)} menit`;
  }

  if (input.slaMinutes > 0) {
    return `Sisa SLA ${input.slaRemainingMinutes} menit (batas ${input.slaMinutes} menit)`;
  }

  return `Sisa SLA ${input.slaRemainingMinutes} menit`;
}

export function getComplaintEscalationDesk(topic: string) {
  return COMPLAINT_ESCALATION_DESK[topic as ComplaintTopic] ?? COMPLAINT_ESCALATION_DESK.other;
}

export function getComplaintResolutionPlaceholder(topic: string) {
  return COMPLAINT_RESOLUTION_PLACEHOLDER[topic as ComplaintTopic] ?? COMPLAINT_RESOLUTION_PLACEHOLDER.other!;
}

export function buildComplaintReferenceHref(topic: string, referenceNo: string | null | undefined) {
  const ref = referenceNo?.trim();
  if (!ref) return null;

  if (topic === "shipment" || topic === "document") {
    const awb = AWB_PATTERN.test(ref) ? ref : null;
    if (awb) return `/shipment-ledger?query=${encodeURIComponent(awb)}`;
  }

  if (topic === "flight") {
    return `/flight-board?query=${encodeURIComponent(ref)}`;
  }

  if (topic === "shipment" && !AWB_PATTERN.test(ref)) {
    return `/awb-tracking?awb=${encodeURIComponent(ref)}`;
  }

  return null;
}

const COMPLAINT_QUEUE_PRIORITY: Record<string, number> = {
  new: 0,
  escalated: 1,
  in_review: 2,
  resolved: 3,
  closed: 4,
};

const TERMINAL_COMPLAINT_STATUSES = new Set(["resolved", "closed"]);

type ComplaintQueueSortable = {
  status: string;
  createdAt: Date;
  handledAt?: Date | null;
  updatedAt: Date;
};

function getComplaintQueuePriority(status: string) {
  return COMPLAINT_QUEUE_PRIORITY[status] ?? 99;
}

function getComplaintSecondarySortTime(item: ComplaintQueueSortable) {
  if (TERMINAL_COMPLAINT_STATUSES.has(item.status)) {
    return (item.handledAt ?? item.updatedAt).getTime();
  }
  return item.createdAt.getTime();
}

export function compareComplaintsForQueue(a: ComplaintQueueSortable, b: ComplaintQueueSortable) {
  const priorityDiff = getComplaintQueuePriority(a.status) - getComplaintQueuePriority(b.status);
  if (priorityDiff !== 0) return priorityDiff;
  return getComplaintSecondarySortTime(b) - getComplaintSecondarySortTime(a);
}

export function sortComplaintsForQueue<T extends ComplaintQueueSortable>(items: T[]) {
  return [...items].sort(compareComplaintsForQueue);
}

const COMPLAINT_TRANSITIONS: Record<string, Set<string>> = {
  new: new Set(["in_review", "closed"]),
  in_review: new Set(["escalated", "resolved", "closed"]),
  escalated: new Set(["resolved", "closed"]),
  resolved: new Set([]),
  closed: new Set([]),
};

export function assertComplaintStatusTransition(current: string, next: string) {
  const allowed = COMPLAINT_TRANSITIONS[current];
  if (!allowed?.has(next)) {
    throw new Error(`TRANSITION_INVALID:${current}:${next}`);
  }
}

export function isComplaintTransitionValid(current: string, next: string) {
  try {
    assertComplaintStatusTransition(current, next);
    return true;
  } catch {
    return false;
  }
}