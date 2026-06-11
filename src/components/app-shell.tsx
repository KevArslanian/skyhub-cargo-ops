"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LiquidGlassBackdrop } from "@/components/liquid-glass-overlay";
import {
  Bell,
  BellRing,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PackageSearch,
  PlaneTakeoff,
  ScanBarcode,
  Search,
  Settings2,
} from "lucide-react";
import { getNavigationForRole } from "@/lib/access";
import { APP_NAME, APP_SUBTITLE, ROLE_LABELS } from "@/lib/constants";
import { cn, formatNotificationMessage, formatRelativeShort } from "@/lib/format";
import { BrandMark } from "./brand-mark";
import { OpsAlertProvider, useOpsAlert } from "./ops-alert-provider";
import { ShellSearchProvider } from "./shell-search-provider";
import { ShellTopbarControlsContext } from "./shell-topbar-controls";
import { runThemeTransition, useTheme } from "./theme-provider";

/** Di atas ops-drawer (z 60) agar simulasi notifikasi terlihat saat pengaturan terbuka. */
const TOPBAR_OVERLAY_BACKDROP_Z = 64;
const TOPBAR_OVERLAY_PANEL_Z = 70;
const TOPBAR_OVERLAY_TRIGGER_Z = 71;
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";

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

type ShellSearchResult = {
  path: string;
  label: string;
  kind: string;
  description?: string;
};

const navIconMap = {
  "/dashboard": LayoutDashboard,
  "/shipment-ledger": PackageSearch,
  "/awb-tracking": ScanBarcode,
  "/alerts": BellRing,
  "/flight-board": PlaneTakeoff,
  "/activity-log": History,
  "/complaints": MessageSquare,

  "/settings": Settings2,
} as const;

const navIconFallback = LayoutDashboard;

const ROUTE_LABELS: Array<[string, string]> = [

  ["/query", "Pemeriksaan Data"],
  ["/seed", "Utilitas Seed"],
  ["/exports/shipments", "Cetak Buku Pengiriman"],
  ["/exports/flights", "Cetak Manajemen Pesawat"],
  ["/exports/activity-log", "Cetak Catatan Aktivitas"],
  ["/exports/awb", "Cetak AWB"],
];

const ACCENT_COLORS = {
  blue: ["#003d9b", "#0052cc", "#0059cf", "rgba(0, 61, 155, 0.09)"],
  teal: ["#0d766e", "#0d9488", "#14b8a6", "rgba(13, 148, 136, 0.12)"],
  amber: ["#b45309", "#d97706", "#f59e0b", "rgba(217, 119, 6, 0.13)"],
  rose: ["#be123c", "#e11d48", "#f43f5e", "rgba(225, 29, 72, 0.12)"],
  violet: ["#6d28d9", "#7c3aed", "#8b5cf6", "rgba(124, 58, 237, 0.12)"],
} as const;

function applyAccentColor(value?: string | null) {
  if (typeof document === "undefined") return;

  const color = value && value in ACCENT_COLORS ? ACCENT_COLORS[value as keyof typeof ACCENT_COLORS] : ACCENT_COLORS.blue;
  document.documentElement.style.setProperty("--brand-primary", color[0]);
  document.documentElement.style.setProperty("--brand-primary-2", color[1]);
  document.documentElement.style.setProperty("--brand-primary-3", color[2]);
  document.documentElement.style.setProperty("--brand-primary-soft", color[3]);
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

export function AppShell(props: ShellProps) {
  return (
    <OpsAlertProvider>
      <AppShellFrame {...props} />
    </OpsAlertProvider>
  );
}

function AppShellFrame({ user, settings, notifications, children }: ShellProps) {
  const { showAlert } = useOpsAlert();
  const pathname = usePathname();
  const router = useRouter();
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const { setTheme } = useTheme();
  const navigation = getNavigationForRole(user.role);
  const [search, setSearch] = useState("");
  const [shellSettings, setShellSettings] = useState(settings);
  const [collapsed, setCollapsed] = useState(settings.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationMenuStyle, setNotificationMenuStyle] = useState<CSSProperties>({});
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const [notificationItems, setNotificationItems] = useState(notifications);
  const [mounted, setMounted] = useState(false);
  const [searchPreviewOpen, setSearchPreviewOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ShellSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [topbarControls, setTopbarControls] = useState<ReactNode>(null);
  const themePreference =
    shellSettings.theme === "dark" || shellSettings.theme === "system" ? shellSettings.theme : "light";
  const sidebarWidth = collapsed ? "88px" : "min(284px, 24vw)";
  const shellStyle = {
    "--sidebar-width": sidebarWidth,
  } as CSSProperties;

  const unreadCount = useMemo(() => notificationItems.filter((item) => !item.read).length, [notificationItems]);
  const topbarDropdownOpen = notificationOpen || searchPreviewOpen;

  function closeTopbarDropdowns() {
    setNotificationOpen(false);
    setSearchPreviewOpen(false);
  }

  const getNotificationMenuStyle = useCallback((): CSSProperties => {
    const trigger = notificationTriggerRef.current;
    if (!trigger) return { zIndex: TOPBAR_OVERLAY_PANEL_Z };

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.min(360, window.innerWidth - viewportPadding * 2);

    return {
      position: "fixed",
      top: rect.bottom + 14,
      right: Math.max(viewportPadding, window.innerWidth - rect.right),
      width: menuWidth,
      zIndex: TOPBAR_OVERLAY_PANEL_Z,
      maxHeight: `min(480px, calc(100svh - ${rect.bottom + 34}px))`,
    };
  }, []);

  const updateNotificationMenuPosition = useCallback(() => {
    setNotificationMenuStyle(getNotificationMenuStyle());
  }, [getNotificationMenuStyle]);

  const activeNav =
    navigation.items.find(
      (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)),
    ) ??
    navigation.items[0] ?? {
      href: "/awb-tracking" as const,
      label: "Pelacakan AWB",
      hint: "Status dan linimasa AWB",
      groupId: "operasional" as const,
      groupLabel: "Operasional",
      roles: ["customer" as const],
    };


  const visibleNotifications = notificationItems.slice(0, 10);
  const hasMoreNotifications = notificationItems.length > visibleNotifications.length;
  const showShellSearch = false;
  const routeLabel = ROUTE_LABELS.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1];
  const topbarLabel = routeLabel ?? activeNav.label;

  const displayedNavigationItems = navigation.items.filter((item) => item.href !== "/settings");
  const displayedNavigationGroups = navigation.groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.href !== "/settings") }))
    .filter((group) => group.items.length > 0);
  const canOpenSettings = navigation.items.some((item) => item.href === "/settings");
  const isSettingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  useEffect(() => {
    setShellSettings(settings);
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopSidebar(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
    }

    const storedAccent = window.localStorage.getItem("skyhub-accent-color");

    setTheme(themePreference);
    applyAccentColor(storedAccent);
  }, [mounted, setTheme, themePreference]);

  useEffect(() => {
    setCollapsed(shellSettings.sidebarCollapsed);
  }, [shellSettings.sidebarCollapsed]);

  useEffect(() => {
    function handleSettingsPreview(event: Event) {
      const customEvent = event as CustomEvent<Partial<ShellProps["settings"]> & { accentColor?: string }>;
      const nextSettings = customEvent.detail;
      if (!nextSettings) return;

      setShellSettings((current) => ({ ...current, ...nextSettings }));
      if (nextSettings.theme === "dark" || nextSettings.theme === "light" || nextSettings.theme === "system") {
        window.localStorage.setItem("theme", nextSettings.theme);
        runThemeTransition();
        setTheme(nextSettings.theme);
      }
      if (typeof nextSettings.accentColor === "string") {
        window.localStorage.setItem("skyhub-accent-color", nextSettings.accentColor);
        applyAccentColor(nextSettings.accentColor);
      }
    }

    window.addEventListener("skyhub:settings-preview", handleSettingsPreview as EventListener);
    return () => {
      window.removeEventListener("skyhub:settings-preview", handleSettingsPreview as EventListener);
    };
  }, [setTheme]);

  useEffect(() => {
    function handleNotificationPreview(event: Event) {
      const customEvent = event as CustomEvent<{
        title: string;
        message: string;
        type: string;
        href?: string | null;
        soundAlert?: boolean;
        forceSound?: boolean;
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

      setNotificationItems((items) => [previewItem, ...items].slice(0, 10));
      setNotificationMenuStyle(getNotificationMenuStyle());
      setNotificationOpen(true);
      const shouldPlaySound =
        customEvent.detail.forceSound === true
          ? true
          : (customEvent.detail.soundAlert ?? shellSettings.soundAlert);
      if (shouldPlaySound) {
        playCriticalTone();
      }
    }

    window.addEventListener("skyhub:notification-preview", handleNotificationPreview as EventListener);
    return () =>
      window.removeEventListener("skyhub:notification-preview", handleNotificationPreview as EventListener);
  }, [getNotificationMenuStyle, shellSettings.soundAlert]);

  useEffect(() => {
    setNotificationItems(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!notificationOpen) return undefined;

    updateNotificationMenuPosition();

    function handleReposition() {
      updateNotificationMenuPosition();
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [notificationOpen, updateNotificationMenuPosition]);

  useEffect(() => {
    if (!notificationOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeTopbarDropdowns();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationOpen]);

  useEffect(() => {
    setSearch("");
    setSearchResults([]);
    setSearchPreviewOpen(false);
    setNotificationOpen(false);

    const main = mainScrollRef.current;
    if (main) {
      main.scrollTop = 0;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!showShellSearch || !search.trim()) {
      setSearchResults([]);
      setSearchPreviewOpen(false);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const scope = pathname === "/shipment-ledger" ? "ledger" : "flight";
      setSearchLoading(true);

      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(search.trim())}&scope=${scope}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          showAlert({
            title: "Pencarian Gagal",
            description: await readApiError(response, "Hasil pencarian belum bisa dimuat."),
            tone: "error",
          });
          setSearchResults([]);
          return;
        }

        const result = (await response.json()) as { results?: ShellSearchResult[] };
        setSearchResults(result.results?.slice(0, 6) ?? []);
        setSearchPreviewOpen(true);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setSearchResults([]);
          showAlert({
            title: "Koneksi Terputus",
            description: networkErrorMessage("memuat hasil pencarian"),
            tone: "warning",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 160);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pathname, search, showAlert, showShellSearch]);


  function runContextSearch(nextQuery: string, targetPath = pathname) {
    if (!nextQuery.trim()) return;
    const trimmedQuery = nextQuery.trim();

    window.dispatchEvent(
      new CustomEvent("skyhub:context-search", {
        detail: {
          pathname: targetPath,
          query: trimmedQuery,
          focusDetail: true,
        },
      }),
    );

    if (targetPath === "/shipment-ledger") {
      router.push(`/shipment-ledger?query=${encodeURIComponent(trimmedQuery)}`);
      return;
    }

    if (targetPath === "/awb-tracking") {
      router.push(`/awb-tracking?awb=${encodeURIComponent(trimmedQuery)}`);
      return;
    }

    if (targetPath === "/flight-board") {
      router.push(`/flight-board?query=${encodeURIComponent(trimmedQuery)}`);
      return;
    }
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search.trim()) return;
    const nextQuery = search.trim();

    setSearchPreviewOpen(false);

    if (showShellSearch) {
      runContextSearch(nextQuery);
      return;
    }

    if (pathname === "/alerts" || pathname === "/activity-log" || pathname === "/complaints" || pathname === "/dashboard" || pathname === "/settings") {
      return;
    }

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(nextQuery)}&scope=global`);
      if (!response.ok) {
        showAlert({
          title: "Pencarian Gagal",
          description: await readApiError(response, "Pencarian global belum bisa diproses."),
          tone: "error",
        });
        return;
      }
      const result = (await response.json()) as { path?: string | null };
      if (result.path) {
        router.push(result.path);
        setSearch("");
        return;
      }
      showAlert({
        title: "Tidak Ditemukan",
        description: "Tidak ada halaman operasional yang cocok dengan kata kunci tersebut.",
        tone: "info",
      });
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("menjalankan pencarian global"),
        tone: "warning",
      });
    }
  }

  function handleSearchResultSelect(result: ShellSearchResult) {
    setSearch(result.label);
    setSearchPreviewOpen(false);

    if (result.path.startsWith("/shipment-ledger")) {
      runContextSearch(result.label, "/shipment-ledger");
      return;
    }

    if (result.path.startsWith("/awb-tracking")) {
      runContextSearch(result.label, "/awb-tracking");
      return;
    }

    if (result.path.startsWith("/flight-board")) {
      runContextSearch(result.label, "/flight-board");
      return;
    }

    router.push(result.path);
  }

  async function handleMarkAllRead() {
    try {
      const response = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!response.ok) {
        showAlert({
          title: "Gagal Memperbarui",
          description: await readApiError(response, "Status notifikasi belum bisa diperbarui."),
          tone: "error",
        });
        return;
      }
      setNotificationItems((items) => items.map((item) => ({ ...item, read: true })));
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("menandai semua notifikasi sebagai dibaca"),
        tone: "warning",
      });
    }
  }

  async function handleNotificationClick(item: ShellProps["notifications"][number]) {
    if (!item.read) {
      setNotificationItems((items) =>
        items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
      );
      try {
        const response = await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
        if (!response.ok) {
          showAlert({
            title: "Gagal Memperbarui",
            description: await readApiError(response, "Status notifikasi belum bisa diperbarui."),
            tone: "error",
          });
        }
      } catch {
        showAlert({
          title: "Koneksi Terputus",
          description: networkErrorMessage("memperbarui status notifikasi"),
          tone: "warning",
        });
      }
    }

    setNotificationOpen(false);

    if (item.href) {
      router.push(item.href);
    }
  }

  async function handleSignOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        showAlert({
          title: "Keluar Gagal",
          description: await readApiError(response, "Sesi belum bisa diakhiri. Coba lagi."),
          tone: "error",
        });
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("mengakhiri sesi"),
        tone: "warning",
      });
    }
  }

  const searchPlaceholder = useMemo(() => {
    if (pathname === "/dashboard") return "Cari dasbor";
    if (pathname === "/shipment-ledger") return "Cari pengiriman";
    if (pathname === "/flight-board") return "Cari pesawat atau penerbangan";
    if (pathname === "/alerts") return "Cari peringatan";
    if (pathname === "/complaints") return "Cari keluhan";
    if (pathname === "/activity-log") return "Cari catatan";
    if (pathname === "/settings") return "Cari pengaturan";
    return "Cari";
  }, [pathname]);
  const shellSearchConfig = useMemo(
    () => ({
      scope: pathname.replace("/", "") || "dashboard",
      placeholder: searchPlaceholder,
      filterSummary: activeNav.label,
    }),
    [activeNav.label, pathname, searchPlaceholder],
  );
  const topbarControlsContext = useMemo(() => ({ setControls: setTopbarControls }), []);

  return (
    <ShellSearchProvider value={shellSearchConfig}>
      <ShellTopbarControlsContext.Provider value={topbarControlsContext}>
        <div
          style={shellStyle}
          className={cn(
            "h-svh w-full min-w-0 overflow-x-clip bg-[color:var(--app-bg)] text-[color:var(--app-fg)]",
            shellSettings.compactRows && "compact-table",
          )}
        >
      <div className="flex h-full min-h-0 min-w-0">
        <LiquidGlassBackdrop
          open={mobileOpen && !isDesktopSidebar}
          onClose={() => setMobileOpen(false)}
          theme="ops"
          className="ops-overlay-sidebar lg:hidden"
          zIndex={40}
        />

        <LiquidGlassBackdrop
          open={topbarDropdownOpen}
          onClose={closeTopbarDropdowns}
          theme="ops"
          zIndex={TOPBAR_OVERLAY_BACKDROP_Z}
        />

        {mounted && notificationOpen
          ? createPortal(
              <div
                className="dropdown-panel ops-select-menu notifications-dropdown-panel"
                style={notificationMenuStyle}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="notifications-dropdown-head shrink-0 flex items-center justify-between border-b border-[color:var(--border-soft)] px-4 py-4">
                  <div className="min-w-0">
                    <p className="font-[family:var(--font-heading)] text-lg font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                      Pemberitahuan
                    </p>
                    <p className="text-sm text-[color:var(--muted-fg)]">{unreadCount} belum dibaca</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-primary)] disabled:text-[color:var(--muted-2)] disabled:cursor-not-allowed"
                    onClick={handleMarkAllRead}
                    disabled={unreadCount === 0}
                  >
                    Tandai semua
                  </button>
                </div>
                <div className="notifications-dropdown-list min-h-0 flex-1">
                  {visibleNotifications.length ? (
                    visibleNotifications.map((item) => {
                      const displayMessage = formatNotificationMessage(item.message);
                      return (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full border-b border-[color:var(--border-soft)] px-4 py-4 text-left last:border-b-0 hover:bg-[color:var(--panel-muted)]"
                        onClick={() => handleNotificationClick(item)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="break-words text-sm font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                            <p className="mt-1 break-words text-sm leading-6 text-[color:var(--muted-fg)] [overflow-wrap:anywhere]">
                              {displayMessage}
                            </p>
                            <p className="mt-2 text-xs text-[color:var(--muted-2)]">{formatRelativeShort(item.createdAt)}</p>
                          </div>
                          {!item.read ? (
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--brand-primary)]" aria-hidden="true" />
                          ) : null}
                        </div>
                      </button>
                    );
                    })
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <Bell size={26} className="mx-auto text-[color:var(--muted-2)]" />
                      <p className="mt-3 text-sm font-medium text-[color:var(--muted-fg)]">Tidak ada pemberitahuan baru</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-2)]">Pemberitahuan akan muncul di sini saat ada aktivitas.</p>
                    </div>
                  )}
                </div>
                {hasMoreNotifications ? (
                  <div className="notifications-dropdown-foot shrink-0 border-t border-[color:var(--border-soft)] px-4 py-3">
                    <button
                      type="button"
                      className="w-full rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3 text-sm font-semibold text-[color:var(--text-strong)]"
                      onClick={() => {
                        setNotificationOpen(false);
                        router.push("/activity-log");
                      }}
                    >
                      Buka Catatan Aktivitas
                    </button>
                  </div>
                ) : null}
              </div>,
              document.body,
            )
          : null}

        <motion.aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex overflow-hidden border-r border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]",
            isDesktopSidebar ? "shadow-none" : "ops-overlay-panel ops-sidebar-panel",
            "w-[var(--sidebar-width)] max-w-[calc(100vw-1rem)]",
            isDesktopSidebar ? "pointer-events-auto" : mobileOpen ? "pointer-events-auto" : "pointer-events-none",
            "lg:pointer-events-auto",
          )}
          initial={false}
          animate={
            isDesktopSidebar
              ? { x: 0, opacity: 1 }
              : reducedMotion
                ? { x: mobileOpen ? 0 : "-100%", opacity: mobileOpen ? 1 : 0 }
                : { x: mobileOpen ? 0 : "-100%", opacity: 1 }
          }
          transition={
            reducedMotion
              ? { duration: 0.2 }
              : { type: "spring", stiffness: 380, damping: 36 }
          }
        >
          <div className="flex min-h-0 w-full flex-col">
            <div className={cn("shrink-0 border-b border-[color:var(--border-soft)]", collapsed ? "px-3 py-3" : "px-4 py-3")}>
              {collapsed ? (
                <div className="flex flex-col items-center gap-4">
                  <Link href="/dashboard" className="block" onClick={() => setMobileOpen(false)}>
                    <BrandMark iconOnly tileClassName="h-14 w-14 rounded-[20px]" />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href="/dashboard" className="block" onClick={() => setMobileOpen(false)}>
                      <BrandMark title={APP_NAME} subtitle={APP_SUBTITLE} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <nav
              className={cn(
                "sidebar-nav min-h-0 flex-1",
                collapsed ? "flex flex-col items-center gap-2 px-3 py-2" : "px-3 py-2",
              )}
            >
              {collapsed
                ? displayedNavigationItems.map((item) => {
                    const Icon = navIconMap[item.href] ?? navIconFallback;
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        scroll={false}
                        title={item.label}
                        aria-label={item.label}
                        className={cn(
                          "sidebar-link sidebar-link-compact",
                          isActive && "sidebar-link-active",
                          "mx-auto h-10 w-10 justify-center rounded-[14px] px-0",
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon size={17} className="shrink-0" />
                      </Link>
                    );
                  })
                : displayedNavigationGroups.map((group) => (
                    <div key={group.id} className="sidebar-nav-group">
                      <p className="sidebar-group-label">{group.label}</p>
                      <div className="sidebar-nav-items">
                        {group.items.map((item) => {
                          const Icon = navIconMap[item.href] ?? navIconFallback;
                          const isActive =
                            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              scroll={false}
                              title={item.hint}
                              className={cn("sidebar-link sidebar-link-compact", isActive && "sidebar-link-active")}
                              onClick={() => setMobileOpen(false)}
                            >
                              <Icon size={16} className="shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
            </nav>

            <div className={cn("shrink-0 border-t border-[color:var(--border-soft)]", collapsed ? "px-3 py-3" : "px-3 py-3")}>
              <div className={cn("rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-2.5", collapsed && "px-1.5")}>
                {!collapsed ? (
                  <>
                    <div className="flex items-center gap-2.5 rounded-[14px] px-1 pb-2 text-left">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--brand-primary)] text-xs font-black text-white">
                        {user.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--text-strong)]">{user.name}</p>
                        <p className="truncate text-xs text-[color:var(--muted-fg)]">{ROLE_LABELS[user.role]} | {user.station}</p>
                      </div>
                    </div>
                    {canOpenSettings ? (
                      <div className="grid gap-1 border-t border-[color:var(--border-soft)] pt-3">
                        <Link
                          href="/settings"
                          title="Profil, akses, preferensi"
                          className={cn("sidebar-link sidebar-link-compact", isSettingsActive && "sidebar-link-active")}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Settings2 size={16} className="shrink-0" />
                          <span className="truncate">Pengaturan</span>
                        </Link>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[color:var(--brand-primary)] text-sm font-black text-white">
                      {user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    {canOpenSettings ? (
                      <Link
                        href="/settings"
                        title="Pengaturan"
                        aria-label="Pengaturan"
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel)] text-[color:var(--muted-fg)] transition-colors hover:text-[color:var(--text-strong)]",
                          isSettingsActive && "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]",
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Settings2 size={18} />
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={cn(
                  "mt-2 flex w-full items-center gap-2.5 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--muted-fg)] transition-colors hover:border-[color:var(--tone-danger-border)] hover:bg-[color:var(--tone-danger-soft)] hover:text-[color:var(--tone-danger)]",
                  collapsed && "h-10 justify-center px-0",
                )}
                onClick={handleSignOut}
                title="Keluar"
                aria-label="Keluar"
              >
                <LogOut size={18} className="shrink-0" />
                {!collapsed ? <span>Keluar</span> : null}
              </button>
            </div>
          </div>
        </motion.aside>

        <div className="shell-content flex min-h-0 min-w-0 w-full flex-col overflow-hidden transition-all duration-200 lg:ml-[var(--sidebar-width)]" data-density={shellSettings.compactRows ? "compact" : "comfortable"}>
          <header className="shell-topbar sticky top-0 z-30 min-w-0 shrink-0 px-3 py-3 sm:px-4 sm:py-4 lg:px-8 lg:py-5">
            <div className="ops-panel shell-topbar-toolbar flex min-w-0 flex-wrap items-center px-4 py-4 lg:px-5">
              <button type="button" className="topbar-button mobile-hamburger-trigger shrink-0" onClick={() => setMobileOpen(true)}>
                <Menu size={18} />
              </button>

              <div className="min-w-0 flex-[1_1_140px] sm:flex-[0_1_auto]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Ruang Kontrol</p>
                <p className="mt-1 font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                  {topbarLabel}
                </p>

              </div>

              {showShellSearch ? (
                <form
                  onSubmit={handleSearchSubmit}
                  className="shell-topbar-search relative order-last min-w-0 flex-[1_1_100%] sm:order-none sm:flex-[1_1_240px] lg:flex-[2_1_320px]"
                  style={searchPreviewOpen ? { zIndex: TOPBAR_OVERLAY_TRIGGER_Z } : undefined}
                >
                  <button type="submit" className="topbar-search-submit" aria-label="Jalankan pencarian">
                    <Search size={16} />
                  </button>
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setSearchPreviewOpen(Boolean(event.target.value.trim()));
                    }}
                    onFocus={() => setSearchPreviewOpen(Boolean(search.trim()))}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearchPreviewOpen(false);
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="input-field input-field-leading w-full"
                  />
                  {searchPreviewOpen ? (
                    <div className="shell-search-preview ops-select-menu">
                      {searchLoading ? (
                        <div className="shell-search-preview-empty">Mencari kecocokan...</div>
                      ) : searchResults.length ? (
                        searchResults.map((result) => (
                          <button
                            key={`${result.kind}-${result.path}`}
                            type="button"
                            className="shell-search-preview-item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchResultSelect(result)}
                          >
                            <span className="shell-search-preview-kind">{result.kind}</span>
                            <span className="min-w-0">
                              <strong>{result.label}</strong>
                              {result.description ? <small>{result.description}</small> : null}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="shell-search-preview-empty">Belum ada kecocokan karakter.</div>
                      )}
                    </div>
                  ) : null}
                </form>
              ) : null}

              {topbarControls ? <div className="shell-topbar-controls">{topbarControls}</div> : null}

              <div className="shell-topbar-actions ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
                <div
                  className="relative"
                  style={notificationOpen ? { zIndex: TOPBAR_OVERLAY_TRIGGER_Z } : undefined}
                >
                  <button
                    ref={notificationTriggerRef}
                    type="button"
                    className="topbar-button relative shrink-0 overflow-visible pr-5 sm:pr-8"
                    aria-expanded={notificationOpen}
                    onClick={() => {
                      setNotificationOpen((value) => {
                        const next = !value;
                        if (next) setNotificationMenuStyle(getNotificationMenuStyle());
                        return next;
                      });
                    }}
                  >
                    <Bell size={18} />
                    <span className="hidden sm:inline">Pemberitahuan</span>
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[color:var(--panel-bg)] bg-[color:var(--brand-primary)] px-1 text-[10px] font-bold leading-none text-white shadow-[0_6px_16px_rgba(0,61,155,0.24)]">
                        {unreadCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>

            </div>
          </header>

          <main
            ref={mainScrollRef}
            className="ops-shell-main-scroll app-main-scroll flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3 sm:px-4 lg:px-8"
          >
            <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col">{children}</div>
          </main>
        </div>
      </div>
        </div>
      </ShellTopbarControlsContext.Provider>
    </ShellSearchProvider>
  );
}
