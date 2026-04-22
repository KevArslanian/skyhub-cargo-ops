"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Monitor,
  MoonStar,
  Plus,
  ShieldCheck,
  SunMedium,
  UserCircle2,
  Users2,
  X,
} from "lucide-react";
import {
  CUSTOMER_ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  ROLE_SCOPE_COPY,
  STATION_OPTIONS,
  USER_STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { DataCard, OpsPanel, PageHeader, SectionHeader, SkeletonBlock } from "@/components/ops-ui";

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
    theme: "light" | "dark";
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
  theme: "light" | "dark";
  compactRows: boolean;
  sidebarCollapsed: boolean;
  autoRefresh: boolean;
  refreshIntervalSeconds: number;
  cutoffAlert: boolean;
  exceptionAlert: boolean;
  soundAlert: boolean;
  emailDigest: boolean;
};

function toDraft(data: SettingsPayload | null): SettingsDraft {
  return {
    name: data?.profile.name ?? "",
    station: data?.profile.station ?? "SOQ",
    theme: data?.settings?.theme ?? "light",
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

function PreferenceToggleCard({
  title,
  copy,
  checked,
  onChange,
  hint,
}: {
  title: string;
  copy: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-[24px] border px-4 py-4 transition-colors",
        checked
          ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]"
          : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[color:var(--text-strong)]">{title}</p>
          <StatusBadge
            value={checked ? "success" : "disabled"}
            label={checked ? "Aktif" : "Nonaktif"}
            className="normal-case tracking-normal"
          />
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{copy}</p>
        {hint ? <p className="mt-2 text-xs text-[color:var(--muted-2)]">{hint}</p> : null}
      </div>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-7 w-12 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] transition-colors peer-checked:border-[color:var(--brand-primary)] peer-checked:bg-[color:var(--brand-primary)]" />
        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function ThemePreviewCard({
  label,
  title,
  description,
  active,
  onSelect,
  mode,
}: {
  label: string;
  title: string;
  description: string;
  active: boolean;
  onSelect: () => void;
  mode: "light" | "dark";
}) {
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[24px] border p-4 text-left transition-all",
        active
          ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)] shadow-[0_14px_28px_rgba(0,61,155,0.12)]"
          : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] hover:border-[rgba(0,82,204,0.12)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">{label}</p>
          <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{description}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-[color:var(--border-soft)] bg-white/70 text-[color:var(--brand-primary)] dark:bg-white/[0.04]">
          {isDark ? <MoonStar size={18} /> : <SunMedium size={18} />}
        </span>
      </div>

      <div
        className={cn(
          "mt-4 overflow-hidden rounded-[20px] border p-3",
          isDark ? "border-[#203a58] bg-[#0f2037]" : "border-[#d7e2ef] bg-white",
        )}
      >
        <div
          className={cn(
            "flex h-8 items-center justify-between rounded-[14px] px-3",
            isDark ? "bg-[#122840] text-[#d9e7fb]" : "bg-[#f4f7fb] text-[#0b1d33]",
          )}
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span className={cn("h-2 w-2 rounded-full", isDark ? "bg-[#6da7ff]" : "bg-[#003d9b]")} />
            SkyHub
          </div>
          <div className="h-2 w-16 rounded-full bg-current/15" />
        </div>
        <div className="mt-3 grid grid-cols-[1.1fr_0.9fr] gap-3">
          <div className={cn("rounded-[16px] p-3", isDark ? "bg-[#122840]" : "bg-[#eff4fa]")}>
            <div className="h-2 w-14 rounded-full bg-current/15" />
            <div className="mt-3 h-6 w-24 rounded-full bg-current/12" />
            <div className="mt-3 h-14 rounded-[12px] bg-current/10" />
          </div>
          <div className="space-y-3">
            <div className={cn("rounded-[16px] p-3", isDark ? "bg-[#122840]" : "bg-[#eff4fa]")}>
              <div className="h-3 w-10 rounded-full bg-current/15" />
              <div className="mt-3 h-5 w-16 rounded-full bg-current/12" />
            </div>
            <div className={cn("rounded-[16px] p-3", isDark ? "bg-[#122840]" : "bg-[#eff4fa]")}>
              <div className="h-3 w-12 rounded-full bg-current/15" />
              <div className="mt-3 h-5 w-20 rounded-full bg-current/12" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(null));
  const [activeTab, setActiveTab] = useState("Profil");
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: SettingsPayload) => {
        setData(payload);
        setDraft(toDraft(payload));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const baseDraft = useMemo(() => toDraft(data), [data]);
  const hasDraftChanges = useMemo(
    () => JSON.stringify(baseDraft) !== JSON.stringify(draft),
    [baseDraft, draft],
  );

  const tabs = useMemo(() => {
    const items = [
      {
        label: "Profil",
        icon: UserCircle2,
        note: "Identitas, role, stasiun",
      },
      {
        label: "Preferensi",
        icon: Monitor,
        note: "Tampilan, notifikasi, behavior",
      },
    ];

    if (data?.permissions.canManageUsers) {
      items.push({
        label: "Tim & Akses",
        icon: Users2,
        note: "Hak akses dan undangan user",
      });
    }

    if (data?.permissions.canManageCustomerAccounts) {
      items.push({
        label: "Akun Pelanggan",
        icon: Building2,
        note: "Relasi portal dan kontak akun",
      });
    }

    return items;
  }, [data?.permissions.canManageCustomerAccounts, data?.permissions.canManageUsers]);

  const preferenceSummary = [
    {
      label: "Tema aktif",
      value: draft.theme === "light" ? "Terang" : "Gelap",
      note: "Preview diterapkan langsung ke shell aplikasi.",
      tone: "primary" as const,
    },
    {
      label: "Densitas kerja",
      value: draft.compactRows ? "Baris ringkas" : "Baris standar",
      note: draft.sidebarCollapsed ? "Sidebar default terlipat" : "Sidebar default terbuka",
      tone: "info" as const,
    },
    {
      label: "Notifikasi aktif",
      value: [draft.cutoffAlert, draft.exceptionAlert, draft.soundAlert, draft.emailDigest].filter(Boolean).length,
      note: "Jumlah kanal yang sedang diaktifkan.",
      tone: "success" as const,
    },
    {
      label: "Refresh behavior",
      value: draft.autoRefresh ? `${draft.refreshIntervalSeconds} detik` : "Manual",
      note: "Mengontrol ritme sinkronisasi workspace.",
      tone: "warning" as const,
    },
  ];

  function emitSettingsPreview(patch: Partial<SettingsDraft>) {
    window.dispatchEvent(new CustomEvent("skyhub:settings-preview", { detail: patch }));
  }

  function applyDraftPatch(patch: Partial<SettingsDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    emitSettingsPreview(patch);
  }

  async function saveSettings() {
    setSaving(true);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (response.ok) {
      const payload = (await response.json()) as SettingsPayload;
      setData(payload);
      setDraft(toDraft(payload));
      emitSettingsPreview(toDraft(payload));
      setNotice("Pengaturan berhasil disimpan.");
    }

    setSaving(false);
  }

  async function createUser() {
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
    }
  }

  async function saveUser() {
    if (!editingUserId || !editingUserDraft) return;

    const response = await fetch(`/api/users/${editingUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: editingUserDraft.role,
        status: editingUserDraft.status,
        station: editingUserDraft.station,
        customerAccountId:
          editingUserDraft.role === "customer" ? editingUserDraft.customerAccountId : null,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { user: SettingsPayload["users"][number] };
      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.map((user) => (user.id === payload.user.id ? payload.user : user)),
            }
          : current,
      );
      setEditingUserId(null);
      setEditingUserDraft(null);
      setNotice("Pengguna berhasil diperbarui.");
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
    }
  }

  async function saveCustomerAccount() {
    if (!editingAccountId || !editingAccountDraft) return;

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
      const payload = (await response.json()) as {
        customerAccount: SettingsPayload["customerAccounts"][number];
      };
      setData((current) =>
        current
          ? {
              ...current,
              customerAccounts: current.customerAccounts.map((account) =>
                account.id === payload.customerAccount.id ? payload.customerAccount : account,
              ),
            }
          : current,
      );
      setEditingAccountId(null);
      setEditingAccountDraft(null);
      setNotice("Akun pelanggan berhasil diperbarui.");
    }
  }

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Pengaturan"
        title="Pengaturan"
        subtitle="Pusat preferensi yang lebih modular: profil, tampilan, notifikasi, workflow, dan behavior ditata sebagai sistem kerja yang utuh."
        actions={
          <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            <ShieldCheck size={16} />
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        }
      />

      {notice ? (
        <div className="rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
          {notice}
        </div>
      ) : null}

      {!data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
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
        <div className="grid gap-6 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] split-pane-shell split-pane-shell-settings">
          <OpsPanel className="page-pane split-pane-left p-4">
            <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[color:var(--brand-primary)] font-[family:var(--font-heading)] text-xl font-black tracking-[-0.04em] text-white">
                  {getInitials(draft.name || data.profile.name || "Sky Hub")}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-[family:var(--font-heading)] text-[1.45rem] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                    {draft.name || data.profile.name}
                  </p>
                  <p className="truncate text-sm text-[color:var(--muted-fg)]">{data.profile.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge value="info" label={ROLE_LABELS[data.profile.role]} />
                    <StatusBadge value="active" label={draft.station} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.label;

                return (
                  <button
                    key={tab.label}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition-colors",
                      active
                        ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]"
                        : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)] hover:text-[color:var(--text-strong)]",
                    )}
                    onClick={() => setActiveTab(tab.label)}
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-[color:var(--border-soft)] bg-white/70 dark:bg-white/[0.04]">
                        <Icon size={18} />
                      </span>
                      <span>
                        <span className="block font-semibold">{tab.label}</span>
                        <span className="block text-xs text-[color:var(--muted-2)]">{tab.note}</span>
                      </span>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
              <p className="label">Ringkasan Workspace</p>
              <div className="mt-3 space-y-3 text-sm text-[color:var(--muted-fg)]">
                <p>Theme {draft.theme === "light" ? "terang" : "gelap"} dengan {draft.compactRows ? "baris ringkas" : "baris standar"}.</p>
                <p>Auto refresh {draft.autoRefresh ? `aktif tiap ${draft.refreshIntervalSeconds} detik` : "dinonaktifkan"}.</p>
                <p>{hasDraftChanges ? "Ada perubahan yang belum disimpan." : "Semua preferensi sudah sinkron dengan shell aplikasi."}</p>
              </div>
            </div>
          </OpsPanel>

          <div className="page-stack split-pane-right page-scroll">
            {activeTab === "Profil" ? (
              <>
                <OpsPanel className="overflow-hidden p-0">
                  <div className="grid gap-0 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
                    <div className="p-6">
                      <SectionHeader
                        title="Profil Pengguna"
                        subtitle="Identitas akun, stasiun aktif, dan metadata akses disusun sebagai ringkasan yang lebih jelas."
                      />
                      <div className="mt-6 grid gap-4 xl:grid-cols-2">
                        <div className="xl:col-span-2">
                          <label className="label">Nama Lengkap</label>
                          <input
                            className="input-field"
                            value={draft.name}
                            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="label">Email</label>
                          <input className="input-field" value={data.profile.email} readOnly />
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

                    <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 p-6 xl:border-l xl:border-t-0">
                      <p className="ops-eyebrow">Akses Workspace</p>
                      <div className="mt-4 space-y-3">
                        <DataCard label="Peran" value={ROLE_LABELS[data.profile.role]} note="Hak akses saat ini" />
                        <DataCard
                          label="Hak akses peran"
                          value={data.profile.role === "admin" ? "Manajemen penuh" : data.profile.role === "staff" ? "Operasional internal" : "Portal pelanggan"}
                          note={ROLE_SCOPE_COPY[data.profile.role]}
                        />
                        <DataCard
                          label="Stasiun aktif"
                          value={draft.station}
                          note={data.profile.role === "staff" ? "Digunakan sebagai konteks default staff operasional." : "Konteks stasiun untuk workspace saat ini."}
                        />
                        <DataCard
                          label="Akun pelanggan"
                          value={data.profile.customerAccountName || "-"}
                          note="Akan muncul bila akun ini terhubung ke portal pelanggan"
                        />
                      </div>
                    </div>
                  </div>
                </OpsPanel>

                <div className="sticky bottom-0 z-10 rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/92 px-5 py-4 shadow-[0_14px_34px_rgba(11,30,52,0.10)] backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">
                        {hasDraftChanges ? "Perubahan profil belum disimpan" : "Profil sudah sinkron"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
                        Simpan untuk menerapkan perubahan nama, stasiun, dan preferensi yang sudah diubah.
                      </p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                      <ShieldCheck size={16} />
                      {saving ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === "Preferensi" ? (
              <>
                <div className="grid gap-4 xl:grid-cols-4">
                  {preferenceSummary.map((item) => (
                    <DataCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      note={item.note}
                      tone={item.tone}
                    />
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <OpsPanel className="p-5">
                    <SectionHeader
                      title="Tampilan"
                      subtitle="Preview tema dibuat nyata agar perubahan terasa lebih terkontrol, bukan sekadar toggle."
                    />
                    <div className="mt-5 grid gap-4">
                      <ThemePreviewCard
                        label="Mode terang"
                        title="Light operations shell"
                        description="Fokus tinggi untuk angka, badge, dan tabel di ruang kontrol."
                        mode="light"
                        active={draft.theme === "light"}
                        onSelect={() => applyDraftPatch({ theme: "light" })}
                      />
                      <ThemePreviewCard
                        label="Mode gelap"
                        title="Dark fallback shell"
                        description="Dipakai bila lingkungan operasi membutuhkan luminansi lebih rendah."
                        mode="dark"
                        active={draft.theme === "dark"}
                        onSelect={() => applyDraftPatch({ theme: "dark" })}
                      />
                    </div>
                  </OpsPanel>

                  <OpsPanel className="p-5">
                    <SectionHeader
                      title="Workflow"
                      subtitle="Kepadatan baris dan state sidebar dikelompokkan sebagai perilaku kerja tim operasional."
                    />
                    <div className="mt-5 space-y-4">
                      <PreferenceToggleCard
                        title="Baris ringkas"
                        copy="Rapatkan tinggi baris tabel agar ledger, audit log, dan manifest lebih padat."
                        hint="Cocok untuk shift yang perlu memindai banyak identifier dalam satu layar."
                        checked={draft.compactRows}
                        onChange={(value) => applyDraftPatch({ compactRows: value })}
                      />
                      <PreferenceToggleCard
                        title="Sidebar terlipat"
                        copy="Simpan sidebar dalam kondisi terlipat untuk memberi ruang kerja lebih luas."
                        hint="Tetap mempertahankan anchor navigasi utama di kiri."
                        checked={draft.sidebarCollapsed}
                        onChange={(value) => applyDraftPatch({ sidebarCollapsed: value })}
                      />
                    </div>
                  </OpsPanel>

                  <OpsPanel className="p-5">
                    <SectionHeader
                      title="Notifikasi"
                      subtitle="Kanal alert dipisah jelas antara warning operasional dan notifikasi pelengkap."
                    />
                    <div className="mt-5 space-y-4">
                      <PreferenceToggleCard
                        title="Cutoff alerts"
                        copy="Peringatan saat cutoff flight mendekat agar manifest tidak terlambat ditutup."
                        checked={draft.cutoffAlert}
                        onChange={(value) => applyDraftPatch({ cutoffAlert: value })}
                      />
                      <PreferenceToggleCard
                        title="Exception alerts"
                        copy="Sorot shipment hold, data bermasalah, atau exception yang perlu review."
                        checked={draft.exceptionAlert}
                        onChange={(value) => applyDraftPatch({ exceptionAlert: value })}
                      />
                      <PreferenceToggleCard
                        title="Sound alerts"
                        copy="Aktifkan bunyi notifikasi untuk workspace yang membutuhkan response cepat."
                        checked={draft.soundAlert}
                        onChange={(value) => applyDraftPatch({ soundAlert: value })}
                      />
                      <PreferenceToggleCard
                        title="Email digest"
                        copy="Ringkasan berkala untuk user yang perlu rekap tanpa memantau layar terus-menerus."
                        checked={draft.emailDigest}
                        onChange={(value) => applyDraftPatch({ emailDigest: value })}
                      />
                    </div>
                  </OpsPanel>

                  <OpsPanel className="p-5">
                    <SectionHeader
                      title="Refresh & Behavior"
                      subtitle="Auto refresh tidak lagi berdiri sendirian; ia ditempatkan bersama ritme sinkronisasi workspace."
                    />
                    <div className="mt-5 space-y-4">
                      <PreferenceToggleCard
                        title="Penyegaran otomatis"
                        copy="Segarkan dashboard dan panel monitoring tanpa reload manual."
                        hint="Aktifkan untuk ruang kontrol yang memerlukan sinkronisasi berulang."
                        checked={draft.autoRefresh}
                        onChange={(value) => applyDraftPatch({ autoRefresh: value })}
                      />
                      <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[color:var(--text-strong)]">Interval penyegaran</p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">
                              Semakin pendek interval, semakin cepat update datang, tetapi semakin tinggi aktivitas refresh.
                            </p>
                          </div>
                          <StatusBadge value={draft.autoRefresh ? "success" : "disabled"} label={draft.autoRefresh ? "Aktif" : "Manual"} />
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <input
                            type="number"
                            min={5}
                            max={60}
                            className="input-field w-full sm:max-w-[140px]"
                            value={draft.refreshIntervalSeconds}
                            onChange={(event) =>
                              applyDraftPatch({ refreshIntervalSeconds: Number(event.target.value) })
                            }
                          />
                          <span className="text-sm text-[color:var(--muted-fg)]">detik per refresh</span>
                        </div>
                      </div>
                    </div>
                  </OpsPanel>
                </div>

                <div className="sticky bottom-0 z-10 rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/92 px-5 py-4 shadow-[0_14px_34px_rgba(11,30,52,0.10)] backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">
                        {hasDraftChanges ? "Preferensi belum disimpan" : "Semua preferensi sinkron"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
                        Preview perubahan diterapkan ke shell saat Anda mengatur, lalu dipermanenkan melalui tombol simpan.
                      </p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                      <ShieldCheck size={16} />
                      {saving ? "Menyimpan..." : "Simpan Preferensi"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === "Tim & Akses" && data.permissions.canManageUsers ? (
              <OpsPanel className="p-5">
                <SectionHeader
                  title="Tim & Akses"
                  subtitle="Undangan, peran, stasiun, dan hubungan akun pelanggan ditata lebih rapat agar review akses tidak terasa datar."
                  action={
                    <button type="button" className="btn btn-primary" onClick={() => setInviteOpen((current) => !current)}>
                      <Plus size={16} />
                      {inviteOpen ? "Tutup" : "Tambah Pengguna"}
                    </button>
                  }
                />

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <DataCard label="Total user" value={data.users.length} note="Semua akun yang terdaftar di workspace." tone="primary" />
                  <DataCard
                    label="User aktif"
                    value={data.users.filter((user) => user.status === "active").length}
                    note="Akun yang dapat mengakses sistem saat ini."
                    tone="success"
                  />
                  <DataCard
                    label="Perlu follow-up"
                    value={data.users.filter((user) => user.status !== "active").length}
                    note="Undangan atau akun nonaktif yang mungkin butuh tindakan."
                    tone="warning"
                  />
                </div>

                <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                  <p className="label">Batas Akses Role</p>
                  <div className="mt-3 grid gap-3 xl:grid-cols-3">
                    <div className="rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3">
                      <p className="font-semibold text-[color:var(--text-strong)]">Admin</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{ROLE_SCOPE_COPY.admin}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-3">
                      <p className="font-semibold text-[color:var(--text-strong)]">Staff Operasional</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{ROLE_SCOPE_COPY.staff}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-3">
                      <p className="font-semibold text-[color:var(--text-strong)]">Pelanggan</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{ROLE_SCOPE_COPY.customer}</p>
                    </div>
                  </div>
                </div>

                {inviteOpen ? (
                  <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_0.9fr_0.9fr_1fr_auto]">
                      <input
                        className="input-field"
                        placeholder="Nama"
                        value={inviteForm.name}
                        onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                      />
                      <input
                        className="input-field"
                        placeholder="Email"
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                      />
                      <select
                        className="select-field"
                        value={inviteForm.role}
                        onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                      >
                        <option value="staff">Staff Operasional</option>
                        <option value="admin">Admin</option>
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
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-primary" onClick={createUser}>
                        <Plus size={16} />
                        Simpan
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="page-scroll table-shell mt-5 rounded-[24px] border border-[color:var(--border-soft)]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Email</th>
                        <th>Peran</th>
                        <th>Stasiun</th>
                        <th>Akun Pelanggan</th>
                        <th>Status</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((user) => {
                        const userRowDraft = editingUserId === user.id ? editingUserDraft : null;
                        const isEditing = Boolean(userRowDraft);

                        return (
                          <tr key={user.id}>
                            <td className="font-semibold text-[color:var(--text-strong)]">{user.name}</td>
                            <td>{user.email}</td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={userRowDraft?.role ?? user.role}
                                  onChange={(event) =>
                                    setEditingUserDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            role: event.target.value as SettingsPayload["users"][number]["role"],
                                          }
                                        : current,
                                    )
                                  }
                                >
                                  <option value="staff">Staff Operasional</option>
                                  <option value="admin">Admin</option>
                                  <option value="customer">Pelanggan</option>
                                </select>
                              ) : (
                                <div className="space-y-1">
                                  <p className="font-medium text-[color:var(--text-strong)]">{ROLE_LABELS[user.role]}</p>
                                  <p className="text-xs leading-5 text-[color:var(--muted-fg)]">{ROLE_SCOPE_COPY[user.role]}</p>
                                </div>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={userRowDraft?.station ?? user.station}
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
                              ) : (
                                <span className="font-semibold text-[color:var(--brand-primary)]">{user.station}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={userRowDraft?.customerAccountId || ""}
                                  onChange={(event) =>
                                    setEditingUserDraft((current) =>
                                      current ? { ...current, customerAccountId: event.target.value || null } : current,
                                    )
                                  }
                                  disabled={userRowDraft?.role !== "customer"}
                                >
                                  <option value="">Tanpa akun</option>
                                  {data.customerAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-sm text-[color:var(--muted-fg)]">{user.customerAccountName || "-"}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={userRowDraft?.status ?? user.status}
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
                              ) : (
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
                              )}
                            </td>
                            <td className="text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <button type="button" className="btn btn-primary h-10 px-4" onClick={saveUser}>
                                    <Check size={15} />
                                    Simpan
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary h-10 px-4"
                                    onClick={() => {
                                      setEditingUserId(null);
                                      setEditingUserDraft(null);
                                    }}
                                  >
                                    <X size={15} />
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary h-10 px-4"
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setEditingUserDraft(user);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </OpsPanel>
            ) : null}

            {activeTab === "Akun Pelanggan" && data.permissions.canManageCustomerAccounts ? (
              <OpsPanel className="p-5">
                <SectionHeader
                  title="Akun Pelanggan"
                  subtitle="Portal, relasi user, dan kontak akun pelanggan dirangkum dalam workspace yang lebih sistematis."
                  action={
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setCustomerAccountOpen((current) => !current)}
                    >
                      <Plus size={16} />
                      {customerAccountOpen ? "Tutup" : "Tambah Akun"}
                    </button>
                  }
                />

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <DataCard label="Total akun" value={data.customerAccounts.length} note="Semua akun pelanggan yang terhubung." tone="primary" />
                  <DataCard
                    label="Akun aktif"
                    value={data.customerAccounts.filter((account) => account.status === "active").length}
                    note="Dapat digunakan untuk login dan scope shipment."
                    tone="success"
                  />
                  <DataCard
                    label="Relasi shipment"
                    value={data.customerAccounts.reduce((sum, account) => sum + account.shipmentCount, 0)}
                    note="Total shipment aktif yang terhubung ke akun pelanggan."
                    tone="info"
                  />
                </div>

                {customerAccountOpen ? (
                  <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <div className="grid gap-4 lg:grid-cols-[0.7fr_1.2fr_1fr_1fr_1fr_auto]">
                      <input
                        className="input-field"
                        placeholder="Kode"
                        value={accountForm.code}
                        onChange={(event) => setAccountForm((current) => ({ ...current, code: event.target.value }))}
                      />
                      <input
                        className="input-field"
                        placeholder="Nama akun"
                        value={accountForm.name}
                        onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                      />
                      <input
                        className="input-field"
                        placeholder="PIC"
                        value={accountForm.contactName}
                        onChange={(event) =>
                          setAccountForm((current) => ({ ...current, contactName: event.target.value }))
                        }
                      />
                      <input
                        className="input-field"
                        placeholder="Email kontak"
                        value={accountForm.contactEmail}
                        onChange={(event) =>
                          setAccountForm((current) => ({ ...current, contactEmail: event.target.value }))
                        }
                      />
                      <input
                        className="input-field"
                        placeholder="Telepon"
                        value={accountForm.contactPhone}
                        onChange={(event) =>
                          setAccountForm((current) => ({ ...current, contactPhone: event.target.value }))
                        }
                      />
                      <button type="button" className="btn btn-primary" onClick={createCustomerAccountEntry}>
                        <Plus size={16} />
                        Simpan
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="page-scroll table-shell mt-5 rounded-[24px] border border-[color:var(--border-soft)]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Nama</th>
                        <th>PIC</th>
                        <th>Email</th>
                        <th>Telepon</th>
                        <th>Status</th>
                        <th>Relasi</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customerAccounts.map((account) => {
                        const accountRowDraft = editingAccountId === account.id ? editingAccountDraft : null;
                        const isEditing = Boolean(accountRowDraft);

                        return (
                          <tr key={account.id}>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-field h-10"
                                  value={accountRowDraft?.code ?? account.code}
                                  onChange={(event) =>
                                    setEditingAccountDraft((current) =>
                                      current ? { ...current, code: event.target.value } : current,
                                    )
                                  }
                                />
                              ) : (
                                <span className="font-semibold text-[color:var(--brand-primary)]">{account.code}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-field h-10"
                                  value={accountRowDraft?.name ?? account.name}
                                  onChange={(event) =>
                                    setEditingAccountDraft((current) =>
                                      current ? { ...current, name: event.target.value } : current,
                                    )
                                  }
                                />
                              ) : (
                                account.name
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-field h-10"
                                  value={accountRowDraft?.contactName || ""}
                                  onChange={(event) =>
                                    setEditingAccountDraft((current) =>
                                      current ? { ...current, contactName: event.target.value } : current,
                                    )
                                  }
                                />
                              ) : (
                                account.contactName || "-"
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-field h-10"
                                  value={accountRowDraft?.contactEmail || ""}
                                  onChange={(event) =>
                                    setEditingAccountDraft((current) =>
                                      current ? { ...current, contactEmail: event.target.value } : current,
                                    )
                                  }
                                />
                              ) : (
                                account.contactEmail || "-"
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-field h-10"
                                  value={accountRowDraft?.contactPhone || ""}
                                  onChange={(event) =>
                                    setEditingAccountDraft((current) =>
                                      current ? { ...current, contactPhone: event.target.value } : current,
                                    )
                                  }
                                />
                              ) : (
                                account.contactPhone || "-"
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={accountRowDraft?.status ?? account.status}
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
                              ) : (
                                <StatusBadge value={account.status} label={CUSTOMER_ACCOUNT_STATUS_LABELS[account.status]} />
                              )}
                            </td>
                            <td className="text-sm text-[color:var(--muted-fg)]">
                              {account.userCount} pengguna • {account.shipmentCount} shipment
                            </td>
                            <td className="text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <button type="button" className="btn btn-primary h-10 px-4" onClick={saveCustomerAccount}>
                                    <Check size={15} />
                                    Simpan
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary h-10 px-4"
                                    onClick={() => {
                                      setEditingAccountId(null);
                                      setEditingAccountDraft(null);
                                    }}
                                  >
                                    <X size={15} />
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary h-10 px-4"
                                  onClick={() => {
                                    setEditingAccountId(account.id);
                                    setEditingAccountDraft(account);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </OpsPanel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
