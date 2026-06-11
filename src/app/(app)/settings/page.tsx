"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
} from "lucide-react";
import {
  formatStationLabel,
  formatStationShortLabel,
  ORG_TIME_ZONE_LABEL,
  ROLE_LABELS,
  stationSelectOptions,
  USER_STATUS_LABELS,
} from "@/lib/constants";
import { useVisibleTablePageSize } from "@/lib/use-visible-table-page-size";
import { cn } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { OpsLockedPage } from "@/components/ops-locked-page";
import { DataCard, OpsPanel, PageHeader, PaginationBar, SectionHeader, SkeletonBlock } from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";
import { GlassSelect } from "@/components/glass-select";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { validateInviteUserForm } from "@/lib/client-validation";
import { sanitizePersonName, sanitizePhoneInput } from "@/lib/input-guards";
import { generateStaffPassword } from "@/lib/password-utils";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";

const CAPABILITY_OPTIONS = [
  { value: "shipment:create", label: "Buat pengiriman", description: "Membuat AWB kargo dan manifest baru" },
  { value: "shipment:update", label: "Ubah pengiriman", description: "Mengubah detail berat, koli, dan status kargo" },
  { value: "shipment:delete", label: "Hapus pengiriman", description: "Menghapus entri kargo dari buku pengiriman" },
  { value: "shipment:document", label: "Dokumen pengiriman", description: "Mengunggah dan memvalidasi berkas dokumen manifest" },
  { value: "flight:manage", label: "Kelola penerbangan", description: "Membuat, mengubah, dan menjadwalkan penerbangan baru" },

  { value: "reports:export", label: "Cetak laporan", description: "Mencetak data operasional ke PDF atau penampil peramban" },
  { value: "users:manage", label: "Kelola pengguna", description: "Mengundang dan mengelola hak akses anggota tim" },
  { value: "settings:workspace", label: "Ruang kerja", description: "Mengatur preferensi dan tampilan default sistem" },
] as const;

type SettingsCapability = (typeof CAPABILITY_OPTIONS)[number]["value"];

function defaultCapabilitiesForRole(role: "admin" | "staff"): SettingsCapability[] {
  if (role === "admin") return CAPABILITY_OPTIONS.map((item) => item.value);
  return ["shipment:create", "shipment:update", "shipment:delete", "shipment:document", "flight:manage", "reports:export"];
}

type SettingsPayload = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "staff";
    station: string;
  };
  settings: {
    theme: "light" | "dark" | "system";
    compactRows: boolean;
    sidebarCollapsed: boolean;
    autoRefresh: boolean;
    refreshIntervalSeconds: number;
    soundAlert: boolean;
    accentColor: string;
  } | null;
  permissions: {
    canManageUsers: boolean;
    canManageCustomerAccounts: boolean;
    canManageWorkspace: boolean;
  };
  users: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: "admin" | "staff";
    station: string;
    status: "active" | "invited" | "disabled";
    capabilities: SettingsCapability[];
  }[];
};

type SettingsDraft = {
  name: string;
  station: string;
  theme: "light" | "dark" | "system";
  accentColor: string;
  compactRows: boolean;
  sidebarCollapsed: boolean;
  autoRefresh: boolean;
  refreshIntervalSeconds: number;
  soundAlert: boolean;
};

function toSettingsPatch(draft: SettingsDraft) {
  return {
    name: draft.name,
    theme: draft.theme,
    accentColor: draft.accentColor,
    compactRows: draft.compactRows,
    sidebarCollapsed: draft.sidebarCollapsed,
    autoRefresh: draft.autoRefresh,
    refreshIntervalSeconds: draft.refreshIntervalSeconds,
    soundAlert: draft.soundAlert,
  };
}

function toDraft(data: SettingsPayload | null): SettingsDraft {
  return {
    name: data?.profile.name ?? "",
    station: data?.profile.station ?? "SOQ",
    theme: (data?.settings?.theme as "light" | "dark" | "system") ?? "light",
    accentColor: data?.settings?.accentColor ?? (typeof window !== "undefined" ? window.localStorage.getItem("skyhub-accent-color") : null) ?? "blue",
    compactRows: data?.settings?.compactRows ?? false,
    sidebarCollapsed: data?.settings?.sidebarCollapsed ?? false,
    autoRefresh: data?.settings?.autoRefresh ?? true,
    refreshIntervalSeconds: data?.settings?.refreshIntervalSeconds ?? 5,
    soundAlert: data?.settings?.soundAlert ?? false,
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SettingsIdentitySummary({
  draft,
  profile,
  variant = "sidebar",
}: {
  draft: SettingsDraft;
  profile: SettingsPayload["profile"];
  variant?: "sidebar" | "inline";
}) {
  const displayName = draft.name || profile.name;

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary)] font-[family:var(--font-heading)] text-[1.05rem] font-black tracking-[-0.04em] text-white">
          {getInitials(displayName || "Sky Hub")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[color:var(--text-strong)]">{displayName}</p>
          <p className="truncate text-xs text-[color:var(--muted-2)]">{profile.email}</p>
        </div>
        <div className="flex max-w-full flex-col items-start gap-1.5">
          <StatusBadge value="info" label={ROLE_LABELS[profile.role]} compact />
          <StatusBadge value="active" label={formatStationShortLabel(draft.station)} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-identity-card overflow-hidden rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
      <div className="flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary)] font-[family:var(--font-heading)] text-[1.05rem] font-black tracking-[-0.04em] text-white">
          {getInitials(displayName || "Sky Hub")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[color:var(--text-strong)]">{displayName}</p>
          <p className="truncate text-xs text-[color:var(--muted-2)]">{profile.email}</p>
          <div className="mt-2.5 flex max-w-full flex-col items-start gap-1.5">
            <StatusBadge value="info" label={ROLE_LABELS[profile.role]} compact />
            <StatusBadge value="active" label={formatStationShortLabel(draft.station)} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

const NOTIFICATION_SIMULATION_SCENARIOS = [
  {
    title: "[Simulasi] Peringatan Cutoff Kargo",
    message:
      "Penerbangan IN-284 menuju Jakarta: batas muat kargo tersisa 12 menit. Dua AWB belum terkonfirmasi di sortasi.",
    type: "error",
    href: "/alerts",
  },
  {
    title: "[Simulasi] Anomali Berat Kargo",
    message:
      "AWB 910-12345678 melebihi kapasitas slot pesawat GA-880. Perlu peninjauan supervisor sebelum pemuatan.",
    type: "warning",
    href: "/alerts",
  },
  {
    title: "[Simulasi] Penerbangan Terlambat",
    message:
      "Penerbangan QG-412 dari Sorong tertunda 35 menit. Tiga manifest ekspor perlu penjadwalan ulang cutoff.",
    type: "warning",
    href: "/flight-board",
  },
] as const;

let notificationSimulationIndex = 0;

function simulateOperationalNotification(
  draft: SettingsDraft,
  options?: {
    forceSound?: boolean;
  },
) {
  if (typeof window === "undefined") return;

  const scenario = NOTIFICATION_SIMULATION_SCENARIOS[notificationSimulationIndex];
  notificationSimulationIndex = (notificationSimulationIndex + 1) % NOTIFICATION_SIMULATION_SCENARIOS.length;
  const timeLabel = `22:32 ${ORG_TIME_ZONE_LABEL}`;
  const shouldPlaySound = options?.forceSound === true || draft.soundAlert;

  window.dispatchEvent(
    new CustomEvent("skyhub:settings-preview", {
      detail: { soundAlert: shouldPlaySound },
    }),
  );

  window.requestAnimationFrame(() => {
    window.dispatchEvent(
      new CustomEvent("skyhub:notification-preview", {
        detail: {
          ...scenario,
          message: `${scenario.message} (${timeLabel})`,
          soundAlert: draft.soundAlert,
          forceSound: options?.forceSound,
        },
      }),
    );
  });
}

function WorkspaceSettingsPanel({
  draft,
  onPatch,
}: {
  draft: SettingsDraft;
  onPatch: (patch: Partial<SettingsDraft>) => void;
}) {
  const accentOptions = [
    { value: "blue", hex: "#003d9b", label: "Biru" },
    { value: "teal", hex: "#0d9488", label: "Hijau kebiruan" },
    { value: "amber", hex: "#d97706", label: "Kuning" },
    { value: "rose", hex: "#e11d48", label: "Merah muda" },
    { value: "violet", hex: "#7c3aed", label: "Ungu" },
  ];

  return (
    <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ops-eyebrow">Preferensi Ruang Kerja</p>
          <p className="mt-1 text-lg font-bold text-[color:var(--text-strong)]">Pengaturan</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">
            Aksen warna, susunan data, pemberitahuan operasional, dan ritme kerja. Mode tampilan ada di bar atas.
          </p>
        </div>

      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">Aksen</p>
          <div className="flex flex-wrap gap-2.5">
            {accentOptions.map((color) => (
              <button
                key={color.value}
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-all",
                  draft.accentColor === color.value
                    ? "border-[color:var(--text-strong)] ring-2 ring-[color:var(--brand-primary-soft)] ring-offset-2 ring-offset-[color:var(--panel-muted)]"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: color.hex }}
                onClick={() => onPatch({ accentColor: color.value })}
                aria-label={`Warna aksen ${color.label}`}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-2 rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4 sm:grid-cols-2">
          <button
            type="button"
            className={cn(
              "rounded-[16px] border px-3 py-3 text-left transition-all",
              !draft.compactRows
                ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]"
                : "border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]",
            )}
            onClick={() => onPatch({ compactRows: false })}
          >
            <span className="block text-xs font-bold text-[color:var(--text-strong)]">Nyaman</span>
            <span className="mt-1 block text-[11px] text-[color:var(--muted-fg)]">Baris lega</span>
          </button>
          <button
            type="button"
            className={cn(
              "rounded-[16px] border px-3 py-3 text-left transition-all",
              draft.compactRows
                ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]"
                : "border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]",
            )}
            onClick={() => onPatch({ compactRows: true })}
          >
            <span className="block text-xs font-bold text-[color:var(--text-strong)]">Ringkas</span>
            <span className="mt-1 block text-[11px] text-[color:var(--muted-fg)]">Data padat</span>
          </button>
        </div>

        <div className="space-y-2 rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4">
          <SidebarToggle
            label="Menu samping terlipat"
            checked={draft.sidebarCollapsed}
            onChange={(value) => onPatch({ sidebarCollapsed: value })}
          />
          <SidebarToggle
            label="Penyegaran otomatis"
            checked={draft.autoRefresh}
            onChange={(value) => onPatch({ autoRefresh: value })}
          />
          {draft.autoRefresh ? (
            <div className="mt-2.5">
              <label className="label text-[9px] font-bold uppercase tracking-wider text-[color:var(--muted-2)]">Interval Penyegaran</label>
              <GlassSelect
                className="h-9 text-xs mt-1"
                value={String(draft.refreshIntervalSeconds)}
                onChange={(value) => onPatch({ refreshIntervalSeconds: parseInt(value, 10) })}
                options={[
                  { value: "5", label: "5 Detik (Realtime)" },
                  { value: "15", label: "15 Detik" },
                  { value: "30", label: "30 Detik" },
                  { value: "60", label: "1 Menit" },
                ]}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4 lg:col-span-2">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">Notifikasi</p>
          <SidebarToggle
            label="Nada kritis suara"
            checked={draft.soundAlert}
            onChange={(value) => {
              onPatch({ soundAlert: value });
              if (value) {
                window.setTimeout(() => {
                  simulateOperationalNotification({ ...draft, soundAlert: true });
                }, 0);
              }
            }}
          />
          <p className="text-[11px] leading-5 text-[color:var(--muted-fg)]">
            Semua jam operasional mengikuti zona waktu organisasi ({ORG_TIME_ZONE_LABEL}), sama untuk seluruh tim.
          </p>
          <div className="mt-3 rounded-[16px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-3">
            <p className="text-xs leading-5 text-[color:var(--muted-fg)]">
              Tombol uji menampilkan contoh pemberitahuan di panel lonceng atas dan memutar nada kritis sekaligus.
            </p>
            <button
              type="button"
              className="btn btn-secondary mt-3 inline-flex h-10 w-full items-center justify-center gap-2 px-4 text-xs font-bold"
              onClick={() => simulateOperationalNotification(draft, { forceSound: true })}
            >
              <BellRing size={15} />
              Tes Notifikasi &amp; Suara
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function ProfileSettingsSection({
  draft,
  profile,
  onPatch,
}: {
  draft: SettingsDraft;
  profile: SettingsPayload["profile"];
  onPatch: (patch: Partial<SettingsDraft>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="settings-profile-name">
          Nama Lengkap
        </label>
        <input
          id="settings-profile-name"
          className="input-field mt-2"
          value={draft.name}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
      </div>
      <div>
        <label className="label">Surel</label>
        <input className="input-field input-readonly mt-2" value={profile.email} readOnly />
      </div>
      <div>
        <label className="label">Stasiun Kerja</label>
        <input
          className="input-field input-readonly mt-2"
          value={formatStationLabel(draft.station)}
          readOnly
        />
        <p className="mt-2 text-xs leading-5 text-[color:var(--muted-fg)]">
          {profile.role === "admin"
            ? "Ubah stasiun pengguna lewat Tim & Akses, bukan dari profil pribadi."
            : "Stasiun menentukan cakupan data operasional Anda. Perubahan hanya dilakukan administrator lewat Tim & Akses."}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DataCard label="Peran" value={ROLE_LABELS[profile.role]} />
        <DataCard label="Stasiun aktif" value={formatStationLabel(draft.station)} />
      </div>
    </div>
  );
}

function SidebarToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-[15px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-3 py-2.5">
      <span className="min-w-0 truncate text-xs font-semibold text-[color:var(--text-strong)]">{label}</span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-10 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] transition-colors peer-checked:border-[color:var(--brand-primary)] peer-checked:bg-[color:var(--brand-primary)]" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const { showAlert } = useOpsAlert();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(null));
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const preferencesSectionRef = useRef<HTMLElement | null>(null);
  const timAksesSectionRef = useRef<HTMLElement | null>(null);
  const [inviteForm, setInviteForm] = useState<{
    name: string;
    email: string;
    role: "admin" | "staff";
    station: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }>({
    name: "",
    email: "",
    role: "staff",
    station: "SOQ",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showInvitePassword, setShowInvitePassword] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState<SettingsPayload["users"][number] | null>(null);
  const [resetPasswordDraft, setResetPasswordDraft] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const userPanelRef = useRef<HTMLDivElement | null>(null);
  const userTableScrollRef = useRef<HTMLDivElement | null>(null);
  const userTableRef = useRef<HTMLTableElement | null>(null);

  const reloadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) {
        showAlert({
          title: "Gagal Memuat",
          description: await readApiError(response, "Pengaturan belum bisa dimuat."),
          tone: "error",
        });
        return null;
      }
      const payload = (await response.json()) as SettingsPayload;
      setData(payload);
      setDraft(toDraft(payload));
      return payload;
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("memuat pengaturan"),
        tone: "warning",
      });
      return null;
    }
  }, [showAlert]);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);



  const canManageUsersAccess = useMemo(() => {
    if (!data) return false;

    return (
      data.profile.role === "admin" ||
      data.users.find((user) => user.id === data.profile.id)?.capabilities.includes("users:manage") ||
      data.permissions.canManageUsers
    );
  }, [data]);

  useEffect(() => {
    if (!canManageUsersAccess || !data) return;
    if (typeof window === "undefined") return;
    if (window.location.hash.replace(/^#/, "") === "tim-akses") {
      timAksesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [canManageUsersAccess, data]);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/settings") return;
      const nextQuery = detail.query ?? "";
      const normalized = nextQuery.toLowerCase();

      if (["tim", "pengguna", "akses", "undang"].some((keyword) => normalized.includes(keyword))) {
        setUserSearch(nextQuery);
        timAksesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (["preferensi", "tampilan", "pemberitahuan", "notifikasi", "aksen", "penyegaran"].some((keyword) => normalized.includes(keyword))) {
        preferencesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);


  const filteredUsers = useMemo(() => {
    const normalized = userSearch.trim().toLowerCase();
    if (!normalized) return data?.users ?? [];
    return (data?.users ?? []).filter((user) =>
      [user.name, user.email, user.role, user.station, user.status]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data?.users, userSearch]);

  const userPageSize = useVisibleTablePageSize(
    userTableScrollRef,
    userTableRef,
    canManageUsersAccess && filteredUsers.length > 0 && Boolean(data),
    filteredUsers.length,
    {
      fallback: 8,
      min: 6,
      max: 25,
      footerPx: 88,
      chromePx: 220,
      measureContainerRef: userPanelRef,
    },
  );
  const effectiveUserPageSize = Math.min(filteredUsers.length, userPageSize);
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / effectiveUserPageSize));
  const currentUserPage = Math.min(userPage, userTotalPages);
  const userPageStart = (currentUserPage - 1) * effectiveUserPageSize;
  const pagedUsers = filteredUsers.slice(userPageStart, userPageStart + effectiveUserPageSize);
  const userVisibleStart = filteredUsers.length ? userPageStart + 1 : 0;
  const userVisibleEnd = Math.min(userPageStart + pagedUsers.length, filteredUsers.length);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  useEffect(() => {
    setUserPage((current) => Math.min(current, userTotalPages));
  }, [userTotalPages]);

  useEffect(() => {
    if (canManageUsersAccess) {
      setUserPage(1);
    }
  }, [canManageUsersAccess, effectiveUserPageSize]);

  function emitSettingsPreview(patch: Partial<SettingsDraft>) {
    window.dispatchEvent(new CustomEvent("skyhub:settings-preview", { detail: patch }));
  }

  const persistDraft = useCallback(
    async (currentDraft: SettingsDraft) => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSettingsPatch(currentDraft)),
      });
      if (response.ok) {
        window.localStorage.setItem("skyhub-accent-color", currentDraft.accentColor);
        const payload = (await response.json()) as SettingsPayload;
        setData(payload);
        setDraft(toDraft(payload));
        emitSettingsPreview(toDraft(payload));
      } else {
        showAlert({
          title: "Gagal Menyimpan",
          description: await readApiError(response, "Preferensi ruang kerja belum bisa disimpan."),
          tone: "error",
        });
      }
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("menyimpan preferensi ruang kerja"),
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  },
    [showAlert],
  );

  function applyDraftPatch(patch: Partial<SettingsDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void persistDraft(next), 400);
      return next;
    });
    emitSettingsPreview(patch);
  }

  function buildInvitePasswordFields() {
    const password = generateStaffPassword();
    return { password, confirmPassword: password };
  }

  function openInviteDrawer() {
    const passwordFields = buildInvitePasswordFields();
    setInviteForm((current) => ({ ...current, ...passwordFields }));
    setShowInvitePassword(true);
    setInviteOpen(true);
  }

  function regenerateInvitePassword() {
    const passwordFields = buildInvitePasswordFields();
    setInviteForm((current) => ({ ...current, ...passwordFields }));
    setShowInvitePassword(true);
  }

  function regenerateResetPasswordDraft() {
    const password = generateStaffPassword();
    setResetPasswordDraft(password);
    setResetPasswordConfirm(password);
    setShowResetPassword(true);
  }

  async function createUser() {
    const validation = validateInviteUserForm(inviteForm);
    if (!validation.ok) {
      showAlert({ title: "Input Tidak Valid", description: validation.message || "Data undangan tidak valid.", tone: "warning" });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          user: SettingsPayload["users"][number];
          initialPassword?: string;
        };
        setData((current) => (current ? { ...current, users: [...current.users, payload.user] } : current));
        setInviteForm({
          name: "",
          email: "",
          role: "staff",
          station: "SOQ",
          phone: "",
          password: "",
          confirmPassword: "",
        });
        setInviteOpen(false);
        showAlert({
          title: "Pengguna Dibuat",
          description: payload.initialPassword
            ? `${payload.user.email} aktif. Kata sandi awal: ${payload.initialPassword}`
            : `${payload.user.email} berhasil dibuat dan siap digunakan.`,
          tone: "success",
        });
      } else {
        showAlert({ title: "Gagal", description: await readApiError(response, "Gagal membuat pengguna."), tone: "error" });
      }
    } catch {
      showAlert({ title: "Koneksi Terputus", description: networkErrorMessage("membuat pengguna"), tone: "warning" });
    } finally {
      setSaving(false);
    }
  }

  function clearPasswordResetDraft() {
    setResetPasswordDraft("");
    setResetPasswordConfirm("");
    setShowResetPassword(false);
  }

  function openUserEditor(user: SettingsPayload["users"][number]) {
    setEditingUserId(user.id);
    setEditingUserDraft(user);
    clearPasswordResetDraft();
  }

  function closeUserEditor() {
    setEditingUserId(null);
    setEditingUserDraft(null);
    clearPasswordResetDraft();
  }

  async function resetUserPassword() {
    if (!editingUserId || !editingUserDraft || !data) return;

    if (editingUserId === data.profile.id) {
      showAlert({
        title: "Tidak Diizinkan",
        description: "Reset kata sandi sendiri tidak tersedia. Minta administrator lain mengatur ulang akun Anda.",
        tone: "warning",
      });
      return;
    }

    if (resetPasswordDraft.length < 6) {
      showAlert({
        title: "Input Tidak Valid",
        description: "Kata sandi baru minimal 6 karakter.",
        tone: "warning",
      });
      return;
    }

    if (resetPasswordDraft !== resetPasswordConfirm) {
      showAlert({
        title: "Input Tidak Valid",
        description: "Konfirmasi kata sandi tidak sama.",
        tone: "warning",
      });
      return;
    }

    setResettingPassword(true);

    try {
      const response = await fetch(`/api/users/${editingUserId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPasswordDraft,
          confirmPassword: resetPasswordConfirm,
        }),
      });

      if (response.ok) {
        await reloadSettings();
        clearPasswordResetDraft();
        showAlert({
          title: "Kata Sandi Diatur Ulang",
          description: `Kata sandi ${editingUserDraft.email} berhasil diperbarui. Sampaikan kata sandi baru secara aman ke pengguna.`,
          tone: "info",
        });
      } else {
        showAlert({
          title: "Gagal",
          description: await readApiError(response, "Gagal mengatur ulang kata sandi."),
          tone: "error",
        });
      }
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("mengatur ulang kata sandi"),
        tone: "warning",
      });
    } finally {
      setResettingPassword(false);
    }
  }

  async function saveUser() {
    if (!editingUserId || !editingUserDraft) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/users/${editingUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingUserDraft.name,
          email: editingUserDraft.email,
          phone: editingUserDraft.phone,
          role: editingUserDraft.role,
          status: editingUserDraft.status,
          station: editingUserDraft.station,
          capabilities: editingUserDraft.capabilities,
        }),
      });

      if (response.ok) {
        await reloadSettings();
        closeUserEditor();
        showAlert({ title: "Pemberitahuan", description: "Pengguna berhasil diperbarui.", tone: "info" });
      } else {
        showAlert({ title: "Gagal", description: await readApiError(response, "Gagal memperbarui pengguna."), tone: "error" });
      }
    } catch {
      showAlert({ title: "Koneksi Terputus", description: networkErrorMessage("memperbarui pengguna"), tone: "warning" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserStatus(userRow: SettingsPayload["users"][number]) {
    setTogglingUserId(userRow.id);
    const nextStatus = userRow.status === "active" ? "disabled" : "active";

    try {
      const response = await fetch(`/api/users/${userRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: userRow.role,
          status: nextStatus,
          station: userRow.station,
          capabilities: userRow.capabilities,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { user: SettingsPayload["users"][number] };
        setData((current) =>
          current
            ? {
                ...current,
                users: current.users.map((item) => (item.id === payload.user.id ? payload.user : item)),
              }
            : current,
        );
        showAlert({ title: "Pemberitahuan", description: nextStatus === "active" ? "Akun berhasil diaktifkan." : "Akun berhasil dinonaktifkan.", tone: "info" });
      } else {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showAlert({ title: "Gagal", description: payload?.error || "Gagal memperbarui status akun.", tone: "error" });
      }
    } catch {
      showAlert({ title: "Koneksi Terputus", description: networkErrorMessage("memperbarui status akun"), tone: "warning" });
    } finally {
      setTogglingUserId(null);
    }
  }

  return (
    <OpsLockedPage
      className={canManageUsersAccess ? "settings-viewport" : undefined}
      header={
        <PageHeader
          eyebrow="Sistem"
          title="Pengaturan"
          subtitle={
            canManageUsersAccess
              ? "Kelola profil, tampilan dasbor, serta tim dan akses pengguna internal."
              : "Kelola profil dan preferensi ruang kerja Anda."
          }
        />
      }
      body={
      !data ? (
        canManageUsersAccess ? (
          <div className="settings-single-page flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <SkeletonBlock className="h-20 w-full shrink-0 rounded-[22px]" />
            <div className="grid shrink-0 gap-4 lg:grid-cols-2">
              <SkeletonBlock className="h-[220px] w-full rounded-[28px]" />
              <SkeletonBlock className="h-[220px] w-full rounded-[28px]" />
            </div>
            <SkeletonBlock className="min-h-0 flex-1 w-full rounded-[28px]" />
          </div>
        ) : (
          <OpsPanel className="p-5">
            <SkeletonBlock className="h-20 w-full rounded-[22px]" />
            <div className="mt-6 space-y-6">
              <SkeletonBlock className="h-[180px] w-full rounded-[28px]" />
              <SkeletonBlock className="h-[180px] w-full rounded-[28px]" />
            </div>
          </OpsPanel>
        )
      ) : !canManageUsersAccess ? (
        <div className="page-stack min-h-0 overflow-hidden pt-2">
          <OpsPanel className="settings-single-page flex min-h-0 flex-col overflow-y-auto p-5">
            <SettingsIdentitySummary draft={draft} profile={data.profile} variant="inline" />

            <section className="mt-6">
              <SectionHeader
                contained
                title="Profil Pengguna"
                subtitle="Perubahan nama disimpan otomatis."
              />
              <div className="mt-4">
                <ProfileSettingsSection draft={draft} profile={data.profile} onPatch={applyDraftPatch} />
              </div>
            </section>

            <div className="my-6 h-px bg-[color:var(--border-soft)]" />

            <section ref={preferencesSectionRef} id="preferensi-ruang-kerja">
              <WorkspaceSettingsPanel draft={draft} onPatch={applyDraftPatch} />
            </section>
          </OpsPanel>
        </div>
      ) : (
        <div className="settings-single-page flex min-h-0 h-full flex-1 flex-col gap-4 overflow-hidden">
          <div className="settings-single-page-upper shrink-0 space-y-4 overflow-y-auto internal-scrollbar">
            <SettingsIdentitySummary draft={draft} profile={data.profile} variant="inline" />

            <div className="grid gap-4 lg:grid-cols-2">
              <OpsPanel className="p-5">
                <SectionHeader
                  title="Profil Pengguna"
                  subtitle="Perubahan nama disimpan otomatis."
                />
                <div className="mt-4">
                  <ProfileSettingsSection draft={draft} profile={data.profile} onPatch={applyDraftPatch} />
                </div>
              </OpsPanel>

              <section ref={preferencesSectionRef} id="preferensi-ruang-kerja">
                <WorkspaceSettingsPanel draft={draft} onPatch={applyDraftPatch} />
              </section>
            </div>
          </div>

          <section ref={timAksesSectionRef} id="tim-akses" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <OpsPanel className="settings-users-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5">
                <div ref={userPanelRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <SectionHeader
                  contained
                  title="Tim & Akses"
                  subtitle="Pengguna, peran, dan izin."
                  action={
                    <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={openInviteDrawer}>
                      <Plus size={16} />
                      Tambah Pengguna
                    </button>
                  }
                />

                <div className="settings-users-body mt-5 min-h-0 flex-1">
                <div className="grid shrink-0 gap-4 xl:grid-cols-3">
                  <DataCard label="Total pengguna" value={data.users.length} tone="primary" />
                  <DataCard
                    label="Pengguna aktif"
                    value={data.users.filter((user) => user.status === "active").length}
                    tone="success"
                  />
                  <DataCard
                    label="Perlu tindak lanjut"
                    value={data.users.filter((user) => user.status !== "active").length}
                    tone="warning"
                  />
                </div>

                <div className="settings-table-toolbar shrink-0">
                  <span>{filteredUsers.length} pengguna{userSearch ? ` cocok "${userSearch}"` : ""}</span>
                  <input
                    type="text"
                    className="input-field h-9 max-w-[220px] text-xs"
                    placeholder="Cari nama atau surel..."
                    value={userSearch}
                    onChange={(event) => {
                      setUserSearch(event.target.value);
                      setUserPage(1);
                    }}
                  />
                </div>

                <div
                  ref={userTableScrollRef}
                  className="settings-users-table-scroll internal-scrollbar table-shell mt-5 min-h-0 min-w-0 flex-1 overflow-hidden rounded-[24px] border border-[color:var(--border-soft)]"
                >
                  <table ref={userTableRef} className="data-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Surel</th>
                        <th>Peran</th>
                        <th>Izin rinci</th>
                        <th>Stasiun</th>
                        <th>Status</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-[color:var(--muted-fg)] font-medium">
                            Tidak ada anggota tim yang cocok dengan pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        pagedUsers.map((user) => {
                          return (
                            <tr key={user.id}>
                              <td className="font-semibold text-[color:var(--text-strong)]">
                                {user.name}
                              </td>
                              <td>
                                {user.email}
                              </td>
                              <td>
                                <p className="font-medium text-[color:var(--text-strong)]">{ROLE_LABELS[user.role]}</p>
                              </td>
                              <td>
                                <div className="flex min-w-[220px] flex-wrap gap-2">
                                  {user.capabilities.slice(0, 3).map((capability) => (
                                    <span
                                      key={capability}
                                      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-fg)]"
                                    >
                                      {CAPABILITY_OPTIONS.find((item) => item.value === capability)?.label ?? capability}
                                    </span>
                                  ))}
                                  {user.capabilities.length > 3 ? (
                                    <span className="rounded-full bg-[color:var(--brand-primary-soft)] px-2.5 py-1 text-xs font-bold text-[color:var(--brand-primary)]">
                                      +{user.capabilities.length - 3}
                                    </span>
                                  ) : null}
                                  {!user.capabilities.length ? <span className="text-xs text-[color:var(--muted-2)]">Hanya baca</span> : null}
                                </div>
                              </td>
                              <td>
                                <span className="font-semibold text-[color:var(--brand-primary)]">
                                  {formatStationLabel(user.station)}
                                </span>
                              </td>
                              <td>
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge value={user.status} label={USER_STATUS_LABELS[user.status]} />
                                  <button
                                    type="button"
                                    className="btn btn-secondary h-8 px-3 text-xs"
                                    onClick={() => toggleUserStatus(user)}
                                    disabled={togglingUserId === user.id || user.id === data.profile.id}
                                  >
                                    {togglingUserId === user.id
                                      ? "Memproses..."
                                      : user.status === "active"
                                        ? "Matikan"
                                        : "Aktifkan"}
                                  </button>
                                  {user.id === data.profile.id ? (
                                    <span className="text-xs text-[color:var(--muted-2)]">Akun Anda</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn btn-secondary h-10 px-4"
                                  onClick={() => openUserEditor(user)}
                                >
                                  Ubah
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredUsers.length > 0 ? (
                  <div className="settings-users-pagination">
                    <PaginationBar
                      page={currentUserPage}
                      totalPages={userTotalPages}
                      visibleStart={userVisibleStart}
                      visibleEnd={userVisibleEnd}
                      totalItems={filteredUsers.length}
                      onPageChange={setUserPage}
                      label="Pengguna"
                    />
                  </div>
                ) : null}
                </div>
                </div>

              <OpsDrawer
                open={inviteOpen}
                title="Tambah Pengguna"
                eyebrow="Tim & Akses"
                description="Buat akun internal baru dengan kata sandi awal yang bisa langsung dipakai login."
                onClose={() => setInviteOpen(false)}
                footer={
                  <div className="flex w-full items-center justify-end gap-3">
                    <button type="button" className="btn btn-secondary" onClick={() => setInviteOpen(false)}>
                      Batal
                    </button>
                    <button type="button" className="btn btn-primary" onClick={createUser} disabled={saving}>
                      <Plus size={16} />
                      {saving ? "Menyimpan..." : "Simpan"}
                    </button>
                  </div>
                }
              >
                <div className="space-y-5">
                  <div>
                    <label className="label">Nama Lengkap</label>
                    <input
                      className="input-field mt-2"
                      placeholder="Nama"
                      value={inviteForm.name}
                      onChange={(event) =>
                        setInviteForm((current) => ({ ...current, name: sanitizePersonName(event.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Surel</label>
                    <input
                      className="input-field mt-2"
                      placeholder="Surel"
                      value={inviteForm.email}
                      onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">No Telepon</label>
                    <input
                      className="input-field mt-2"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Contoh: 08123456789"
                      value={inviteForm.phone}
                      onChange={(event) =>
                        setInviteForm((current) => ({ ...current, phone: sanitizePhoneInput(event.target.value) }))
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Peran</label>
                      <GlassSelect
                        className="mt-2"
                        value={inviteForm.role}
                        onChange={(value) =>
                          setInviteForm((current) => ({ ...current, role: value as "admin" | "staff" }))
                        }
                        options={[
                          { value: "staff", label: "Staf Operasional" },
                          { value: "admin", label: "Administrator" },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="label">Stasiun</label>
                      <GlassSelect
                        className="mt-2"
                        value={inviteForm.station}
                        onChange={(value) => setInviteForm((current) => ({ ...current, station: value }))}
                        options={stationSelectOptions()}
                      />
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-strong)]">Kata sandi awal</p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-fg)]">
                          Kata sandi dibuat otomatis dan bisa diubah sebelum disimpan.
                        </p>
                      </div>
                      <button type="button" className="btn btn-secondary h-9 px-3 text-xs" onClick={regenerateInvitePassword}>
                        Buat ulang
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label">Kata sandi</label>
                        <div className="relative mt-2">
                          <input
                            className="input-field input-field-trailing"
                            type={showInvitePassword ? "text" : "password"}
                            autoComplete="new-password"
                            value={inviteForm.password}
                            onChange={(event) =>
                              setInviteForm((current) => ({ ...current, password: event.target.value }))
                            }
                            placeholder="Minimal 6 karakter"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--muted-fg)] transition hover:bg-[color:var(--panel-bg)]"
                            onClick={() => setShowInvitePassword((value) => !value)}
                            aria-label={showInvitePassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                          >
                            {showInvitePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">Konfirmasi kata sandi</label>
                        <input
                          className="input-field mt-2"
                          type={showInvitePassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={inviteForm.confirmPassword}
                          onChange={(event) =>
                            setInviteForm((current) => ({ ...current, confirmPassword: event.target.value }))
                          }
                          placeholder="Ulangi kata sandi"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </OpsDrawer>

              <OpsDrawer
                  open={Boolean(editingUserId && editingUserDraft)}
                  title="Ubah Hak Akses & Profil"
                  eyebrow="Kelola Anggota Tim"
                  description="Sesuaikan peran, stasiun, dan izin rinci pengguna."
                  onClose={closeUserEditor}
                  footer={
                    <div className="flex w-full items-center justify-end gap-3">
                      <button type="button" className="btn btn-secondary" onClick={closeUserEditor}>
                        Batal
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={saveUser}
                        disabled={saving}
                      >
                        {saving ? "Menyimpan..." : "Simpan"}
                      </button>
                    </div>
                  }
                >
                  {editingUserDraft ? (
                    <div className="space-y-6">
                      <div>
                        <label className="label">Nama Lengkap</label>
                        <input
                          className="input-field mt-2"
                          value={editingUserDraft.name}
                          onChange={(event) =>
                            setEditingUserDraft((current) =>
                              current ? { ...current, name: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div>
                      <label className="label">Alamat Surel</label>
                        <input
                          className="input-field mt-2"
                          value={editingUserDraft.email}
                          onChange={(event) =>
                            setEditingUserDraft((current) =>
                              current ? { ...current, email: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className="label">No Telepon</label>
                        <input
                          className="input-field mt-2"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="Contoh: 08123456789"
                          value={editingUserDraft.phone}
                          onChange={(event) =>
                            setEditingUserDraft((current) =>
                              current ? { ...current, phone: sanitizePhoneInput(event.target.value) } : current,
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="label">Peran</label>
                          <GlassSelect
                            className="mt-2"
                            value={editingUserDraft.role}
                            onChange={(value) =>
                              setEditingUserDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      role: value as SettingsPayload["users"][number]["role"],
                                      capabilities: defaultCapabilitiesForRole(
                                        value as SettingsPayload["users"][number]["role"],
                                      ),
                                    }
                                  : current,
                              )
                            }
                            options={[
                              { value: "staff", label: "Staf Operasional" },
                              { value: "admin", label: "Administrator" },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="label">Stasiun</label>
                          <GlassSelect
                            className="mt-2"
                            value={editingUserDraft.station}
                            onChange={(value) =>
                              setEditingUserDraft((current) =>
                                current ? { ...current, station: value } : current,
                              )
                            }
                            options={stationSelectOptions()}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="label">Status</label>
                        <GlassSelect
                          className="mt-2"
                          value={editingUserDraft.status}
                          onChange={(value) =>
                            setEditingUserDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    status: value as SettingsPayload["users"][number]["status"],
                                  }
                                : current,
                            )
                          }
                          options={[
                            { value: "active", label: "Aktif" },
                            { value: "invited", label: "Diundang" },
                            { value: "disabled", label: "Nonaktif" },
                          ]}
                        />
                      </div>

                      {editingUserId !== data.profile.id ? (
                        <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] text-[color:var(--brand-primary)]">
                              <KeyRound size={18} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Reset kata sandi (admin)</p>
                              <p className="mt-1 text-xs leading-5 text-[color:var(--muted-fg)]">
                                Atur kata sandi baru untuk {editingUserDraft.email}. Tidak ada fitur lupa password mandiri;
                                pengguna wajib menghubungi administrator.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="label">Kata sandi baru</label>
                              <div className="relative mt-2">
                                <input
                                  className="input-field input-field-trailing"
                                  type={showResetPassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  value={resetPasswordDraft}
                                  onChange={(event) => setResetPasswordDraft(event.target.value)}
                                  placeholder="Minimal 6 karakter"
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--muted-fg)] transition hover:bg-[color:var(--panel-bg)]"
                                  onClick={() => setShowResetPassword((value) => !value)}
                                  aria-label={showResetPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                >
                                  {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="label">Konfirmasi kata sandi</label>
                              <input
                                className="input-field mt-2"
                                type={showResetPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={resetPasswordConfirm}
                                onChange={(event) => setResetPasswordConfirm(event.target.value)}
                                placeholder="Ulangi kata sandi baru"
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={regenerateResetPasswordDraft}
                              disabled={resettingPassword || saving}
                            >
                              Buat ulang kata sandi
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={resetUserPassword}
                              disabled={resettingPassword || saving || !resetPasswordDraft || !resetPasswordConfirm}
                            >
                              <KeyRound size={16} />
                              {resettingPassword ? "Mengatur ulang..." : "Terapkan reset kata sandi"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3 text-xs leading-5 text-[color:var(--muted-fg)]">
                          Reset kata sandi akun sendiri tidak tersedia di sini. Minta administrator lain jika Anda lupa kata sandi.
                        </div>
                      )}

                      <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Pratinjau Akses Menu</p>
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              editingUserDraft.status === "disabled"
                                ? "bg-[color:var(--tone-danger)]"
                                : "bg-[color:var(--tone-success)]"
                            )}>
                              {editingUserDraft.status === "disabled" ? "✗" : "✓"}
                            </span>
                            <span className="font-semibold text-[color:var(--text-strong)]">
                              Operasional: Pusat Kendali, Buku Pengiriman, Pelacakan AWB
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              editingUserDraft.status === "disabled"
                                ? "bg-[color:var(--tone-danger)]"
                                : "bg-[color:var(--tone-success)]"
                            )}>
                              {editingUserDraft.status === "disabled" ? "✗" : "✓"}
                            </span>
                            <span className={cn(
                              "font-semibold",
                              editingUserDraft.status === "disabled"
                                ? "text-[color:var(--muted-fg)] line-through"
                                : "text-[color:var(--text-strong)]"
                            )}>
                              Pemantauan: Manajemen Pesawat, Pusat Peringatan, Catatan Aktivitas
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              editingUserDraft.status === "disabled"
                                ? "bg-[color:var(--tone-danger)]"
                                : "bg-[color:var(--tone-success)]"
                            )}>
                              {editingUserDraft.status === "disabled" ? "✗" : "✓"}
                            </span>
                            <span className={cn(
                              "font-semibold",
                              editingUserDraft.status === "disabled"
                                ? "text-[color:var(--muted-fg)] line-through"
                                : "text-[color:var(--text-strong)]"
                            )}>
                              Sistem: Pengaturan
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="label">Izin Rinci</label>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                           {CAPABILITY_OPTIONS.map((capability) => {
                            const checked = editingUserDraft.capabilities.includes(capability.value);
                            return (
                              <label
                                key={capability.value}
                                className={cn(
                                  "flex items-start gap-3 rounded-[18px] border p-3 text-left transition-all cursor-pointer hover:bg-[color:var(--panel-bg)]",
                                  checked
                                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]/20"
                                    : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 shrink-0"
                                  checked={checked}
                                  onChange={(event) =>
                                    setEditingUserDraft((current) => {
                                      if (!current) return current;
                                      const next = new Set(current.capabilities);
                                      if (event.target.checked) next.add(capability.value);
                                      else next.delete(capability.value);
                                      return { ...current, capabilities: [...next] };
                                    })
                                  }
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[color:var(--text-strong)]">{capability.label}</p>
                                  <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-fg)]">{capability.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </OpsDrawer>
              </OpsPanel>
          </section>
        </div>
      )
      }
    />
  );
}
