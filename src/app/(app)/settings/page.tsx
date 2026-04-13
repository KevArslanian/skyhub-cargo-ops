"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BellRing, ChevronRight, Monitor, PanelLeftOpen, Plus, UserCircle2, Users2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

type SettingsPayload = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "supervisor";
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
    role: "admin" | "operator" | "supervisor";
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

export default function SettingsPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["label"]>("Profile");
  const [saving, setSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "operator", station: "SOQ" });
  const [draft, setDraft] = useState(() => toDraft(null));
  const [openGroupId, setOpenGroupId] = useState<(typeof tabGroups)[number]["id"]>("account");

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: SettingsPayload) => {
        setData(payload);
        setDraft(toDraft(payload));
      })
      .catch(() => undefined);
  }, []);

  async function saveSettings() {
    setSaving(true);
    const nextDraft = { ...draft };
    setTheme(nextDraft.theme);
    window.dispatchEvent(new CustomEvent("skyhub:theme-change", { detail: nextDraft.theme }));
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextDraft),
    });
    if (!response.ok) {
      setSaving(false);
      return;
    }
    const payload = (await response.json()) as SettingsPayload;
    setData(payload);
    setDraft(toDraft(payload));
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
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Kelola profil, role, notifikasi, tampilan, dan preferensi sidebar secara persisten agar pengalaman operator tetap stabil lintas sesi."
        actions={
          <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? "Menyimpan..." : "Save Changes"}
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <OpsPanel className="p-4">
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

        <div className="space-y-6">
          {activeTab === "Profile" ? (
            <OpsPanel className="p-5">
              <SectionHeader title="Profile" subtitle="Data profil operator yang dipakai di shell dan settings." />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Nama</label>
                  <input className="input-field" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Station</label>
                  <input className="input-field" value={draft.station} onChange={(event) => setDraft((current) => ({ ...current, station: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input-field" value={data?.profile.email ?? ""} disabled />
                </div>
                <div>
                  <label className="label">Role</label>
                  <input className="input-field" value={data ? ROLE_LABELS[data.profile.role] : ""} disabled />
                </div>
              </div>
            </OpsPanel>
          ) : null}

          {activeTab === "User & Role" ? (
            <div className="space-y-6">
              <OpsPanel className="p-5">
                <SectionHeader title="Invite User" subtitle="Tambah operator, supervisor, atau admin baru ke sistem." />
                <div className="mt-5 grid gap-4 lg:grid-cols-5">
                  <input className="input-field lg:col-span-1" placeholder="Nama" value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} />
                  <input className="input-field lg:col-span-2" placeholder="Email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} />
                  <select className="select-field" value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="operator">Operator</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="flex gap-3">
                    <input className="input-field" placeholder="Station" value={inviteForm.station} onChange={(event) => setInviteForm((current) => ({ ...current, station: event.target.value }))} />
                    <button type="button" className="btn btn-primary" onClick={inviteUser}>
                      <Plus size={16} />
                      Invite
                    </button>
                  </div>
                </div>
              </OpsPanel>

              <OpsPanel className="p-5">
                <SectionHeader title="User Access" subtitle="Ubah role, status, dan station user yang sudah terdaftar." />
                <div className="mt-5 table-shell">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Station</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.users ?? []).map((user) => (
                        <tr key={user.id}>
                          <td className="font-semibold text-[color:var(--text-strong)]">{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            <select className="select-field h-10" value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as SettingsPayload["users"][number]["role"] })}>
                              <option value="operator">Operator</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="space-y-2">
                            <StatusBadge value={user.status} label={user.status} />
                            <select className="select-field h-10" value={user.status} onChange={(event) => updateUser(user.id, { status: event.target.value as SettingsPayload["users"][number]["status"] })}>
                              <option value="active">Active</option>
                              <option value="invited">Invited</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </td>
                          <td>
                            <input className="input-field h-10" value={user.station} onChange={(event) => updateUser(user.id, { station: event.target.value })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </OpsPanel>
            </div>
          ) : null}

          {activeTab === "Notifications" ? (
            <OpsPanel className="p-5">
              <SectionHeader title="Notifications" subtitle="Pilih alert yang penting untuk operator control room dan supervisor." />
              <div className="mt-5 space-y-4">
                {[
                  ["cutoffAlert", "Cutoff alerts", "Peringatan saat cutoff penerbangan sudah dekat."],
                  ["exceptionAlert", "Exception alerts", "Peringatan untuk shipment hold atau data bermasalah."],
                  ["soundAlert", "Sound alerts", "Aktifkan bunyi notifikasi di control room."],
                  ["emailDigest", "Email digest", "Ringkasan harian untuk supervisor atau admin."],
                ].map(([key, title, copy]) => (
                  <label key={key} className="flex items-center justify-between gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">{title}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{copy}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(draft[key as keyof typeof draft])}
                      onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                  </label>
                ))}
              </div>
            </OpsPanel>
          ) : null}

          {activeTab === "Display Preferences" ? (
            <OpsPanel className="p-5">
              <SectionHeader title="Display Preferences" subtitle="Atur mode tampilan utama tanpa mengubah perilaku backend atau data." />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Theme</label>
                  <select className="select-field" value={draft.theme} onChange={(event) => setDraft((current) => ({ ...current, theme: event.target.value as "light" | "dark" }))}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div>
                  <label className="label">Refresh Interval (detik)</label>
                  <input className="input-field" type="number" min={5} max={60} value={draft.refreshIntervalSeconds} onChange={(event) => setDraft((current) => ({ ...current, refreshIntervalSeconds: Number(event.target.value) }))} />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">Compact row mode</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Menghemat ruang untuk operator dengan banyak tabel.</p>
                    </div>
                    <input type="checkbox" checked={draft.compactRows} onChange={(event) => setDraft((current) => ({ ...current, compactRows: event.target.checked }))} />
                  </div>
                </label>
                <label className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">Auto-refresh</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Refresh data otomatis untuk ritme kargo udara yang cepat.</p>
                    </div>
                    <input type="checkbox" checked={draft.autoRefresh} onChange={(event) => setDraft((current) => ({ ...current, autoRefresh: event.target.checked }))} />
                  </div>
                </label>
              </div>
            </OpsPanel>
          ) : null}

          {activeTab === "Sidebar Preferences" ? (
            <OpsPanel className="p-5">
              <SectionHeader title="Sidebar Preferences" subtitle="Kontrol perilaku shell agar nyaman dipakai pada layar lebar maupun sempit." />
              <div className="mt-5">
                <label className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">Default collapsed sidebar</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Aktifkan mode collapse sebagai default untuk layar yang lebih sempit.</p>
                    </div>
                    <input type="checkbox" checked={draft.sidebarCollapsed} onChange={(event) => setDraft((current) => ({ ...current, sidebarCollapsed: event.target.checked }))} />
                  </div>
                </label>
              </div>
            </OpsPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
