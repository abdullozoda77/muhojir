import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell, BookOpen, Bookmark, Briefcase, Calculator, ChevronDown, GraduationCap, Home, LayoutGrid, LifeBuoy, LogIn, MapPinned, Moon,
  PenSquare, Plane, ReceiptText, SearchCheck, Settings, ShieldCheck, Sun, WifiOff, X,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { api, apiAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import { lang, setLang, t } from "../i18n.js";
import { useTheme } from "../theme.js";
import { useOnline } from "../pwa.js";
import { useLiveNotifications } from "../live.js";
import Footer from "./Footer.jsx";
import LiveToast from "./LiveToast.jsx";
import Assistant from "./Assistant.jsx";
import { PageTransition } from "./motion.jsx";
import { Skeleton } from "./ui.jsx";

// The site's shell: the flag line on top, a light bar with the main sections and "More", the page, the footer.
// Phones: a slim bar on top and a floating dock at the bottom; its last button opens every section.

// Every section. main: shown as a tab in the top bar; dock: on the phone dock (in this order).
function sections(user) {
  const all = [
    { to: "/", icon: Home, label: t("Асосӣ"), end: true, main: true, dock: 1 },
    user && { to: "/documents", icon: ShieldCheck, label: t("Ҳуҷҷатҳои ман"), short: t("Ҳуҷҷатҳо"), badge: "docs", main: true, dock: 2 },
    { to: "/jobs", icon: Briefcase, label: t("Ҷойи кор"), short: t("Кор"), main: true, dock: user ? 3 : 2 },
    { to: "/tickets", icon: Plane, label: t("Чиптаҳо"), main: true, dock: user ? null : 3 },
    { to: "/places", icon: MapPinned, label: t("Ҷойҳо"), main: true, dock: 4 },
    { to: "/calculator", icon: Calculator, label: t("Нархи патент"), main: true },
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

// Counters: unread notifications and documents that need attention (ending soon or expired).
function useCounters(user, onNew) {
  const [counts, setCounts] = useState({ unread: 0, docs: 0 });
  const { pathname } = useLocation();
  // New notifications and read ones in other tabs arrive over the WebSocket, so the bell is always current.
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
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-0.5 shadow-[0_4px_14px_-4px_rgb(16_38_92/0.35)] ring-1 ring-outline-variant/60">
        <img src="/logo.png" alt="" className="h-full w-full" />
      </span>
      <span className="font-display text-[21px] font-extrabold tracking-tight text-navy dark:text-on-surface">Muhojir</span>
    </Link>
  );
}

function Count({ n, tone = "bg-secondary text-on-secondary" }) {
  if (!n) return null;
  return <span className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${tone}`}>{n}</span>;
}

function LangSwitch() {
  const { user } = useAuth();
  const choose = async (next) => {
    if (next === lang) return;
    // Remember it in the profile too, so emails come in the same language.
    if (user) await api("/auth/profile/", { method: "PATCH", body: { language: next } }).catch(() => {});
    setLang(next);
  };
  return (
    <div className="inline-flex items-center rounded-full bg-surface-container-low p-1 ring-1 ring-outline-variant/60" role="group" aria-label={t("Забон")}>
      {[
        ["tg", "ТҶ"],
        ["ru", "РУ"],
      ].map(([code, name]) => (
        <button key={code} type="button" onClick={() => choose(code)} aria-pressed={lang === code} className={`rounded-full px-2.5 py-1 text-label-md transition-all ${lang === code ? "bg-navy text-white shadow-sm dark:bg-primary dark:text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}>
          {name}
        </button>
      ))}
    </div>
  );
}

function IconButton({ children, label, ...props }) {
  const Tag = props.to ? Link : "button";
  return (
    <Tag aria-label={label} title={label} className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface" {...(Tag === "button" ? { type: "button" } : {})} {...props}>
      {children}
    </Tag>
  );
}

function ThemeToggle() {
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

// "More": the sections that are not tabs, in a panel under the button.
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
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`flex h-10 items-center gap-1 rounded-full px-4 text-label-lg transition-colors ${active || open ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
        {t("Боз")}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <m.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className="absolute left-0 top-12 z-50 grid w-[440px] grid-cols-2 gap-1 rounded-[24px] bg-surface-container-lowest p-2 shadow-[0_24px_60px_-20px_rgb(16_38_92/0.35)] ring-1 ring-outline-variant/60">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-label-lg transition-colors ${isActive ? "bg-primary-fixed text-on-primary-fixed" : "hover:bg-surface-container-low"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                  <i.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="flex-1">{i.label}</span>
                {i.badge && <Count n={counts[i.badge]} />}
              </NavLink>
            ))}
            {canEdit(user) && (
              <a href="/admin/" className="col-span-2 flex items-center gap-3 rounded-2xl bg-navy px-3 py-2.5 text-label-lg text-white hover:brightness-110">
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

// Phones: every section as big tiles in a sheet from the bottom.
function MenuSheet({ open, onClose, items, counts, user }) {
  return (
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
          <m.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }} className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[32px] bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[22px] font-extrabold">{t("Ҳамаи бахшҳо")}</span>
              <button type="button" onClick={onClose} aria-label={t("Пӯшидан")} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={onClose} className={({ isActive }) => `relative flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[22px] p-2 text-center text-label-md ${isActive ? "bg-navy text-white" : "bg-surface-container-lowest ring-1 ring-outline-variant/60"}`}>
                  <i.icon className="h-6 w-6" aria-hidden />
                  <span className="leading-tight">{i.label}</span>
                  {i.badge && counts[i.badge] > 0 && <span className="absolute right-3 top-3"><Count n={counts[i.badge]} /></span>}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[22px] bg-surface-container-lowest p-3 ring-1 ring-outline-variant/60">
              <LangSwitch />
              <ThemeToggle />
              {canEdit(user) && (
                <a href="/admin/" className="flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-label-md text-white">
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

  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0];
  const tabs = items.filter((i) => i.main);
  const more = items.filter((i) => !i.main && i.to !== "/login" && i.to !== "/profile" && i.to !== "/notifications");
  const dock = items.filter((i) => i.dock).sort((a, b) => a.dock - b.dock);

  return (
    <div className="min-h-screen">
      {/* The flag line of Tajikistan: red, white, green. */}
      <div className="flag-line fixed inset-x-0 top-0 z-50 h-[5px]" aria-hidden />

      <header className={`fixed inset-x-0 top-[5px] z-40 transition-all duration-300 ${scrolled ? "bg-background/85 shadow-[0_8px_30px_-18px_rgb(16_38_92/0.35)] backdrop-blur-xl" : "bg-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 md:px-6 lg:h-[72px]">
          <Logo />
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex" aria-label={t("Менюи асосӣ")}>
            {tabs.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `relative flex h-10 items-center gap-2 rounded-full px-4 text-label-lg transition-colors ${isActive ? "bg-navy text-white shadow-[0_6px_16px_-8px_rgb(16_38_92/0.8)] dark:bg-primary dark:text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
                {i.short || i.label}
                {i.badge && <Count n={counts[i.badge]} tone="bg-warning-container text-on-warning-container" />}
              </NavLink>
            ))}
            <MoreMenu items={more} counts={counts} user={user} />
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
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
                    <m.span key={counts.unread} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-on-secondary">
                      {counts.unread}
                    </m.span>
                  )}
                </IconButton>
                <Link to="/profile" className="flex items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-surface-container-low sm:pr-3" aria-label={t("Профил ва танзимот")}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-navy text-label-lg font-bold text-white" aria-hidden>
                    {(firstName || "?")[0].toUpperCase()}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-label-md xl:block">{firstName}</span>
                </Link>
              </>
            ) : (
              <Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-label-md text-on-secondary shadow-[0_8px_18px_-8px_rgb(var(--c-secondary)/0.8)] hover:bg-secondary-container">
                <LogIn className="h-4 w-4" aria-hidden />
                {t("Ворид шудан")}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* The footer stays at the bottom even on short pages; on phones the page ends above the dock. */}
      <main className="flex min-h-screen flex-col pt-[69px] lg:pt-[77px]">
        <div className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-14 pt-4 md:px-6 md:pt-6 lg:pb-16">
          {!online && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-full bg-warning-fixed px-4 py-3 text-label-md text-on-warning-fixed">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              {t("Интернет нест. Маълумоти охирини захирашуда нишон дода мешавад.")}
            </p>
          )}
          {/* A page that is still downloading shows a placeholder; the bar stays. */}
          <Suspense fallback={<Skeleton className="h-64" />}>
            <PageTransition pageKey={pathname}>
              <Outlet />
            </PageTransition>
          </Suspense>
        </div>
        <Footer />
      </main>

      {/* Phones and tablets: the floating dock. */}
      <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 mx-auto flex max-w-md items-center justify-between gap-1 rounded-[28px] bg-navy/95 p-1.5 shadow-[0_18px_40px_-14px_rgb(16_38_92/0.7)] backdrop-blur-xl lg:hidden" aria-label={t("Менюи асосӣ")}>
        {dock.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-semibold transition-colors ${isActive ? "bg-white text-navy" : "text-white/75 hover:text-white"}`}>
            <i.icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate px-1">{i.short || i.label}</span>
            {i.badge && counts[i.badge] > 0 && <span className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-navy" />}
          </NavLink>
        ))}
        <button type="button" onClick={() => setSheet(true)} className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-semibold text-white/75 hover:text-white">
          <LayoutGrid className="h-5 w-5" aria-hidden />
          {t("Ҳама")}
        </button>
      </nav>
      <MenuSheet open={sheet} onClose={() => setSheet(false)} items={items} counts={counts} user={user} />

      <Assistant />
      <LiveToast notification={toast} onClose={closeToast} />
    </div>
  );
}
