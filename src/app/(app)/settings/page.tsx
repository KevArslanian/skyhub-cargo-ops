"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BellRing, Check, ChevronRight, Mail, Monitor, PanelLeftOpen, PencilLine, Plus, TriangleAlert, UserCircle2, Users2, Volume2, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

type SettingsPayload = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "supervisor" | "operator" | "customer";
    station: string;
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
  users: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "supervisor" | "operator" | "customer";
    station: string;
    status: "active" | "invited" | "disabled";
  }[];
};

const tabs = [
  { label: "Profile", icon: UserCircle2 },
  { label: "User & Role", icon: Users2 },
  { label: "Notifications", icon: BellRing },
  { label: "Display Preferences", icon: Monitor },
  { label: "Sidebar Preferences", icon: PanelLeftOpen },
] as const;

const tabGroups = [
  {
    id: "account",
    label: "Account",
    items: ["Profile", "User & Role"] as const,
  },
  {
    id: "workspace",
    label: "Workspace",
    items: ["Notifications", "Display Preferences", "Sidebar Preferences"] as const,
  },
] as const;

const stationOptions = ["CGK", "SUB", "DPS", "SOQ", "UPG", "BPN"] as const;

const rolePillClasses: Record<SettingsPayload["profile"]["role"], string> = {
  admin:
    "border border-[color:var(--tone-danger-soft)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
  supervisor:
    "border border-[color:var(--tone-warning-soft)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  operator:
    "border border-[color:var(--brand-primary-soft)] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]",
  customer:
    "border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
};

const userStatusLabels: Record<SettingsPayload["users"][number]["status"], string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Disabled",
};

const roleDefinitionCards = [
  {
    title: "Admin",
    copy: "Akses penuh lintas modul, manajemen user, dan kontrol konfigurasi.",
  },
  {
    title: "Supervisor",
    copy: "Monitoring operasional, approval, eskalasi isu, dan review audit.",
  },
  {
    title: "Operator",
    copy: "CRUD shipment, tracking AWB, pembaruan status, dan pengelolaan dokumen.",
  },
  {
    title: "Customer",
    copy: "Akses terbatas ke dashboard ringkas, tracking, reports, dan profil sendiri.",
  },
] as const;

type PreferenceToggleCardProps = {
  title: string;
  copy: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function PreferenceToggleCard({ title, copy, checked, onChange }: PreferenceToggleCardProps) {
  return (
    <label className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-[color:var(--text-strong)]">{title}</p>
        <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{copy}</p>
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

function toDraft(data: SettingsPayload | null) {
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

type SettingsDraft = ReturnType<typeof toDraft>;

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function clampRefreshInterval(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(60, Math.max(5, value));
}

export default function SettingsPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["label"]>("Profile");
  const [saving, setSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: SettingsPayload["users"][number]["role"]; station: string }>({
    name: "",
    email: "",
    role: "operator",
    station: "SOQ",
  });
  const [draft, setDraft] = useState(() => toDraft(null));
  const [openGroupId, setOpenGroupId] = useState<(typeof tabGroups)[number]["id"]>("account");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState<{
    role: SettingsPayload["users"][number]["role"];
    status: SettingsPayload["users"][number]["status"];
    station: string;
  } | null>(null);
  const [previewNotice, setPreviewNotice] = useState<{
    title: string;
    copy: string;
    tone: "info" | "warning" | "success";
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: SettingsPayload) => {
        setData(payload);
        setDraft(toDraft(payload));
      })
      .catch(() => undefined);
  }, []);

  function emitSettingsPreview(patch: Partial<SettingsDraft>) {
    window.dispatchEvent(new CustomEvent("skyhub:settings-preview", { detail: patch }));
    if (patch.theme) {
      window.dispatchEvent(new CustomEvent("skyhub:theme-change", { detail: patch.theme }));
    }
  }

  function applyDraftPatch(
    patch: Partial<SettingsDraft>,
    notice?: {
      title: string;
      copy: string;
      tone: "info" | "warning" | "success";
    },
  ) {
    setDraft((current) => ({ ...current, ...patch }));
    emitSettingsPreview(patch);

    if (patch.theme) {
      setTheme(patch.theme);
    }

    if (notice) {
      setPreviewNotice(notice);
    }
  }

  async function playAlertTone(kind: "cutoff" | "exception" | "sound" = "sound") {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      setPreviewNotice({
        title: "Browser tidak mendukung audio preview",
        copy: "Gunakan browser modern agar tes bunyi alarm bisa diputar langsung dari settings.",
        tone: "warning",
      });
      return;
    }

    const context = new AudioContextCtor();
    await context.resume();

    const notes =
      kind === "cutoff" ? [784, 988] : kind === "exception" ? [523, 392, 523] : [660, 880];
    let start = context.currentTime;

    notes.forEach((frequency) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = kind === "exception" ? "square" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.24);

      start += 0.18;
    });

    window.setTimeout(() => {
      void context.close();
    }, notes.length * 260);
  }

  async function triggerNotificationPreview(type: "cutoff" | "exception" | "sound" | "email") {
    if (type === "cutoff") {
      window.dispatchEvent(
        new CustomEvent("skyhub:notification-preview", {
          detail: {
            title: "Tes cutoff mendekat",
            message: "GA-714 akan menutup penerimaan kargo dalam 18 menit. Ini hanya preview dari settings.",
            type: "warning",
            href: "/flight-board",
          },
        }),
      );

      if (draft.soundAlert) {
        await playAlertTone("cutoff");
      }

      setPreviewNotice({
        title: "Cutoff alert dipicu",
        copy: "Counter alert di topbar bertambah dan preview notifikasi cutoff dimunculkan.",
        tone: "warning",
      });
      return;
    }

    if (type === "exception") {
      window.dispatchEvent(
        new CustomEvent("skyhub:notification-preview", {
          detail: {
            title: "Tes exception shipment",
            message: "AWB 160-23456789 butuh validasi manual. Ini hanya preview dari settings.",
            type: "error",
            href: "/awb-tracking?awb=160-23456789",
          },
        }),
      );

      if (draft.soundAlert) {
        await playAlertTone("exception");
      }

      setPreviewNotice({
        title: "Exception alert dipicu",
        copy: "Preview notifikasi exception muncul agar operator langsung tahu bentuk alert-nya.",
        tone: "warning",
      });
      return;
    }

    if (type === "sound") {
      await playAlertTone("sound");
      setPreviewNotice({
        title: "Tes bunyi alarm diputar",
        copy: "Nada preview dipakai untuk memastikan toggle sound alert benar-benar bekerja di browser ini.",
        tone: "success",
      });
      return;
    }

    setPreviewNotice({
      title: "Preview email digest aktif",
      copy: `Simulasi ringkasan harian ditujukan ke ${data?.profile.email ?? "operator aktif"} tanpa benar-benar mengirim email.`,
      tone: "info",
    });
  }

  async function saveSettings() {
    setSaving(true);
    const nextDraft = { ...draft };
    emitSettingsPreview(nextDraft);
    setTheme(nextDraft.theme);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextDraft),
    });
    if (!response.ok) {
      setPreviewNotice({
        title: "Pengaturan gagal disimpan",
        copy: "Preview masih aktif di browser ini, tetapi perubahan belum tersimpan ke database.",
        tone: "warning",
      });
      setSaving(false);
      return;
    }
    const payload = (await response.json()) as SettingsPayload;
    setData(payload);
    setDraft(toDraft(payload));
    emitSettingsPreview(toDraft(payload));
    setPreviewNotice({
      title: "Pengaturan tersimpan",
      copy: "Semua perubahan sudah dipersist ke database dan akan tetap sama setelah refresh atau login ulang.",
      tone: "success",
    });
    router.refresh();
    setSaving(false);
  }

  async function inviteUser() {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { user: SettingsPayload["users"][number] };
    setData((current) => (current ? { ...current, users: [...current.users, payload.user] } : current));
    setInviteForm({ name: "", email: "", role: "operator", station: "SOQ" });
    setPreviewNotice({
      title: "User berhasil diundang",
      copy: "Akun baru sudah ditambahkan ke daftar user dan siap dikelola per role.",
      tone: "success",
    });
    setShowInviteForm(false);
  }

  async function updateUser(userId: string, patch: Partial<SettingsPayload["users"][number]>) {
    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { user: SettingsPayload["users"][number] };
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((user) => (user.id === payload.user.id ? payload.user : user)),
          }
        : current,
    );
    return payload.user;
  }

  function startEditingUser(user: SettingsPayload["users"][number]) {
    setEditingUserId(user.id);
    setEditingUserDraft({
      role: user.role,
      status: user.status,
      station: user.station,
    });
  }

  async function saveEditingUser() {
    if (!editingUserId || !editingUserDraft) return;
    const updatedUser = await updateUser(editingUserId, editingUserDraft);
    if (!updatedUser) return;
    setEditingUserId(null);
    setEditingUserDraft(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Kelola profil, role, notifikasi, tampilan, dan preferensi sidebar secara persisten agar pengalaman operator tetap stabil lintas sesi."
        actions={
          <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        }
      />

      <div className="settings-layout grid gap-6 xl:grid-cols-[268px_minmax(0,1fr)]">
        <OpsPanel className="settings-tab-rail p-4">
          <div className="space-y-3">
            {tabGroups.map((group) => (
              <div key={group.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-[18px] px-2 py-2 text-left text-[color:var(--text-strong)]"
                  onClick={() => setOpenGroupId(group.id)}
                >
                  <span>
                    <span className="block text-sm font-semibold">{group.label}</span>
                    <span className="block text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                      {group.items.length} submenu
                    </span>
                  </span>
                  <ChevronRight size={16} className={cn("transition-transform", openGroupId === group.id && "rotate-90")} />
                </button>

                {openGroupId === group.id ? (
                  <div className="mt-2 space-y-1">
                    {group.items.map((label) => {
                      const tab = tabs.find((entry) => entry.label === label)!;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.label}
                          type="button"
                          className={cn(
                            "sidebar-link w-full justify-between px-4",
                            activeTab === tab.label && "sidebar-link-active",
                          )}
                          onClick={() => {
                            setOpenGroupId(group.id);
                            setActiveTab(tab.label);
                            setPreviewNotice(null);
                          }}
                        >
                          <span className="flex items-center gap-3">
                            <Icon size={18} />
                            <span>{tab.label}</span>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </OpsPanel>

        <div className="settings-content-scroll space-y-6">
          {activeTab === "Profile" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-[2rem] font-[family:var(--font-heading)] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Profile
                </h2>
                <p className="mt-1 text-base text-[color:var(--muted-fg)]">Informasi akun operator</p>
              </div>

              <OpsPanel className="p-5">
                <SectionHeader title="Profil Operator" subtitle="Informasi akun dan identitas operator aktif" />

                <div className="mt-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.04em] text-white">
                      {getInitials(draft.name || data?.profile.name || "Sky Hub")}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                        {draft.name || data?.profile.name || "-"}
                      </p>
                      <p className="truncate text-base text-[color:var(--muted-fg)]">{data?.profile.email ?? "-"}</p>
                      {data?.profile.role ? (
                        <span
                          className={cn(
                            "inline-flex w-fit rounded-xl px-3 py-1 text-sm font-semibold",
                            rolePillClasses[data.profile.role],
                          )}
                        >
                          {ROLE_LABELS[data.profile.role]}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <div>
                      <label className="label">Nama Lengkap</label>
                      <input
                        className="input-field"
                        value={draft.name}
                        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="label">Email</label>
                      <input className="input-field" value={data?.profile.email ?? ""} readOnly />
                    </div>

                    <div>
                      <label className="label">Stasiun</label>
                      <select
                        className="select-field"
                        value={draft.station}
                        onChange={(event) => setDraft((current) => ({ ...current, station: event.target.value }))}
                      >
                        {stationOptions.map((station) => (
                          <option key={station} value={station}>
                            {station}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </OpsPanel>
            </div>
          ) : null}

          {activeTab === "User & Role" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-[2rem] font-[family:var(--font-heading)] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  User &amp; Role
                </h2>
                <p className="mt-1 text-base text-[color:var(--muted-fg)]">Tim, undangan, hak akses</p>
              </div>

              <OpsPanel className="p-5">
                <SectionHeader
                  title="Anggota Tim"
                  subtitle="Operator aktif dan penempatan stasiun"
                  action={
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowInviteForm((current) => !current)}
                    >
                      <Plus size={16} />
                      {showInviteForm ? "Tutup" : "Undang User"}
                    </button>
                  }
                />

                {showInviteForm ? (
                  <div className="mt-5 grid gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 lg:grid-cols-[1.1fr_1.5fr_0.9fr_0.8fr_auto]">
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
                      onChange={(event) =>
                        setInviteForm((current) => ({
                          ...current,
                          role: event.target.value as SettingsPayload["users"][number]["role"],
                        }))
                      }
                    >
                      <option value="operator">Operator</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                      <option value="customer">Customer</option>
                    </select>
                    <select
                      className="select-field"
                      value={inviteForm.station}
                      onChange={(event) => setInviteForm((current) => ({ ...current, station: event.target.value }))}
                    >
                      {stationOptions.map((station) => (
                        <option key={station} value={station}>
                          {station}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-primary" onClick={inviteUser}>
                      <Plus size={16} />
                      Kirim
                    </button>
                  </div>
                ) : null}

                <div className="mt-5 overflow-hidden rounded-[24px] border border-[color:var(--border-soft)]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Stasiun</th>
                        <th>Status</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.users ?? []).map((user) => {
                        const isEditing = editingUserId === user.id && editingUserDraft;

                        return (
                          <tr key={user.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary-soft)] text-sm font-bold text-[color:var(--brand-primary)]">
                                  {getInitials(user.name)}
                                </div>
                                <p className="font-semibold text-[color:var(--text-strong)]">{user.name}</p>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={editingUserDraft.role}
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
                                  <option value="operator">Operator</option>
                                  <option value="supervisor">Supervisor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span className="font-medium text-[color:var(--text-strong)]">{ROLE_LABELS[user.role]}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="select-field h-10"
                                  value={editingUserDraft.station}
                                  onChange={(event) =>
                                    setEditingUserDraft((current) =>
                                      current ? { ...current, station: event.target.value } : current,
                                    )
                                  }
                                >
                                  {stationOptions.map((station) => (
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
                                  <option value="active">Active</option>
                                  <option value="invited">Invited</option>
                                  <option value="disabled">Disabled</option>
                                </select>
                              ) : (
                                <StatusBadge value={user.status} label={userStatusLabels[user.status]} className="normal-case tracking-normal" />
                              )}
                            </td>
                            <td className="text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <button type="button" className="btn btn-primary h-10 px-4" onClick={saveEditingUser}>
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
                                  onClick={() => startEditingUser(user)}
                                >
                                  <PencilLine size={15} />
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

              <OpsPanel className="p-5">
                <SectionHeader title="Definisi Role" subtitle="Hak akses untuk setiap role" />
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {roleDefinitionCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4"
                    >
                      <h3 className="font-[family:var(--font-heading)] text-[1.25rem] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-base leading-7 text-[color:var(--muted-fg)]">{card.copy}</p>
                    </div>
                  ))}
                </div>
              </OpsPanel>
            </div>
          ) : null}

          {activeTab === "Notifications" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-[2rem] font-[family:var(--font-heading)] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Notifications
                </h2>
                <p className="mt-1 text-base text-[color:var(--muted-fg)]">Alert, bunyi, dan preview notifikasi</p>
              </div>

              <OpsPanel className="p-5">
                <SectionHeader title="Notifications" subtitle="Pilih alert yang penting untuk operator control room dan supervisor." />
                <div className="mt-5 space-y-4">
                  {[
                    ["cutoffAlert", "Cutoff alerts", "Peringatan saat cutoff penerbangan sudah dekat."],
                    ["exceptionAlert", "Exception alerts", "Peringatan untuk shipment hold atau data bermasalah."],
                    ["soundAlert", "Sound alerts", "Aktifkan bunyi notifikasi di control room."],
                    ["emailDigest", "Email digest", "Ringkasan harian untuk supervisor atau admin."],
                  ].map(([key, title, copy]) => (
                    <PreferenceToggleCard
                      key={key}
                      title={title}
                      copy={copy}
                      checked={Boolean(draft[key as keyof typeof draft])}
                      onChange={async (checked) => {
                        applyDraftPatch(
                          { [key]: checked } as Partial<SettingsDraft>,
                          {
                            title: `${title} ${checked ? "diaktifkan" : "dimatikan"}`,
                            copy:
                              key === "soundAlert" && checked
                                ? "Preview suara akan diputar agar Anda langsung tahu toggle ini aktif."
                                : "Perubahan ini sudah aktif sebagai preview di browser saat ini.",
                            tone: checked ? "success" : "info",
                          },
                        );

                        if (key === "soundAlert" && checked) {
                          await playAlertTone("sound");
                        }
                      }}
                    />
                  ))}
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <div className="border-b border-[color:var(--border-soft)] pb-4">
                      <h3 className="font-[family:var(--font-heading)] text-[1.25rem] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                        Test Center
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">
                        Jalankan preview supaya operator langsung bisa melihat efek setiap toggle.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        className="btn btn-secondary justify-start"
                        disabled={!draft.cutoffAlert}
                        onClick={() => void triggerNotificationPreview("cutoff")}
                      >
                        <TriangleAlert size={16} />
                        Tes cutoff alert
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary justify-start"
                        disabled={!draft.exceptionAlert}
                        onClick={() => void triggerNotificationPreview("exception")}
                      >
                        <BellRing size={16} />
                        Tes exception alert
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary justify-start"
                        disabled={!draft.soundAlert}
                        onClick={() => void triggerNotificationPreview("sound")}
                      >
                        <Volume2 size={16} />
                        Tes bunyi alarm
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary justify-start"
                        disabled={!draft.emailDigest}
                        onClick={() => void triggerNotificationPreview("email")}
                      >
                        <Mail size={16} />
                        Tes email digest
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <div className="border-b border-[color:var(--border-soft)] pb-4">
                      <h3 className="font-[family:var(--font-heading)] text-[1.25rem] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                        Live Status
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">
                        Ringkasan preview terakhir dari settings.
                      </p>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={draft.soundAlert ? "success" : "disabled"} label={draft.soundAlert ? "Sound on" : "Sound off"} className="normal-case tracking-normal" />
                        <StatusBadge value={draft.cutoffAlert ? "warning" : "disabled"} label={draft.cutoffAlert ? "Cutoff on" : "Cutoff off"} className="normal-case tracking-normal" />
                        <StatusBadge value={draft.exceptionAlert ? "error" : "disabled"} label={draft.exceptionAlert ? "Exception on" : "Exception off"} className="normal-case tracking-normal" />
                      </div>

                      <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4">
                        {previewNotice ? (
                          <>
                            <StatusBadge value={previewNotice.tone} label={previewNotice.title} className="normal-case tracking-normal" />
                            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">{previewNotice.copy}</p>
                          </>
                        ) : (
                          <p className="text-sm leading-7 text-[color:var(--muted-fg)]">
                            Belum ada preview. Jalankan salah satu tombol tes untuk melihat dampak notifikasi, suara, atau email digest.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </OpsPanel>
            </div>
          ) : null}

          {activeTab === "Display Preferences" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-[2rem] font-[family:var(--font-heading)] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Display Preferences
                </h2>
                <p className="mt-1 text-base text-[color:var(--muted-fg)]">Preview tema dan ritme refresh secara langsung</p>
              </div>

              <OpsPanel className="p-5">
                <SectionHeader title="Display Preferences" subtitle="Atur mode tampilan utama tanpa mengubah perilaku backend atau data." />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Theme</label>
                    <select
                      className="select-field"
                      value={draft.theme}
                      onChange={(event) =>
                        applyDraftPatch(
                          { theme: event.target.value as "light" | "dark" },
                          {
                            title: `Mode ${event.target.value === "dark" ? "gelap" : "terang"} aktif`,
                            copy: "Theme sekarang dipreview langsung di seluruh shell tanpa perlu menunggu tombol simpan.",
                            tone: "success",
                          },
                        )
                      }
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Refresh Interval (detik)</label>
                    <input
                      className="input-field"
                      type="number"
                      min={5}
                      max={60}
                      value={draft.refreshIntervalSeconds}
                      onChange={(event) => {
                        const nextValue = clampRefreshInterval(Number(event.target.value));
                        applyDraftPatch(
                          { refreshIntervalSeconds: nextValue },
                          {
                            title: "Interval refresh diperbarui",
                            copy: `Jika auto-refresh aktif, dashboard akan memakai interval ${nextValue} detik.`,
                            tone: "info",
                          },
                        );
                      }}
                      disabled={!draft.autoRefresh}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <PreferenceToggleCard
                    title="Compact row mode"
                    copy="Menghemat ruang untuk operator dengan banyak tabel."
                    checked={draft.compactRows}
                    onChange={(checked) =>
                      applyDraftPatch(
                        { compactRows: checked },
                        {
                          title: checked ? "Compact mode aktif" : "Compact mode dimatikan",
                          copy: "Shell langsung menyesuaikan density tabel agar efeknya bisa dilihat saat itu juga.",
                          tone: checked ? "success" : "info",
                        },
                      )
                    }
                  />
                  <PreferenceToggleCard
                    title="Auto-refresh"
                    copy="Refresh data otomatis untuk ritme kargo udara yang cepat."
                    checked={draft.autoRefresh}
                    onChange={(checked) =>
                      applyDraftPatch(
                        { autoRefresh: checked },
                        {
                          title: checked ? "Auto-refresh aktif" : "Auto-refresh dimatikan",
                          copy: checked
                            ? `Dashboard akan memakai interval ${draft.refreshIntervalSeconds} detik.`
                            : "Polling otomatis dihentikan, operator harus memakai tombol refresh manual.",
                          tone: checked ? "success" : "warning",
                        },
                      )
                    }
                  />
                </div>
                <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={draft.theme === "dark" ? "info" : "success"} label={`Theme ${draft.theme}`} className="normal-case tracking-normal" />
                    <StatusBadge value={draft.compactRows ? "success" : "disabled"} label={draft.compactRows ? "Compact on" : "Compact off"} className="normal-case tracking-normal" />
                    <StatusBadge value={draft.autoRefresh ? "warning" : "disabled"} label={draft.autoRefresh ? `Auto ${draft.refreshIntervalSeconds}s` : "Auto refresh off"} className="normal-case tracking-normal" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
                    Mode tema, compact rows, dan interval refresh sekarang dipreview langsung. Klik <span className="font-semibold text-[color:var(--text-strong)]">Simpan</span> agar tetap tersimpan setelah refresh.
                  </p>
                </div>
              </OpsPanel>
            </div>
          ) : null}

          {activeTab === "Sidebar Preferences" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-[2rem] font-[family:var(--font-heading)] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Sidebar Preferences
                </h2>
                <p className="mt-1 text-base text-[color:var(--muted-fg)]">Preview perilaku navigasi utama</p>
              </div>

              <OpsPanel className="p-5">
                <SectionHeader title="Sidebar Preferences" subtitle="Kontrol perilaku shell agar nyaman dipakai pada layar lebar maupun sempit." />
                <div className="mt-5">
                  <PreferenceToggleCard
                    title="Default collapsed sidebar"
                    copy="Aktifkan mode collapse sebagai default untuk layar yang lebih sempit."
                    checked={draft.sidebarCollapsed}
                    onChange={(checked) =>
                      applyDraftPatch(
                        { sidebarCollapsed: checked },
                        {
                          title: checked ? "Sidebar collapse aktif" : "Sidebar expanded aktif",
                          copy: "Shell kiri langsung berubah agar operator bisa menilai apakah navigasi ini nyaman dipakai.",
                          tone: checked ? "success" : "info",
                        },
                      )
                    }
                  />
                </div>
              </OpsPanel>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
