"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Monitor, Plus, ShieldCheck, UserCircle2, Users2, X } from "lucide-react";
import {
  CUSTOMER_ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  STATION_OPTIONS,
  USER_STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

type SettingsPayload = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "supervisor" | "customer";
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
    role: "admin" | "operator" | "supervisor" | "customer";
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

function PreferenceToggle({
  title,
  copy,
  checked,
  onChange,
}: {
  title: string;
  copy: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-[color:var(--text-strong)]">{title}</p>
        <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{copy}</p>
      </div>
      <span className="relative inline-flex shrink-0 items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="h-7 w-12 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] transition-colors peer-checked:border-[color:var(--brand-primary)] peer-checked:bg-[color:var(--brand-primary)]" />
        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const { setTheme } = useTheme();
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
    role: "operator",
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
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountDraft, setEditingAccountDraft] = useState<SettingsPayload["customerAccounts"][number] | null>(null);

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

  const tabs = useMemo(() => {
    const items = [
      { label: "Profil", icon: UserCircle2 },
      { label: "Preferensi", icon: Monitor },
    ];

    if (data?.permissions.canManageUsers) {
      items.splice(1, 0, { label: "Tim & Akses", icon: Users2 });
    }

    if (data?.permissions.canManageCustomerAccounts) {
      items.splice(items.length - 1, 0, { label: "Akun Pelanggan", icon: Building2 });
    }

    return items;
  }, [data?.permissions.canManageCustomerAccounts, data?.permissions.canManageUsers]);

  function emitSettingsPreview(patch: Partial<SettingsDraft>) {
    window.dispatchEvent(new CustomEvent("skyhub:settings-preview", { detail: patch }));
    if (patch.theme) {
      window.dispatchEvent(new CustomEvent("skyhub:theme-change", { detail: patch.theme }));
      setTheme(patch.theme);
    }
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
      setInviteForm({ name: "", email: "", role: "operator", station: "SOQ", customerAccountId: "" });
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
        customerAccountId: editingUserDraft.role === "customer" ? editingUserDraft.customerAccountId : null,
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

  async function createCustomerAccountEntry() {
    const response = await fetch("/api/customer-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    });

    if (response.ok) {
      const payload = (await response.json()) as { customerAccount: SettingsPayload["customerAccounts"][number] };
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
      const payload = (await response.json()) as { customerAccount: SettingsPayload["customerAccounts"][number] };
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
        subtitle="Kelola profil, preferensi tampilan, pengguna, dan akun pelanggan dari satu workspace yang stabil."
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

      <div className="grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
        <OpsPanel className="page-pane p-4">
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  type="button"
                  className={cn("sidebar-link w-full justify-between px-4", activeTab === tab.label && "sidebar-link-active")}
                  onClick={() => setActiveTab(tab.label)}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </OpsPanel>

        <div className="page-stack">
          {activeTab === "Profil" ? (
            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Profil Pengguna" subtitle="Informasi akun aktif dan linkage role saat ini." />
              <div className="mt-6 flex flex-col gap-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.04em] text-white">
                    {getInitials(draft.name || data?.profile.name || "Sky Hub")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                      {draft.name || data?.profile.name || "-"}
                    </p>
                    <p className="truncate text-base text-[color:var(--muted-fg)]">{data?.profile.email ?? "-"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data?.profile.role ? <StatusBadge value="info" label={ROLE_LABELS[data.profile.role]} /> : null}
                      {data?.profile.customerAccountName ? <StatusBadge value="success" label={data.profile.customerAccountName} className="normal-case tracking-normal" /> : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div>
                    <label className="label">Nama Lengkap</label>
                    <input className="input-field" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input-field" value={data?.profile.email ?? ""} readOnly />
                  </div>
                  <div>
                    <label className="label">Stasiun</label>
                    <select className="select-field" value={draft.station} onChange={(event) => setDraft((current) => ({ ...current, station: event.target.value }))}>
                      {STATION_OPTIONS.map((station) => (
                        <option key={station} value={station}>
                          {station}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </OpsPanel>
          ) : null}

          {activeTab === "Tim & Akses" && data && data.permissions.canManageUsers ? (
            <OpsPanel className="page-pane p-5">
              <SectionHeader
                title="Tim & Akses"
                subtitle="Admin dapat membuat pengguna baru, mengubah peran, status, stasiun, dan linkage akun pelanggan."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => setInviteOpen((current) => !current)}>
                    <Plus size={16} />
                    {inviteOpen ? "Tutup" : "Tambah Pengguna"}
                  </button>
                }
              />

              {inviteOpen ? (
                <div className="mt-5 grid gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 lg:grid-cols-[1fr_1.2fr_0.9fr_0.9fr_1fr_auto]">
                  <input className="input-field" placeholder="Nama" value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} />
                  <input className="input-field" placeholder="Email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} />
                  <select className="select-field" value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="operator">Operator</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                    <option value="customer">Pelanggan</option>
                  </select>
                  <select className="select-field" value={inviteForm.station} onChange={(event) => setInviteForm((current) => ({ ...current, station: event.target.value }))}>
                    {STATION_OPTIONS.map((station) => (
                      <option key={station} value={station}>
                        {station}
                      </option>
                    ))}
                  </select>
                  <select className="select-field" value={inviteForm.customerAccountId} onChange={(event) => setInviteForm((current) => ({ ...current, customerAccountId: event.target.value }))} disabled={inviteForm.role !== "customer"}>
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
              ) : null}

              <div className="page-scroll mt-5 overflow-hidden rounded-[24px] border border-[color:var(--border-soft)]">
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
                              <select className="select-field h-10" value={userRowDraft?.role ?? user.role} onChange={(event) => setEditingUserDraft((current) => current ? { ...current, role: event.target.value as SettingsPayload["users"][number]["role"] } : current)}>
                                <option value="operator">Operator</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="admin">Admin</option>
                                <option value="customer">Pelanggan</option>
                              </select>
                            ) : (
                              <span className="font-medium text-[color:var(--text-strong)]">{ROLE_LABELS[user.role]}</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select className="select-field h-10" value={userRowDraft?.station ?? user.station} onChange={(event) => setEditingUserDraft((current) => current ? { ...current, station: event.target.value } : current)}>
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
                              <select className="select-field h-10" value={userRowDraft?.customerAccountId || ""} onChange={(event) => setEditingUserDraft((current) => current ? { ...current, customerAccountId: event.target.value || null } : current)} disabled={userRowDraft?.role !== "customer"}>
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
                              <select className="select-field h-10" value={userRowDraft?.status ?? user.status} onChange={(event) => setEditingUserDraft((current) => current ? { ...current, status: event.target.value as SettingsPayload["users"][number]["status"] } : current)}>
                                <option value="active">Aktif</option>
                                <option value="invited">Diundang</option>
                                <option value="disabled">Nonaktif</option>
                              </select>
                            ) : (
                              <StatusBadge value={user.status} label={USER_STATUS_LABELS[user.status]} />
                            )}
                          </td>
                          <td className="text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button type="button" className="btn btn-primary h-10 px-4" onClick={saveUser}>
                                  <Check size={15} />
                                  Simpan
                                </button>
                                <button type="button" className="btn btn-secondary h-10 px-4" onClick={() => { setEditingUserId(null); setEditingUserDraft(null); }}>
                                  <X size={15} />
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button type="button" className="btn btn-secondary h-10 px-4" onClick={() => { setEditingUserId(user.id); setEditingUserDraft(user); }}>
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

          {activeTab === "Akun Pelanggan" && data && data.permissions.canManageCustomerAccounts ? (
            <OpsPanel className="page-pane p-5">
              <SectionHeader
                title="Akun Pelanggan"
                subtitle="Admin dapat membuat, memperbarui, dan menonaktifkan akun pelanggan."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => setCustomerAccountOpen((current) => !current)}>
                    <Plus size={16} />
                    {customerAccountOpen ? "Tutup" : "Tambah Akun"}
                  </button>
                }
              />

              {customerAccountOpen ? (
                <div className="mt-5 grid gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 lg:grid-cols-[0.7fr_1.2fr_1fr_1fr_1fr_auto]">
                  <input className="input-field" placeholder="Kode" value={accountForm.code} onChange={(event) => setAccountForm((current) => ({ ...current, code: event.target.value }))} />
                  <input className="input-field" placeholder="Nama akun" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} />
                  <input className="input-field" placeholder="PIC" value={accountForm.contactName} onChange={(event) => setAccountForm((current) => ({ ...current, contactName: event.target.value }))} />
                  <input className="input-field" placeholder="Email kontak" value={accountForm.contactEmail} onChange={(event) => setAccountForm((current) => ({ ...current, contactEmail: event.target.value }))} />
                  <input className="input-field" placeholder="Telepon" value={accountForm.contactPhone} onChange={(event) => setAccountForm((current) => ({ ...current, contactPhone: event.target.value }))} />
                  <button type="button" className="btn btn-primary" onClick={createCustomerAccountEntry}>
                    <Plus size={16} />
                    Simpan
                  </button>
                </div>
              ) : null}

              <div className="page-scroll mt-5 overflow-hidden rounded-[24px] border border-[color:var(--border-soft)]">
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
                          <td>{isEditing ? <input className="input-field h-10" value={accountRowDraft?.code ?? account.code} onChange={(event) => setEditingAccountDraft((current) => current ? { ...current, code: event.target.value } : current)} /> : <span className="font-semibold text-[color:var(--brand-primary)]">{account.code}</span>}</td>
                          <td>{isEditing ? <input className="input-field h-10" value={accountRowDraft?.name ?? account.name} onChange={(event) => setEditingAccountDraft((current) => current ? { ...current, name: event.target.value } : current)} /> : account.name}</td>
                          <td>{isEditing ? <input className="input-field h-10" value={accountRowDraft?.contactName || ""} onChange={(event) => setEditingAccountDraft((current) => current ? { ...current, contactName: event.target.value } : current)} /> : account.contactName || "-"}</td>
                          <td>{isEditing ? <input className="input-field h-10" value={accountRowDraft?.contactEmail || ""} onChange={(event) => setEditingAccountDraft((current) => current ? { ...current, contactEmail: event.target.value } : current)} /> : account.contactEmail || "-"}</td>
                          <td>{isEditing ? <input className="input-field h-10" value={accountRowDraft?.contactPhone || ""} onChange={(event) => setEditingAccountDraft((current) => current ? { ...current, contactPhone: event.target.value } : current)} /> : account.contactPhone || "-"}</td>
                          <td>
                            {isEditing ? (
                              <select className="select-field h-10" value={accountRowDraft?.status ?? account.status} onChange={(event) => setEditingAccountDraft((current) => current ? { ...current, status: event.target.value as SettingsPayload["customerAccounts"][number]["status"] } : current)}>
                                <option value="active">Aktif</option>
                                <option value="disabled">Nonaktif</option>
                              </select>
                            ) : (
                              <StatusBadge value={account.status} label={CUSTOMER_ACCOUNT_STATUS_LABELS[account.status]} />
                            )}
                          </td>
                          <td className="text-sm text-[color:var(--muted-fg)]">{account.userCount} pengguna • {account.shipmentCount} shipment</td>
                          <td className="text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button type="button" className="btn btn-primary h-10 px-4" onClick={saveCustomerAccount}>
                                  <Check size={15} />
                                  Simpan
                                </button>
                                <button type="button" className="btn btn-secondary h-10 px-4" onClick={() => { setEditingAccountId(null); setEditingAccountDraft(null); }}>
                                  <X size={15} />
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button type="button" className="btn btn-secondary h-10 px-4" onClick={() => { setEditingAccountId(account.id); setEditingAccountDraft(account); }}>
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

          {activeTab === "Preferensi" ? (
            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Preferensi Tampilan & Notifikasi" subtitle="Semua perubahan tersimpan ke database dan diterapkan ke shell aplikasi." />
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <label className="label">Tema</label>
                    <div className="flex gap-3">
                      <button type="button" className={cn("ops-tab-button", draft.theme === "light" && "ops-tab-button-active")} onClick={() => applyDraftPatch({ theme: "light" })}>
                        Terang
                      </button>
                      <button type="button" className={cn("ops-tab-button", draft.theme === "dark" && "ops-tab-button-active")} onClick={() => applyDraftPatch({ theme: "dark" })}>
                        Gelap
                      </button>
                    </div>
                  </div>

                  <PreferenceToggle title="Baris ringkas" copy="Rapatkan tinggi baris tabel untuk meningkatkan densitas data." checked={draft.compactRows} onChange={(value) => applyDraftPatch({ compactRows: value })} />
                  <PreferenceToggle title="Sidebar terlipat" copy="Simpan preferensi sidebar dalam keadaan terlipat." checked={draft.sidebarCollapsed} onChange={(value) => applyDraftPatch({ sidebarCollapsed: value })} />
                  <PreferenceToggle title="Penyegaran otomatis" copy="Segarkan dashboard dan panel monitoring secara otomatis." checked={draft.autoRefresh} onChange={(value) => applyDraftPatch({ autoRefresh: value })} />

                  <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                    <label className="label">Interval Penyegaran Otomatis</label>
                    <input type="number" min={5} max={60} className="input-field" value={draft.refreshIntervalSeconds} onChange={(event) => applyDraftPatch({ refreshIntervalSeconds: Number(event.target.value) })} />
                  </div>
                </div>

                <div className="space-y-4">
                  <PreferenceToggle title="Cutoff alerts" copy="Peringatan saat cutoff flight mendekat." checked={draft.cutoffAlert} onChange={(value) => applyDraftPatch({ cutoffAlert: value })} />
                  <PreferenceToggle title="Exception alerts" copy="Peringatan untuk shipment tertahan atau data bermasalah." checked={draft.exceptionAlert} onChange={(value) => applyDraftPatch({ exceptionAlert: value })} />
                  <PreferenceToggle title="Sound alerts" copy="Aktifkan bunyi notifikasi pada ruang kontrol." checked={draft.soundAlert} onChange={(value) => applyDraftPatch({ soundAlert: value })} />
                  <PreferenceToggle title="Email digest" copy="Ringkasan harian untuk peran yang membutuhkannya." checked={draft.emailDigest} onChange={(value) => applyDraftPatch({ emailDigest: value })} />
                </div>
              </div>
            </OpsPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
