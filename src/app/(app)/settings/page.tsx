"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Monitor,
  MoonStar,
  Plus,
  SunMedium,
  UserCircle2,
  Users2,
} from "lucide-react";
import {
  CUSTOMER_ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  STATION_OPTIONS,
  USER_STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { DataCard, OpsPanel, PageHeader, SectionHeader, SkeletonBlock } from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";

const CAPABILITY_OPTIONS = [
  { value: "shipment:create", label: "Buat pengiriman", description: "Membuat AWB kargo dan manifest baru" },
  { value: "shipment:update", label: "Ubah pengiriman", description: "Mengubah detail berat, koli, dan status kargo" },
  { value: "shipment:delete", label: "Hapus pengiriman", description: "Menghapus entri kargo dari buku pengiriman" },
  { value: "shipment:document", label: "Dokumen pengiriman", description: "Mengunggah dan memvalidasi berkas dokumen manifest" },
  { value: "flight:manage", label: "Kelola penerbangan", description: "Membuat, mengubah, dan menjadwalkan penerbangan baru" },
  { value: "payment:verify", label: "Verifikasi bayar", description: "Menyetujui verifikasi pembayaran AWB" },
  { value: "reports:export", label: "Cetak laporan", description: "Mencetak data operasional ke PDF atau penampil peramban" },
  { value: "users:manage", label: "Kelola pengguna", description: "Mengundang dan mengelola hak akses anggota tim" },
  { value: "customer_accounts:manage", label: "Kelola pelanggan", description: "Mengelola kode dan profil akun pelanggan" },
  { value: "settings:workspace", label: "Ruang kerja", description: "Mengatur preferensi dan tampilan default sistem" },
] as const;

type SettingsCapability = (typeof CAPABILITY_OPTIONS)[number]["value"];

function defaultCapabilitiesForRole(role: "admin" | "staff" | "customer"): SettingsCapability[] {
  if (role === "admin") return CAPABILITY_OPTIONS.map((item) => item.value);
  if (role === "staff") {
    return ["shipment:create", "shipment:update", "shipment:delete", "shipment:document", "flight:manage", "reports:export"];
  }
  return [];
}

type SettingsPayload = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "staff" | "customer";
    station: string;
    customerAccountId: string | null;
    customerAccountName: string | null;
  };
  settings: {
    theme: "light" | "dark" | "system";
    compactRows: boolean;
    sidebarCollapsed: boolean;
    autoRefresh: boolean;
    refreshIntervalSeconds: number;
    cutoffAlert: boolean;
    exceptionAlert: boolean;
    soundAlert: boolean;
    emailDigest: boolean;
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
    role: "admin" | "staff" | "customer";
    station: string;
    status: "active" | "invited" | "disabled";
    customerAccountId: string | null;
    customerAccountName: string | null;
    capabilities: SettingsCapability[];
  }[];
  customerAccounts: {
    id: string;
    code: string;
    name: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    status: "active" | "disabled";
    userCount: number;
    shipmentCount: number;
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
  cutoffAlert: boolean;
  exceptionAlert: boolean;
  soundAlert: boolean;
  emailDigest: boolean;
};

const SETTINGS_PAGE_SIZE = 10;

function toDraft(data: SettingsPayload | null): SettingsDraft {
  return {
    name: data?.profile.name ?? "",
    station: data?.profile.station ?? "SOQ",
    theme: (data?.settings?.theme as "light" | "dark" | "system") ?? "light",
    accentColor: (typeof window !== "undefined" ? window.localStorage.getItem("skyhub-accent-color") : null) ?? "blue",
    compactRows: data?.settings?.compactRows ?? false,
    sidebarCollapsed: data?.settings?.sidebarCollapsed ?? false,
    autoRefresh: data?.settings?.autoRefresh ?? true,
    refreshIntervalSeconds: data?.settings?.refreshIntervalSeconds ?? 5,
    cutoffAlert: data?.settings?.cutoffAlert ?? true,
    exceptionAlert: data?.settings?.exceptionAlert ?? true,
    soundAlert: data?.settings?.soundAlert ?? false,
    emailDigest: data?.settings?.emailDigest ?? false,
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

function playCriticalTone() {
  if (typeof window === "undefined") return;

  const AudioContextCtor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.28);
  window.setTimeout(() => void context.close(), 360);
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || fallback;
}

function WorkspaceSettingsPanel({
  draft,
  onPatch,
}: {
  draft: SettingsDraft;
  onPatch: (patch: Partial<SettingsDraft>) => void;
}) {
  const themeOptions = [
    { value: "light" as const, label: "Terang", icon: SunMedium },
    { value: "dark" as const, label: "Gelap", icon: MoonStar },
    { value: "system" as const, label: "Sistem", icon: Monitor },
  ];
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
            Mode tampilan, susunan data, pemberitahuan operasional, dan ritme kerja.
          </p>
        </div>

      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">Mode Tampilan</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = draft.theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[14px] border px-2 text-xs font-bold transition-all",
                    active
                      ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white shadow-[0_10px_20px_rgba(0,61,155,0.16)]"
                      : "border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] text-[color:var(--muted-fg)] hover:text-[color:var(--text-strong)]",
                  )}
                  onClick={() => onPatch({ theme: option.value })}
                >
                  <Icon size={14} />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
        </div>

        <div className="space-y-2 rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4 lg:col-span-2">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">Pemberitahuan Operasional</p>
          <SidebarToggle
            label="Nada kritis"
            checked={draft.soundAlert}
            onChange={(value) => onPatch({ soundAlert: value })}
          />
          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-fg)]">
            Saat aktif, sistem memutar nada singkat ketika preview pemberitahuan kritis muncul.
          </p>
        </div>

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
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(null));
  const [activeTab, setActiveTab] = useState("Profil");
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [customerAccountOpen, setCustomerAccountOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "staff",
    station: "SOQ",
    customerAccountId: "",
  });
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState<SettingsPayload["users"][number] | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountDraft, setEditingAccountDraft] =
    useState<SettingsPayload["customerAccounts"][number] | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountPage, setAccountPage] = useState(1);

  async function reloadSettings() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as SettingsPayload;
    setData(payload);
    setDraft(toDraft(payload));
    return payload;
  }

  useEffect(() => {
    void reloadSettings().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tabs = useMemo(() => {
    const items = [
      {
        label: "Tim & Akses",
        icon: Users2,
        note: "Pengguna",
        enabled: data?.permissions.canManageUsers ?? false,
      },
      {
        label: "Akun Pelanggan",
        icon: Building2,
        note: "Pelanggan",
        enabled: data?.permissions.canManageCustomerAccounts ?? false,
      },
    ];

    return items;
  }, [data?.permissions.canManageCustomerAccounts, data?.permissions.canManageUsers]);

  useEffect(() => {
    if (activeTab === "Preferensi") setActiveTab("Profil");
  }, [activeTab]);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/settings") return;
      const nextQuery = detail.query ?? "";
      if (activeTab === "Tim & Akses") {
        setUserSearch(nextQuery);
      } else if (activeTab === "Akun Pelanggan") {
        setAccountSearch(nextQuery);
      } else {
        const normalized = nextQuery.toLowerCase();
        if (["preferensi", "tampilan", "tema", "mode", "pemberitahuan", "notifikasi"].some((keyword) => normalized.includes(keyword))) {
          setActiveTab("Profil");
          return;
        }
        const matchedTab = tabs.find((tab) => tab.label.toLowerCase().includes(normalized));
        if (matchedTab) setActiveTab(matchedTab.label);
      }
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, [activeTab, tabs]);


  const filteredUsers = useMemo(() => {
    const normalized = userSearch.trim().toLowerCase();
    if (!normalized) return data?.users ?? [];
    return (data?.users ?? []).filter((user) =>
      [user.name, user.email, user.role, user.station, user.status, user.customerAccountName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data?.users, userSearch]);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / SETTINGS_PAGE_SIZE));
  const currentUserPage = Math.min(userPage, userTotalPages);
  const userPageStart = (currentUserPage - 1) * SETTINGS_PAGE_SIZE;
  const pagedUsers = filteredUsers.slice(userPageStart, userPageStart + SETTINGS_PAGE_SIZE);
  const userVisibleStart = filteredUsers.length ? userPageStart + 1 : 0;
  const userVisibleEnd = Math.min(userPageStart + pagedUsers.length, filteredUsers.length);

  const filteredAccounts = useMemo(() => {
    const normalized = accountSearch.trim().toLowerCase();
    if (!normalized) return data?.customerAccounts ?? [];
    return (data?.customerAccounts ?? []).filter((account) =>
      [account.code, account.name, account.contactName ?? "", account.contactEmail ?? "", account.contactPhone ?? "", account.status]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [accountSearch, data?.customerAccounts]);

  const accountTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / SETTINGS_PAGE_SIZE));
  const currentAccountPage = Math.min(accountPage, accountTotalPages);
  const accountPageStart = (currentAccountPage - 1) * SETTINGS_PAGE_SIZE;
  const pagedAccounts = filteredAccounts.slice(accountPageStart, accountPageStart + SETTINGS_PAGE_SIZE);
  const accountVisibleStart = filteredAccounts.length ? accountPageStart + 1 : 0;
  const accountVisibleEnd = Math.min(accountPageStart + pagedAccounts.length, filteredAccounts.length);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  useEffect(() => {
    setAccountPage(1);
  }, [accountSearch]);

  useEffect(() => {
    setUserPage((current) => Math.min(current, userTotalPages));
  }, [userTotalPages]);

  useEffect(() => {
    setAccountPage((current) => Math.min(current, accountTotalPages));
  }, [accountTotalPages]);

  function emitSettingsPreview(patch: Partial<SettingsDraft>) {
    window.dispatchEvent(new CustomEvent("skyhub:settings-preview", { detail: patch }));
  }

  const persistDraft = useCallback(async (currentDraft: SettingsDraft) => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentDraft),
      });
      if (response.ok) {
        window.localStorage.setItem("skyhub-accent-color", currentDraft.accentColor);
        const payload = (await response.json()) as SettingsPayload;
        setData(payload);
        setDraft(toDraft(payload));
        emitSettingsPreview(toDraft(payload));
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, []);

  function applyDraftPatch(patch: Partial<SettingsDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void persistDraft(next), 400);
      return next;
    });
    emitSettingsPreview(patch);
    if (patch.soundAlert) {
      playCriticalTone();
    }
  }

  async function createUser() {
    setSaving(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inviteForm,
          customerAccountId: inviteForm.role === "customer" ? inviteForm.customerAccountId || null : null,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { user: SettingsPayload["users"][number] };
        setData((current) => (current ? { ...current, users: [...current.users, payload.user] } : current));
        setInviteForm({ name: "", email: "", role: "staff", station: "SOQ", customerAccountId: "" });
        setInviteOpen(false);
        setNotice("Pengguna berhasil dibuat dengan status diundang.");
      } else {
        setNotice(await readApiError(response, "Gagal membuat pengguna."));
      }
    } catch {
      setNotice("Gagal membuat pengguna.");
    } finally {
      setSaving(false);
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
          role: editingUserDraft.role,
          status: editingUserDraft.status,
          station: editingUserDraft.station,
          customerAccountId:
            editingUserDraft.role === "customer" ? editingUserDraft.customerAccountId : null,
          capabilities: editingUserDraft.role === "customer" ? [] : editingUserDraft.capabilities,
        }),
      });

      if (response.ok) {
        await reloadSettings();
        setEditingUserId(null);
        setEditingUserDraft(null);
        setNotice("Pengguna berhasil diperbarui.");
      } else {
        setNotice(await readApiError(response, "Gagal memperbarui pengguna."));
      }
    } catch {
      setNotice("Gagal memperbarui pengguna.");
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
          customerAccountId: userRow.role === "customer" ? userRow.customerAccountId : null,
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
        setNotice(nextStatus === "active" ? "Akun berhasil diaktifkan." : "Akun berhasil dinonaktifkan.");
      } else {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setNotice(payload?.error || "Gagal memperbarui status akun.");
      }
    } catch {
      setNotice("Gagal memperbarui status akun.");
    } finally {
      setTogglingUserId(null);
    }
  }

  async function createCustomerAccountEntry() {
    setSaving(true);

    try {
      const response = await fetch("/api/customer-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          customerAccount: SettingsPayload["customerAccounts"][number];
        };
        setData((current) =>
          current
            ? {
                ...current,
                customerAccounts: [...current.customerAccounts, payload.customerAccount],
              }
            : current,
        );
        setAccountForm({ code: "", name: "", contactName: "", contactEmail: "", contactPhone: "" });
        setCustomerAccountOpen(false);
        setNotice("Akun pelanggan berhasil dibuat.");
      } else {
        setNotice(await readApiError(response, "Gagal membuat akun pelanggan."));
      }
    } catch {
      setNotice("Gagal membuat akun pelanggan.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomerAccount() {
    if (!editingAccountId || !editingAccountDraft) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/customer-accounts/${editingAccountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editingAccountDraft.code,
          name: editingAccountDraft.name,
          contactName: editingAccountDraft.contactName,
          contactEmail: editingAccountDraft.contactEmail,
          contactPhone: editingAccountDraft.contactPhone,
          status: editingAccountDraft.status,
        }),
      });

      if (response.ok) {
        await reloadSettings();
        setEditingAccountId(null);
        setEditingAccountDraft(null);
        setNotice("Akun pelanggan berhasil diperbarui.");
      } else {
        setNotice(await readApiError(response, "Gagal memperbarui akun pelanggan."));
      }
    } catch {
      setNotice("Gagal memperbarui akun pelanggan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Sistem"
        title="Pengaturan"
        subtitle="Kelola profil, tampilan dasbor, tim dan akses pengguna, serta akun pelanggan."
      />

      {notice ? (
        <div className="rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
          {notice}
        </div>
      ) : null}

      {!data ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
          <OpsPanel className="p-4">
            <SkeletonBlock className="h-32 w-full rounded-[24px]" />
            <div className="mt-4 space-y-3">
              <SkeletonBlock className="h-14 w-full rounded-[20px]" />
              <SkeletonBlock className="h-14 w-full rounded-[20px]" />
              <SkeletonBlock className="h-14 w-full rounded-[20px]" />
            </div>
          </OpsPanel>
          <div className="space-y-5">
            <SkeletonBlock className="h-[160px] w-full rounded-[28px]" />
            <div className="grid gap-5 xl:grid-cols-2">
              <SkeletonBlock className="h-[280px] w-full rounded-[28px]" />
              <SkeletonBlock className="h-[280px] w-full rounded-[28px]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] split-pane-shell split-pane-shell-settings">
          <OpsPanel className="page-pane split-pane-left p-4">
            <div className="space-y-3">
              <div className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary)] font-[family:var(--font-heading)] text-[1.05rem] font-black tracking-[-0.04em] text-white">
                    {getInitials(draft.name || data.profile.name || "Sky Hub")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[color:var(--text-strong)]">
                      {draft.name || data.profile.name}
                    </p>
                    <p className="truncate text-xs text-[color:var(--muted-2)]">{data.profile.email}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <StatusBadge value="info" label={ROLE_LABELS[data.profile.role]} />
                      <StatusBadge value="active" label={draft.station} />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={cn(
                  "flex w-full min-w-0 items-center justify-between gap-3 rounded-[22px] border px-4 py-4 text-left transition-colors",
                  activeTab === "Profil"
                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)] hover:text-[color:var(--text-strong)]",
                )}
                onClick={() => setActiveTab("Profil")}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-[color:var(--border-soft)] bg-white/70 dark:bg-white/[0.04]">
                    <UserCircle2 size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">Profil</span>
                    <span className="block truncate text-xs text-[color:var(--muted-2)]">Akun dan akses saya</span>
                  </span>
                </span>
                <ChevronRight size={16} />
              </button>

              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.label;
                  const disabled = !tab.enabled;

                  return (
                    <button
                      key={tab.label}
                      type="button"
                      title={disabled ? "Membutuhkan izin administrator untuk mengakses menu ini" : undefined}
                      className={cn(
                        "flex w-full min-w-0 items-center justify-between gap-3 rounded-[22px] border px-4 py-4 text-left transition-colors",
                        disabled
                          ? "cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] opacity-40"
                          : active
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]"
                            : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)] hover:text-[color:var(--text-strong)]",
                      )}
                      onClick={() => !disabled && setActiveTab(tab.label)}
                      aria-disabled={disabled}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-[color:var(--border-soft)] bg-white/70 dark:bg-white/[0.04]">
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{tab.label}</span>
                          <span className="block truncate text-xs text-[color:var(--muted-2)]">
                            {disabled ? "Izin administrator diperlukan" : tab.note}
                          </span>
                        </span>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
            </div>

          </OpsPanel>

          <div className="page-stack split-pane-right page-scroll pt-2">
            {activeTab === "Profil" ? (
              <>
                <OpsPanel className="overflow-hidden p-0">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
                    <div className="p-5">
                      <SectionHeader
                        title="Profil Pengguna"
                      />
                      <div className="mt-5 grid gap-4 xl:grid-cols-2">
                        <div className="xl:col-span-2">
                          <label className="label">Nama Lengkap</label>
                          <input
                            className="input-field"
                            value={draft.name}
                            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="label">Surel</label>
                          <input className="input-field input-readonly" value={data.profile.email} readOnly />
                        </div>
                        <div>
                          <label className="label">Stasiun</label>
                          <select
                            className="select-field"
                            value={draft.station}
                            onChange={(event) => setDraft((current) => ({ ...current, station: event.target.value }))}
                          >
                            {STATION_OPTIONS.map((station) => (
                              <option key={station} value={station}>
                                {station}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 p-5 lg:border-l lg:border-t-0">
                      <p className="ops-eyebrow">Akses Ruang Kerja</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">Hak akses dan izin yang melekat pada akun Anda.</p>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <DataCard label="Peran" value={ROLE_LABELS[data.profile.role]} />
                        <DataCard label="Stasiun" value={draft.station} />
                        <DataCard label="Akun pelanggan" value={data.profile.customerAccountName || "-"} />
                      </div>
                    </div>
                  </div>
                </OpsPanel>

                <WorkspaceSettingsPanel
                  draft={draft}
                  onPatch={applyDraftPatch}
                />
              </>
            ) : null}

            {activeTab === "Tim & Akses" && data.permissions.canManageUsers ? (
              <OpsPanel className="p-5">
                <SectionHeader
                  title="Tim & Akses"
                  subtitle="Pengguna, peran, dan izin."
                  action={
                    <button type="button" className="btn btn-primary" onClick={() => setInviteOpen((current) => !current)}>
                      <Plus size={16} />
                      {inviteOpen ? "Tutup" : "Tambah Pengguna"}
                    </button>
                  }
                />

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
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

                {inviteOpen ? (
                  <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]">
                      <input
                        className="input-field"
                        placeholder="Nama"
                        value={inviteForm.name}
                        onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                      />
                      <input
                        className="input-field"
                        placeholder="Surel"
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                      />
                      <select
                        className="select-field"
                        value={inviteForm.role}
                        onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                      >
                        <option value="staff">Staf Operasional</option>
                        <option value="admin">Administrator</option>
                        <option value="customer">Pelanggan</option>
                      </select>
                      <select
                        className="select-field"
                        value={inviteForm.station}
                        onChange={(event) => setInviteForm((current) => ({ ...current, station: event.target.value }))}
                      >
                        {STATION_OPTIONS.map((station) => (
                          <option key={station} value={station}>
                            {station}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select-field"
                        value={inviteForm.customerAccountId}
                        onChange={(event) =>
                          setInviteForm((current) => ({ ...current, customerAccountId: event.target.value }))
                        }
                        disabled={inviteForm.role !== "customer"}
                      >
                        <option value="">Akun pelanggan</option>
                        {data.customerAccounts.map((account) => (
                          <option key={account.id} value={account.id} disabled={account.status !== "active"}>
                            {account.name}{account.status !== "active" ? " (nonaktif)" : ""}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-primary" onClick={createUser} disabled={saving}>
                        <Plus size={16} />
                        {saving ? "Menyimpan..." : "Simpan"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="settings-table-toolbar">
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

                <div className="page-scroll table-shell mt-5 rounded-[24px] border border-[color:var(--border-soft)]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Surel</th>
                        <th>Peran</th>
                        <th>Izin rinci</th>
                        <th>Stasiun</th>
                        <th>Akun Pelanggan</th>
                        <th>Status</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-[color:var(--muted-fg)] font-medium">
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
                                <span className="font-semibold text-[color:var(--brand-primary)]">{user.station}</span>
                              </td>
                              <td>
                                <span className="text-sm text-[color:var(--muted-fg)]">{user.customerAccountName || "-"}</span>
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
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setEditingUserDraft(user);
                                  }}
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
                <div className="table-pagination-footer">
                  <button
                    type="button"
                    className="topbar-button"
                    onClick={() => setUserPage((current) => Math.max(1, current - 1))}
                    disabled={currentUserPage <= 1}
                  >
                    <ChevronLeft size={16} />
                    Sebelumnya
                  </button>
                  <p>
                    {userVisibleStart}-{userVisibleEnd} dari {filteredUsers.length} • Halaman {currentUserPage}/{userTotalPages}
                  </p>
                  <button
                    type="button"
                    className="topbar-button"
                    onClick={() => setUserPage((current) => Math.min(userTotalPages, current + 1))}
                    disabled={currentUserPage >= userTotalPages}
                  >
                    Berikutnya
                    <ChevronRight size={16} />
                  </button>
                </div>

              <OpsDrawer
                  open={Boolean(editingUserId && editingUserDraft)}
                  title="Ubah Hak Akses & Profil"
                  eyebrow="Kelola Anggota Tim"
                  description="Sesuaikan peran, stasiun, dan izin rinci pengguna."
                  onClose={() => {
                    setEditingUserId(null);
                    setEditingUserDraft(null);
                  }}
                  footer={
                    <div className="flex w-full items-center justify-end gap-3">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingUserId(null);
                          setEditingUserDraft(null);
                        }}
                      >
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

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="label">Peran</label>
                          <select
                            className="select-field mt-2"
                            value={editingUserDraft.role}
                            onChange={(event) =>
                              setEditingUserDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      role: event.target.value as SettingsPayload["users"][number]["role"],
                                      capabilities: defaultCapabilitiesForRole(
                                        event.target.value as SettingsPayload["users"][number]["role"],
                                      ),
                                    }
                                  : current,
                              )
                            }
                          >
                            <option value="staff">Staf Operasional</option>
                            <option value="admin">Administrator</option>
                            <option value="customer">Pelanggan</option>
                          </select>
                        </div>

                        <div>
                          <label className="label">Stasiun</label>
                          <select
                            className="select-field mt-2"
                            value={editingUserDraft.station}
                            onChange={(event) =>
                              setEditingUserDraft((current) =>
                                current ? { ...current, station: event.target.value } : current,
                              )
                            }
                          >
                            {STATION_OPTIONS.map((station) => (
                              <option key={station} value={station}>
                                {station}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="label">Akun Pelanggan</label>
                        <select
                          className="select-field mt-2"
                          value={editingUserDraft.customerAccountId || ""}
                          onChange={(event) =>
                            setEditingUserDraft((current) =>
                              current ? { ...current, customerAccountId: event.target.value || null } : current,
                            )
                          }
                          disabled={editingUserDraft.role !== "customer"}
                        >
                          <option value="">Tanpa akun</option>
                          {data.customerAccounts.map((account) => (
                            <option key={account.id} value={account.id} disabled={account.status !== "active"}>
                              {account.name}{account.status !== "active" ? " (nonaktif)" : ""}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-[color:var(--muted-2)]">
                          Peran pelanggan hanya dapat memakai Pelacakan AWB. Akun pelanggan nonaktif akan memblokir login.
                        </p>
                      </div>

                      <div>
                        <label className="label">Status</label>
                        <select
                          className="select-field mt-2"
                          value={editingUserDraft.status}
                          onChange={(event) =>
                            setEditingUserDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.target.value as SettingsPayload["users"][number]["status"],
                                  }
                                : current,
                            )
                          }
                        >
                          <option value="active">Aktif</option>
                          <option value="invited">Diundang</option>
                          <option value="disabled">Nonaktif</option>
                        </select>
                      </div>

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
                              Operasional: {editingUserDraft.role === "customer" ? "Pelacakan AWB" : "Dasbor, Buku Pengiriman, Pelacakan AWB"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              editingUserDraft.status === "disabled" || editingUserDraft.role === "customer"
                                ? "bg-[color:var(--tone-danger)]"
                                : "bg-[color:var(--tone-success)]"
                            )}>
                              {editingUserDraft.status === "disabled" || editingUserDraft.role === "customer" ? "✗" : "✓"}
                            </span>
                            <span className={cn(
                              "font-semibold",
                              editingUserDraft.status === "disabled" || editingUserDraft.role === "customer"
                                ? "text-[color:var(--muted-fg)] line-through"
                                : "text-[color:var(--text-strong)]"
                            )}>
                              Pemantauan: Papan Penerbangan, Pusat Peringatan, Catatan Aktivitas
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              editingUserDraft.status === "disabled" || editingUserDraft.role === "customer"
                                ? "bg-[color:var(--tone-danger)]"
                                : "bg-[color:var(--tone-success)]"
                            )}>
                              {editingUserDraft.status === "disabled" || editingUserDraft.role === "customer" ? "✗" : "✓"}
                            </span>
                            <span className={cn(
                              "font-semibold",
                              editingUserDraft.status === "disabled" || editingUserDraft.role === "customer"
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
                        {editingUserDraft.role === "customer" ? (
                          <p className="mt-2 rounded-[16px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--tone-info)]">
                            Peran pelanggan dikunci hanya untuk pelacakan. Izin internal hanya untuk administrator atau staf.
                          </p>
                        ) : null}
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
                                  disabled={editingUserDraft.role === "customer"}
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
            ) : null}

            {activeTab === "Akun Pelanggan" && data.permissions.canManageCustomerAccounts ? (
              <>
              <OpsPanel className="p-5">
                <SectionHeader
                  title="Akun Pelanggan"
                  subtitle="Akun, kontak, status."
                  action={
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setCustomerAccountOpen(true)}
                    >
                      <Plus size={16} />
                      Tambah Akun
                    </button>
                  }
                />

                <div className="settings-table-toolbar">
                  <span>{filteredAccounts.length} akun{accountSearch ? ` cocok "${accountSearch}"` : ""}</span>
                  <input
                    type="text"
                    className="input-field h-9 max-w-[220px] text-xs"
                    placeholder="Cari kode atau nama..."
                    value={accountSearch}
                    onChange={(event) => {
                      setAccountSearch(event.target.value);
                      setAccountPage(1);
                    }}
                  />
                </div>

                <div className="page-scroll table-shell mt-5 rounded-[24px] border border-[color:var(--border-soft)]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Nama</th>
                        <th>Penanggung Jawab</th>
                        <th>Surel</th>
                        <th>Telepon</th>
                        <th>Status</th>
                        <th>Relasi</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-[color:var(--muted-fg)] font-medium">
                            Tidak ada akun pelanggan yang cocok dengan pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        pagedAccounts.map((account) => (
                          <tr key={account.id}>
                            <td>
                              <span className="font-semibold text-[color:var(--brand-primary)]">{account.code}</span>
                            </td>
                            <td>{account.name}</td>
                            <td>{account.contactName || "-"}</td>
                            <td>{account.contactEmail || "-"}</td>
                            <td>{account.contactPhone || "-"}</td>
                            <td>
                              <StatusBadge value={account.status} label={CUSTOMER_ACCOUNT_STATUS_LABELS[account.status]} />
                            </td>
                            <td>
                              <div className="min-w-[120px] text-xs font-semibold text-[color:var(--muted-fg)]">
                                <p>{account.userCount} Pengguna</p>
                                <p className="mt-1">{account.shipmentCount} Pengiriman</p>
                              </div>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-secondary h-10 px-4"
                                onClick={() => {
                                  setEditingAccountId(account.id);
                                  setEditingAccountDraft(account);
                                }}
                              >
                                Ubah
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="table-pagination-footer">
                  <button
                    type="button"
                    className="topbar-button"
                    onClick={() => setAccountPage((current) => Math.max(1, current - 1))}
                    disabled={currentAccountPage <= 1}
                  >
                    <ChevronLeft size={16} />
                    Sebelumnya
                  </button>
                  <p>
                    {accountVisibleStart}-{accountVisibleEnd} dari {filteredAccounts.length} • Halaman {currentAccountPage}/{accountTotalPages}
                  </p>
                  <button
                    type="button"
                    className="topbar-button"
                    onClick={() => setAccountPage((current) => Math.min(accountTotalPages, current + 1))}
                    disabled={currentAccountPage >= accountTotalPages}
                  >
                    Berikutnya
                    <ChevronRight size={16} />
                  </button>
                </div>

                <OpsDrawer
                  open={Boolean(editingAccountId && editingAccountDraft)}
                  title="Ubah Akun Pelanggan"
                  eyebrow="Kelola Pelanggan"
                  description="Perbarui kode, profil kontak, dan status akun pelanggan dari panel terpisah."
                  onClose={() => {
                    setEditingAccountId(null);
                    setEditingAccountDraft(null);
                  }}
                  footer={
                    <div className="flex w-full items-center justify-end gap-3">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingAccountId(null);
                          setEditingAccountDraft(null);
                        }}
                      >
                        Batal
                      </button>
                      <button type="button" className="btn btn-primary" onClick={saveCustomerAccount} disabled={saving}>
                        <Check size={16} />
                        {saving ? "Menyimpan..." : "Simpan"}
                      </button>
                    </div>
                  }
                >
                  {editingAccountDraft ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                        <div>
                          <label className="label">Kode</label>
                          <input
                            className="input-field mt-2"
                            value={editingAccountDraft.code}
                            onChange={(event) =>
                              setEditingAccountDraft((current) =>
                                current ? { ...current, code: event.target.value } : current,
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Nama Akun</label>
                          <input
                            className="input-field mt-2"
                            value={editingAccountDraft.name}
                            onChange={(event) =>
                              setEditingAccountDraft((current) =>
                                current ? { ...current, name: event.target.value } : current,
                              )
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="label">Penanggung Jawab</label>
                        <input
                          className="input-field mt-2"
                          value={editingAccountDraft.contactName || ""}
                          onChange={(event) =>
                            setEditingAccountDraft((current) =>
                              current ? { ...current, contactName: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className="label">Surel Kontak</label>
                        <input
                          className="input-field mt-2"
                          value={editingAccountDraft.contactEmail || ""}
                          onChange={(event) =>
                            setEditingAccountDraft((current) =>
                              current ? { ...current, contactEmail: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className="label">Telepon</label>
                        <input
                          className="input-field mt-2"
                          value={editingAccountDraft.contactPhone || ""}
                          onChange={(event) =>
                            setEditingAccountDraft((current) =>
                              current ? { ...current, contactPhone: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className="label">Status</label>
                        <select
                          className="select-field mt-2"
                          value={editingAccountDraft.status}
                          onChange={(event) =>
                            setEditingAccountDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.target.value as SettingsPayload["customerAccounts"][number]["status"],
                                  }
                                : current,
                            )
                          }
                        >
                          <option value="active">Aktif</option>
                          <option value="disabled">Nonaktif</option>
                        </select>
                        <p className="mt-2 text-xs text-[color:var(--muted-2)]">
                          Nonaktif memblokir login seluruh pengguna pelanggan yang terhubung ke akun ini.
                        </p>
                      </div>

                      <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Relasi Akun</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <DataCard label="Pengguna terhubung" value={editingAccountDraft.userCount} />
                          <DataCard label="Pengiriman terhubung" value={editingAccountDraft.shipmentCount} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </OpsDrawer>
              </OpsPanel>

              <OpsDrawer
                  open={customerAccountOpen}
                title="Tambah Akun Pelanggan"
                eyebrow="Kelola Pelanggan"
                description="Buat akun pelanggan baru dengan kode unik dan informasi kontak."
                onClose={() => {
                  setCustomerAccountOpen(false);
                  setAccountForm({ code: "", name: "", contactName: "", contactEmail: "", contactPhone: "" });
                }}
                footer={
                  <div className="flex w-full items-center justify-end gap-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCustomerAccountOpen(false);
                        setAccountForm({ code: "", name: "", contactName: "", contactEmail: "", contactPhone: "" });
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={createCustomerAccountEntry}
                      disabled={saving}
                    >
                      <Plus size={16} />
                      {saving ? "Menyimpan..." : "Simpan"}
                    </button>
                  </div>
                }
              >
                <div className="space-y-6">
                  <div>
                    <label className="label">Kode Akun</label>
                    <input
                      className="input-field mt-2"
                      placeholder="Contoh: CGK-MG-001"
                      value={accountForm.code}
                      onChange={(event) => setAccountForm((current) => ({ ...current, code: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Nama Akun</label>
                    <input
                      className="input-field mt-2"
                      placeholder="Nama perusahaan atau entitas pelanggan"
                      value={accountForm.name}
                      onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Penanggung Jawab</label>
                      <input
                        className="input-field mt-2"
                        placeholder="Nama penanggung jawab"
                        value={accountForm.contactName}
                        onChange={(event) => setAccountForm((current) => ({ ...current, contactName: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Surel</label>
                      <input
                        className="input-field mt-2"
                        placeholder="Surel kontak"
                        value={accountForm.contactEmail}
                        onChange={(event) => setAccountForm((current) => ({ ...current, contactEmail: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Telepon</label>
                      <input
                        className="input-field mt-2"
                        placeholder="Nomor telepon"
                        value={accountForm.contactPhone}
                        onChange={(event) => setAccountForm((current) => ({ ...current, contactPhone: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </OpsDrawer>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
