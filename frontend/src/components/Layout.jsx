import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell, BookOpen, Bookmark, Briefcase, Calculator, ChevronDown, GraduationCap, Home, LayoutGrid, LifeBuoy, LogIn, MapPinned, Moon,
  PenSquare, Plane, ReceiptText, RefreshCw, SearchCheck, Settings, ShieldCheck, Store, Sun, UserRound, WifiOff, X,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { api, apiAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import { lang, setLang, t } from "../i18n.js";
import { useTheme } from "../theme.js";
import { useAppUpdate, useOnline } from "../pwa.js";
import { useLiveNotifications } from "../live.js";
import { useScrollLock } from "../hooks.js";
import Footer from "./Footer.jsx";
import SeasonFall from "./SeasonFall.jsx";
import LiveToast from "./LiveToast.jsx";
import { InstallBanner, InstallHeaderButton, InstallMenuButton } from "./InstallApp.jsx";
import Assistant from "./Assistant.jsx";
import { PageTransition } from "./motion.jsx";
import { Skeleton } from "./ui.jsx";

function sections(user) {
  const all = [
    { to: "/", icon: Home, label: t("Асосӣ"), end: true, main: true, dock: 1 },
    user && { to: "/documents", icon: ShieldCheck, label: t("Ҳуҷҷатҳои ман"), short: t("Ҳуҷҷатҳо"), badge: "docs", main: true, dock: 2 },
    { to: "/jobs", icon: Briefcase, label: t("Ҷойи кор"), short: t("Кор"), main: true, dock: user ? 3 : 2 },
    { to: "/tickets", icon: Plane, label: t("Чиптаҳо"), main: true, dock: user ? null : 3 },
    { to: "/places", icon: MapPinned, label: t("Ҷойҳо"), main: true, dock: 4 },
    { to: "/shops", icon: Store, label: t("Мағозаҳо"), main: true },
    { to: "/calculator", icon: Calculator, label: t("Нархи патент") },
    { to: "/guides", icon: BookOpen, label: t("Роҳнамо ва қонунҳо") },
    { to: "/checks", icon: SearchCheck, label: t("Санҷиши ҳуҷҷатҳо") },
    { to: "/exam", icon: GraduationCap, label: t("Машқ барои имтиҳон") },
    { to: "/help", icon: LifeBuoy, label: t("Маркази ёрии ҳуқуқӣ") },
    user && { to: "/saved-jobs", icon: Bookmark, label: t("Захира ва огоҳиҳо") },
    user && { to: "/payments", icon: ReceiptText, label: t("Архиви чекҳо") },
    user && { to: "/notifications", icon: Bell, label: t("Огоҳиҳо"), badge: "unread" },
    user && { to: "/profile", icon: Settings, label: t("Профил ва танзимот") },
    !user && { to: "/login", icon: LogIn, label: t("Ворид шудан") },
  ];
  return all.filter(Boolean);
}

export const canEdit = (user) => user && (user.role === "editor" || user.role === "admin");

function useCounters(user, onNew) {
  const [counts, setCounts] = useState({ unread: 0, docs: 0 });
  const { pathname } = useLocation();
  useLiveNotifications(user, (msg) => {
    if (typeof msg.unread === "number") setCounts((c) => ({ ...c, unread: msg.unread }));
    if (msg.type === "notification") onNew?.(msg.notification);
  });
  useEffect(() => {
    if (!user) {
      setCounts({ unread: 0, docs: 0 });
      return;
    }
    let alive = true;
    const unread = api("/auth/notifications/unread-count/").then((r) => r.count).catch(() => 0);
    const docs = apiAll("/documents/my-documents/").then((list) => list.filter((d) => d.status !== "valid").length).catch(() => 0);
    Promise.all([unread, docs]).then(([u, d]) => alive && setCounts({ unread: u, docs: d }));
    return () => {
      alive = false;
    };
  }, [user, pathname]);
  return counts;
}

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Muhojir">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm">
        <img src="/logo.png" alt="" className="h-full w-full rounded-full" />
      </span>
      <span className="text-[18px] font-semibold tracking-tight text-on-surface">Muhojir</span>
    </Link>
  );
}

function Count({ n, tone = "bg-secondary text-on-secondary" }) {
  if (!n) return null;
  return <span className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${tone}`}>{n}</span>;
}

export function LangSwitch() {
  const { user, setUser } = useAuth();
  const choose = async (next) => {
    if (next === lang) return;
    setLang(next);
    if (user) {
      const data = await api("/auth/profile/", { method: "PATCH", body: { language: next } }).catch(() => null);
      if (data) setUser(data);
    }
  };
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-container-low p-[3px] ring-1 ring-outline-variant" role="group" aria-label={t("Забон")}>
      {[
        ["tg", "TJ"],
        ["ru", "RU"],
      ].map(([code, name]) => (
        <button key={code} type="button" onClick={() => choose(code)} aria-pressed={lang === code} className={`flex h-7 w-8 items-center justify-center rounded-md text-[12px] font-semibold leading-none tracking-wide transition-colors ${lang === code ? "bg-ink text-on-ink shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
          {name}
        </button>
      ))}
    </div>
  );
}

function IconButton({ children, label, ...props }) {
  const Tag = props.to ? Link : "button";
  return (
    <Tag aria-label={label} title={label} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface" {...(Tag === "button" ? { type: "button" } : {})} {...props}>
      {children}
    </Tag>
  );
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <IconButton onClick={toggle} label={dark ? t("Мавзӯи равшан") : t("Мавзӯи торик")}>
      <AnimatePresence mode="wait" initial={false}>
        <m.span key={dark ? "sun" : "moon"} className="block" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </m.span>
      </AnimatePresence>
    </IconButton>
  );
}

function MoreMenu({ items, counts, user }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const active = items.some((i) => pathname.startsWith(i.to));
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`flex h-9 items-center gap-1 rounded-lg px-3 text-label-md transition-colors ${active || open ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}>
        {t("Боз")}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <m.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className="absolute left-0 top-11 z-50 grid w-[420px] grid-cols-2 gap-0.5 rounded-xl bg-surface-container-lowest p-1.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.18)] ring-1 ring-outline-variant">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-2.5 py-2 text-label-md transition-colors ${isActive ? "bg-primary-fixed text-on-primary-fixed" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-outline-variant">
                  <i.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex-1">{i.label}</span>
                {i.badge && <Count n={counts[i.badge]} />}
              </NavLink>
            ))}
            {canEdit(user) && (
              <a href="/admin/" className="col-span-2 mt-1 flex items-center gap-3 rounded-lg border-t border-outline-variant px-2.5 py-2.5 text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface">
                <PenSquare className="h-[18px] w-[18px]" aria-hidden />
                {t("Идораи мундариҷа")}
              </a>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuSheet({ open, onClose, items, counts, user }) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-[70] touch-none lg:hidden" role="dialog" aria-modal="true" aria-label={t("Ҳамаи бахшҳо")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onClose} />
          <m.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }} className="absolute inset-x-0 bottom-0 max-h-[88vh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-2xl bg-background p-5 ring-1 ring-outline-variant pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[18px] font-semibold">{t("Ҳамаи бахшҳо")}</span>
              <button type="button" onClick={onClose} aria-label={t("Пӯшидан")} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={onClose} className={({ isActive }) => `relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl p-2 text-center text-label-md ring-1 ${isActive ? "bg-ink text-on-ink ring-ink" : "bg-surface-container-lowest text-on-surface ring-outline-variant"}`}>
                  <i.icon className="h-6 w-6" aria-hidden />
                  <span className="leading-tight">{i.label}</span>
                  {i.badge && counts[i.badge] > 0 && <span className="absolute right-3 top-3"><Count n={counts[i.badge]} /></span>}
                </NavLink>
              ))}
            </div>
            <InstallMenuButton onDone={onClose} />
            <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant">
              <LangSwitch />
              <ThemeToggle />
              {canEdit(user) && (
                <a href="/admin/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-label-md text-on-surface ring-1 ring-outline-variant">
                  <PenSquare className="h-4 w-4" aria-hidden />
                  {t("Идора")}
                </a>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const items = sections(user);
  const [toast, setToast] = useState(null);
  const [sheet, setSheet] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);
  const counts = useCounters(user, setToast);
  const { pathname } = useLocation();
  const online = useOnline();
  const update = useAppUpdate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSheet(false);
  }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const firstName = user?.full_name?.trim().split(/\s+/)[0];
  const tabs = items.filter((i) => i.main);
  const more = items.filter((i) => !i.main && i.to !== "/login" && i.to !== "/profile" && i.to !== "/notifications");
  const dock = items.filter((i) => i.dock).sort((a, b) => a.dock - b.dock);

  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <SeasonFall className="absolute inset-0" density={0.35} />
      </div>
      <div className="fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-background" aria-hidden />
      <div className="flag-line fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 h-[3px]" aria-hidden />

      <header className={`fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3px)] z-40 transition-colors duration-300 ${scrolled ? "flag-border-b bg-background/80 backdrop-blur-xl" : "bg-background"}`}>
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 md:px-6">
          <Logo />
          <nav className="ml-6 hidden flex-1 items-center gap-0.5 lg:flex" aria-label={t("Менюи асосӣ")}>
            {tabs.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `relative flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-label-md transition-colors ${isActive ? "bg-primary-fixed text-on-primary-fixed" : "text-on-surface-variant hover:text-on-surface"}`}>
                {i.short || i.label}
                {i.badge && <Count n={counts[i.badge]} tone="bg-warning-fixed text-on-warning-fixed" />}
              </NavLink>
            ))}
            <MoreMenu items={more} counts={counts} user={user} />
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <InstallHeaderButton />
            <div className="hidden sm:block">
              <LangSwitch />
            </div>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            {user ? (
              <>
                <IconButton to="/notifications" label={t("Огоҳиҳо")}>
                  <Bell className="h-5 w-5" />
                  {counts.unread > 0 && (
                    <m.span key={counts.unread} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary ring-2 ring-background">
                      {counts.unread}
                    </m.span>
                  )}
                </IconButton>
                <Link
                  to="/profile"
                  aria-label={t("Профил ва танзимот")}
                  className="group flex items-center gap-2.5 rounded-full p-0.5 transition-colors hover:bg-surface-container-low sm:pr-1 xl:bg-surface-container-lowest xl:pr-3.5 xl:ring-1 xl:ring-outline-variant xl:hover:ring-primary/30"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#cc1a22_0deg_120deg,#ffffff_120deg_240deg,#167a32_240deg_360deg)] p-[3px] shadow-sm transition-transform duration-500 group-hover:rotate-[120deg]" aria-hidden>
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="h-full w-full rounded-full border-2 border-background object-cover transition-transform duration-500 group-hover:-rotate-[120deg]" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#172f73] to-[#1d4ed8] border-2 border-background text-[14px] font-semibold text-white transition-transform duration-500 group-hover:-rotate-[120deg] dark:from-[#1e3a8a] dark:to-[#2b59d9]">
                        {firstName ? firstName[0].toUpperCase() : <UserRound className="h-4 w-4" />}
                      </span>
                    )}
                  </span>
                  <span className="hidden min-w-0 flex-col leading-tight xl:flex">
                    <span className="max-w-[130px] truncate text-label-md text-on-surface">{firstName || t("Профил")}</span>
                    <span className="text-[11px] text-on-surface-variant">{t("Ҳисоби ман")}</span>
                  </span>
                </Link>
              </>
            ) : (
              <Link to="/login" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-3.5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
                <LogIn className="h-4 w-4" aria-hidden />
                {t("Ворид шудан")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-[1] flex min-h-screen flex-col pt-[calc(env(safe-area-inset-top)+67px)]">
        <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-4 md:px-6 md:pt-6 lg:pb-24">
          {update.ready && (
            <p role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-primary-fixed px-4 py-3 text-label-md text-on-primary-fixed">
              <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{t("Версияи нави сайт омад.")}</span>
              <button type="button" onClick={update.apply} className="rounded-lg bg-primary px-3 py-1.5 text-label-md text-on-primary hover:bg-primary/90">
                {t("Навсозӣ кардан")}
              </button>
            </p>
          )}
          {!online && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-warning-fixed px-4 py-3 text-label-md text-on-warning-fixed">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              {t("Интернет нест. Маълумоти охирини захирашуда нишон дода мешавад.")}
            </p>
          )}
          <Suspense fallback={<Skeleton className="h-64" />}>
            <PageTransition pageKey={pathname}>
              <Outlet />
            </PageTransition>
          </Suspense>
        </div>
        <Footer />
      </main>

      <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 mx-auto flex max-w-md items-center justify-between gap-1 rounded-2xl bg-surface-container-lowest/90 p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] ring-1 ring-outline-variant backdrop-blur-xl lg:hidden" aria-label={t("Менюи асосӣ")}>
        {dock.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium transition-colors ${isActive ? "bg-primary-fixed text-on-primary-fixed" : "text-on-surface-variant hover:text-on-surface"}`}>
            <i.icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate px-1">{i.short || i.label}</span>
            {i.badge && counts[i.badge] > 0 && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-warning-container ring-2 ring-surface-container-lowest" />}
          </NavLink>
        ))}
        <button type="button" onClick={() => setSheet(true)} className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium text-on-surface-variant hover:text-on-surface">
          <LayoutGrid className="h-5 w-5" aria-hidden />
          {t("Ҳама")}
        </button>
      </nav>
      <MenuSheet open={sheet} onClose={() => setSheet(false)} items={items} counts={counts} user={user} />

      <Assistant />
      <InstallBanner />
      <LiveToast notification={toast} onClose={closeToast} />
    </div>
  );
}
