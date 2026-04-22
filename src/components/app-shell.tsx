"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  FileBarChart2,
  History,
  LayoutDashboard,
  Menu,
  MoonStar,
  PackageSearch,
  PlaneTakeoff,
  Radar,
  Search,
  Settings2,
  SunMedium,
  UserCircle2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { getNavigationForRole } from "@/lib/access";
import { APP_NAME, APP_SUBTITLE, ROLE_LABELS } from "@/lib/constants";
import { cn, formatDateTime, formatRelativeShort } from "@/lib/format";
import { BrandMark } from "./brand-mark";
import { StatusBadge } from "./status-badge";

type ShellProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "staff" | "customer";
    station: string;
    customerAccountName?: string | null;
  };
  settings: {
    theme: string;
    compactRows: boolean;
    sidebarCollapsed: boolean;
    autoRefresh: boolean;
    refreshIntervalSeconds: number;
    cutoffAlert: boolean;
    exceptionAlert: boolean;
    soundAlert: boolean;
    emailDigest: boolean;
  };
  notifications: {
    id: string;
    title: string;
    message: string;
    href: string | null;
    type: string;
    read: boolean;
    createdAt: string;
  }[];
  children: React.ReactNode;
};

const navIconMap = {
  "/dashboard": LayoutDashboard,
  "/shipment-ledger": PackageSearch,
  "/awb-tracking": Radar,
  "/flight-board": PlaneTakeoff,
  "/activity-log": History,
  "/reports": FileBarChart2,
  "/settings": Settings2,
} as const;

const navGroupIconMap = {
  operasional: FolderKanban,
  pemantauan: PlaneTakeoff,
  sistem: Settings2,
} as const;

export function AppShell({ user, settings, notifications, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const navigation = getNavigationForRole(user.role);
  const [search, setSearch] = useState("");
  const [shellSettings, setShellSettings] = useState(settings);
  const [collapsed, setCollapsed] = useState(settings.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState(notifications);
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const themePreference = shellSettings.theme === "dark" ? "dark" : "light";
  const activeTheme = mounted ? (resolvedTheme === "dark" ? "dark" : "light") : themePreference;
  const sidebarWidth = collapsed ? "88px" : "min(284px, 24vw)";
  const shellStyle = {
    "--sidebar-width": sidebarWidth,
  } as CSSProperties;

  const unreadCount = useMemo(() => notificationItems.filter((item) => !item.read).length, [notificationItems]);

  const activeNav =
    navigation.items.find(
      (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)),
    ) ?? navigation.items[0];
  const activeGroupId =
    navigation.groups.find((group) =>
      group.items.some((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))),
    )?.id ?? navigation.groups[0].id;
  const [openGroupId, setOpenGroupId] = useState<(typeof navigation.groups)[number]["id"]>(activeGroupId);
  const visibleNotifications = notificationItems.slice(0, 4);
  const hasMoreNotifications = notificationItems.length > visibleNotifications.length;

  useEffect(() => {
    setShellSettings((current) => ({ ...settings, theme: current.theme }));
  }, [settings]);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
    }

    if (resolvedTheme !== themePreference) {
      setTheme(themePreference);
    }
  }, [mounted, resolvedTheme, setTheme, themePreference]);

  useEffect(() => {
    setCollapsed(shellSettings.sidebarCollapsed);
  }, [shellSettings.sidebarCollapsed]);

  useEffect(() => {
    function handleSettingsPreview(event: Event) {
      const customEvent = event as CustomEvent<Partial<ShellProps["settings"]>>;
      const nextSettings = customEvent.detail;
      if (!nextSettings) return;

      setShellSettings((current) => ({ ...current, ...nextSettings }));
    }

    window.addEventListener("skyhub:settings-preview", handleSettingsPreview as EventListener);
    return () => {
      window.removeEventListener("skyhub:settings-preview", handleSettingsPreview as EventListener);
    };
  }, []);

  useEffect(() => {
    function handleNotificationPreview(event: Event) {
      const customEvent = event as CustomEvent<{
        title: string;
        message: string;
        type: string;
        href?: string | null;
      }>;

      if (!customEvent.detail) return;

      const previewItem = {
        id: `preview-${Date.now()}`,
        title: customEvent.detail.title,
        message: customEvent.detail.message,
        href: customEvent.detail.href ?? null,
        type: customEvent.detail.type,
        read: false,
        createdAt: new Date().toISOString(),
      };

      setNotificationItems((items) => [previewItem, ...items].slice(0, 8));
      setNotificationOpen(true);
    }

    window.addEventListener("skyhub:notification-preview", handleNotificationPreview as EventListener);
    return () =>
      window.removeEventListener("skyhub:notification-preview", handleNotificationPreview as EventListener);
  }, []);

  useEffect(() => {
    setNotificationItems(notifications);
  }, [notifications]);

  useEffect(() => {
    setOpenGroupId(activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function persistSettings(payload: Record<string, unknown>) {
    if (user.role === "customer") {
      return null;
    }

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;

    const result = (await response.json()) as { settings?: ShellProps["settings"] | null };
    return result.settings ?? null;
  }

  async function handleSidebarToggle(nextValue: boolean) {
    setCollapsed(nextValue);
    setShellSettings((current) => ({ ...current, sidebarCollapsed: nextValue }));
    const persisted = await persistSettings({ sidebarCollapsed: nextValue });
    if (persisted) {
      setShellSettings((current) => ({ ...current, ...persisted }));
    }
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search.trim()) return;
    const response = await fetch(`/api/search?query=${encodeURIComponent(search.trim())}`);
    if (!response.ok) return;
    const result = (await response.json()) as { path?: string | null };
    if (result.path) {
      router.push(result.path);
      setSearch("");
    }
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setNotificationItems((items) => items.map((item) => ({ ...item, read: true })));
  }

  async function handleNotificationClick(item: ShellProps["notifications"][number]) {
    if (!item.read) {
      setNotificationItems((items) =>
        items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
      );
      await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
    }

    setNotificationOpen(false);

    if (item.href) {
      router.push(item.href);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/about-us");
    router.refresh();
  }

  async function handleThemeToggle() {
    const nextTheme = activeTheme === "dark" ? "light" : "dark";
    setShellSettings((current) => ({ ...current, theme: nextTheme }));
    setTheme(nextTheme);
    const persisted = await persistSettings({ theme: nextTheme });
    if (persisted) {
      setShellSettings((current) => ({ ...current, ...persisted }));
    }
  }

  return (
    <div
      style={shellStyle}
      className={cn(
        "h-svh overflow-x-clip bg-[color:var(--app-bg)] text-[color:var(--app-fg)]",
        shellSettings.compactRows && "compact-table",
      )}
    >
      <div className="flex h-full min-h-0">
        <div className={cn("fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden", mobileOpen ? "block" : "hidden")} onClick={() => setMobileOpen(false)} />

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex overflow-hidden border-r border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/98 backdrop-blur transition-all duration-200",
            "w-[var(--sidebar-width)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex min-h-0 w-full flex-col">
            <div className={cn("border-b border-[color:var(--border-soft)]", collapsed ? "px-3 py-4" : "px-5 py-5")}>
              {collapsed ? (
                <div className="flex flex-col items-center gap-4">
                  <Link href="/dashboard" className="block" onClick={() => setMobileOpen(false)}>
                    <BrandMark iconOnly tileClassName="h-14 w-14 rounded-[20px]" />
                  </Link>
                  <button
                    type="button"
                    className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)] lg:inline-flex"
                    onClick={() => handleSidebarToggle(false)}
                    aria-label="Perluas sidebar"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href="/dashboard" className="block" onClick={() => setMobileOpen(false)}>
                      <BrandMark title={APP_NAME} subtitle={APP_SUBTITLE} />
                    </Link>
                    <div className="mt-3 flex items-center gap-2 pl-[68px]">
                      <StatusBadge value="normal" label="Normal" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                        {user.customerAccountName || user.station}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)] lg:inline-flex"
                    onClick={() => handleSidebarToggle(true)}
                    aria-label="Lipat sidebar"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="px-4 py-5">
              {!collapsed && (
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Modul Aktif</p>
                  <p className="mt-2 font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                    {activeNav.label}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{activeNav.hint}</p>
                </div>
              )}
            </div>

            <nav
              className={cn(
                "min-h-0 flex-1 overflow-y-auto ops-scrollbar",
                collapsed ? "flex flex-col items-center gap-3 px-4 py-2" : "space-y-3 px-4 pb-4",
              )}
            >
              {collapsed
                ? navigation.items.map((item) => {
                    const Icon = navIconMap[item.href];
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        aria-label={item.label}
                        className={cn(
                          "sidebar-link",
                          isActive && "sidebar-link-active",
                          "mx-auto h-12 w-12 justify-center rounded-[18px] px-0",
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon size={18} className="shrink-0" />
                      </Link>
                    );
                  })
                : navigation.groups.map((group) => {
                    const GroupIcon = navGroupIconMap[group.id];
                    const isOpen = openGroupId === group.id;

                    return (
                      <div key={group.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-3">
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-[18px] px-2 py-2 text-left text-[color:var(--muted-fg)] transition-colors",
                            isOpen && "text-[color:var(--text-strong)]",
                          )}
                          onClick={() => setOpenGroupId(group.id)}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] text-[color:var(--brand-primary)]">
                              <GroupIcon size={18} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{group.label}</span>
                              <span className="block text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                                {group.items.length} menu
                              </span>
                            </span>
                          </span>
                          <ChevronDown size={16} className={cn("transition-transform", isOpen && "rotate-180")} />
                        </button>

                        {isOpen ? (
                          <div className="mt-2 space-y-1">
                            {group.items.map((item) => {
                              const Icon = navIconMap[item.href];
                              const isActive =
                                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={cn("sidebar-link", isActive && "sidebar-link-active")}
                                  onClick={() => {
                                    setOpenGroupId(group.id);
                                    setMobileOpen(false);
                                  }}
                                >
                                  <Icon size={18} className="shrink-0" />
                                  <div className="min-w-0">
                                    <p className="truncate">{item.label}</p>
                                    <p className="truncate text-[11px] font-medium text-[color:var(--muted-2)]">{item.hint}</p>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
            </nav>

            <div className={cn("border-t border-[color:var(--border-soft)]", collapsed ? "px-4 py-4" : "px-4 py-4")}>
              <div className={cn("rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-contrast)] px-4 py-4 text-white", collapsed && "px-0 py-3")}>
                {!collapsed ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Ringkasan</p>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-[family:var(--font-heading)] text-lg font-extrabold tracking-[-0.03em]">
                          {user.role === "customer" ? "Portal Akun" : "Shift Aktif"}
                        </p>
                        <p className="mt-1 text-sm text-white/70">
                          {ROLE_LABELS[user.role]} | {user.customerAccountName || user.station}
                        </p>
                      </div>
                      <StatusBadge value="normal" label="Siap" className="border-white/15 bg-white/10 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/10 text-sm font-black">
                      {user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-[color:var(--tone-success)]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 w-full flex-col transition-all duration-200 lg:ml-[var(--sidebar-width)]">
          <header className="sticky top-0 z-30 shrink-0 px-4 py-4 lg:px-8 lg:py-5">
            <div className="ops-panel shell-topbar-toolbar flex flex-wrap items-center px-4 py-4 lg:px-5">
              <button type="button" className="topbar-button mobile-hamburger-trigger" onClick={() => setMobileOpen(true)}>
                <Menu size={18} />
              </button>

              <div className="min-w-0 flex-[1_1_180px] sm:flex-[0_1_auto]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Ruang Kontrol</p>
                <p className="mt-1 font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                  {activeNav.label}
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative min-w-[180px] flex-[2_1_320px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari AWB, shipment, atau flight"
                  className="input-field input-field-leading w-full"
                />
              </form>

              <div className="topbar-button hidden xl:flex">
                <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--tone-success)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Sinkron</p>
                  <p className="text-sm font-semibold text-[color:var(--text-strong)]">{clock ? formatDateTime(clock) : "Sinkronisasi waktu"}</p>
                </div>
              </div>

              <button type="button" className="topbar-button" onClick={handleThemeToggle}>
                {activeTheme === "dark" ? <SunMedium size={18} /> : <MoonStar size={18} />}
                <span className="hidden sm:inline">{activeTheme === "dark" ? "Terang" : "Gelap"}</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="topbar-button relative overflow-visible pr-5 sm:pr-8"
                  onClick={() => setNotificationOpen((value) => !value)}
                >
                  <Bell size={18} />
                  <span className="hidden sm:inline">Notifikasi</span>
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[color:var(--panel-bg)] bg-[color:var(--brand-primary)] px-1 text-[10px] font-bold leading-none text-white shadow-[0_6px_16px_rgba(0,61,155,0.24)]">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>

                {notificationOpen ? (
                  <div className="dropdown-panel right-0 top-14 w-[min(360px,calc(100vw-1.5rem))] sm:w-[360px]">
                    <div className="flex items-center justify-between border-b border-[color:var(--border-soft)] px-4 py-4">
                      <div>
                        <p className="font-[family:var(--font-heading)] text-lg font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                          Notifikasi
                        </p>
                        <p className="text-sm text-[color:var(--muted-fg)]">{unreadCount} belum dibaca</p>
                      </div>
                      <button type="button" className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-primary)]" onClick={handleMarkAllRead}>
                        Tandai semua
                      </button>
                    </div>
                    <div>
                      {visibleNotifications.length ? (
                        visibleNotifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full border-b border-[color:var(--border-soft)] px-4 py-4 text-left last:border-b-0 hover:bg-[color:var(--panel-muted)]"
                            onClick={() => handleNotificationClick(item)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                                <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{item.message}</p>
                                <p className="mt-2 text-xs text-[color:var(--muted-2)]">{formatRelativeShort(item.createdAt)}</p>
                              </div>
                              {!item.read ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[color:var(--brand-primary)]" /> : null}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-sm text-[color:var(--muted-fg)]">Tidak ada notifikasi.</div>
                      )}
                    </div>
                    {hasMoreNotifications ? (
                      <div className="border-t border-[color:var(--border-soft)] px-4 py-3">
                        <button
                          type="button"
                          className="w-full rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3 text-sm font-semibold text-[color:var(--text-strong)]"
                          onClick={() => {
                            setNotificationOpen(false);
                            router.push("/activity-log");
                          }}
                        >
                          Buka Log Aktivitas
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-3"
                  onClick={() => setAvatarOpen((value) => !value)}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-primary-2))] text-sm font-black text-white">
                    {user.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">{user.name}</p>
                    <p className="text-xs text-[color:var(--muted-fg)]">{ROLE_LABELS[user.role]}</p>
                  </div>
                  <ChevronDown size={16} className="hidden sm:block text-[color:var(--muted-fg)]" />
                </button>

                {avatarOpen ? (
                  <div className="dropdown-panel right-0 top-14 w-[min(248px,calc(100vw-1.5rem))] sm:w-[248px]">
                    <div className="border-b border-[color:var(--border-soft)] px-4 py-4">
                      <p className="font-semibold text-[color:var(--text-strong)]">{user.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                        {user.customerAccountName || user.station}
                      </p>
                    </div>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[color:var(--panel-muted)]">
                      <UserCircle2 size={18} />
                      Profil
                    </Link>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[color:var(--tone-warning)] hover:bg-[color:var(--panel-muted)]"
                      onClick={handleSignOut}
                    >
                      <ChevronRight size={18} />
                      Keluar
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="ops-shell-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 lg:px-8">
            <div className="h-full min-h-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
