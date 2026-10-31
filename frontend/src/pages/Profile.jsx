import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Bell, Bookmark, Building2, Camera, ChevronRight, Loader2, Trash2, Eye, EyeOff, FileText, Languages, LogOut, Mail, Moon, PenSquare, Phone,
  ReceiptText, Save, Sun, UserRound, Activity, BellPlus, BarChart3, CalendarDays, Clock, Flame, GraduationCap, MapPin, MessageSquare, PenLine,
  Plane, ShieldAlert, ShoppingBag, Sparkles, Star,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { lang, setLang, t } from "../i18n.js";
import { useApi } from "../hooks.js";
import { useTheme } from "../theme.js";
import PhoneApp from "../components/PhoneApp.jsx";
import { Button, ErrorBox, Field } from "../components/ui.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/motion.jsx";
import { Heatmap, ShareBars, StatCard, StatTile } from "../components/Stats.jsx";
import { ago, date, rub } from "../format.js";

const ROLE_NAMES = { editor: () => t("Муҳаррир"), admin: () => t("Админ") };

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (name.length <= 4) return `${name[0]}•••@${domain}`;
  return `${name.slice(0, 2)}${"•".repeat(Math.min(name.length - 4, 8))}${name.slice(-2)}@${domain}`;
}

function Avatar({ name, photo, size = "h-20 w-20 text-[30px] lg:h-28 lg:w-28 lg:text-[42px]" }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#cc1a22_0deg_120deg,#ffffff_120deg_240deg,#167a32_240deg_360deg)] p-[4px] shadow-lg ${size}`} aria-hidden>
      {photo ? (
        <img src={photo} alt="" className="h-full w-full rounded-full border-[3px] border-white object-cover dark:border-[#0b1533]" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#172f73] to-[#1d4ed8] border-[3px] border-white font-semibold text-white dark:border-[#0b1533] dark:from-[#1e3a8a] dark:to-[#2b59d9]">
          {name ? name[0].toUpperCase() : <UserRound className="h-1/2 w-1/2" />}
        </span>
      )}
    </span>
  );
}

async function squarePhoto(file, side = 512) {
  const image = await createImageBitmap(file);
  const crop = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  canvas.getContext("2d").drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, 0, 0, side, side);
  image.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
}

function AvatarPicker({ user, name, setUser }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = (await squarePhoto(file).catch(() => null)) || file;
      const body = new FormData();
      body.append("avatar", blob, "avatar.webp");
      setUser(await api("/auth/profile/avatar/", { method: "POST", body }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const remove = async () => {
    if (!window.confirm(t("Аксро нест кунем?"))) return;
    setBusy(true);
    try {
      setUser(await api("/auth/profile/avatar/", { method: "DELETE" }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={user.avatar ? t("Иваз кардани акс") : t("Илова кардани акс")} title={user.avatar ? t("Иваз кардани акс") : t("Илова кардани акс")} className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <Avatar name={name} photo={user.avatar} />
        <span className="absolute inset-[4px] flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-6 w-6 text-white" aria-hidden />
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1d4ed8] shadow-md ring-2 ring-[#1d4ed8]/20">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {user.avatar && !busy && (
        <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm text-white/80 hover:bg-white/10 hover:text-white">
          <Trash2 className="h-3 w-3" aria-hidden />
          {t("Нест кардан")}
        </button>
      )}
      {error && <span className="max-w-[120px] text-center text-label-sm text-white">{error.data?.avatar?.[0] || t("Акс бор нашуд")}</span>}
    </div>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-container-low p-1 ring-1 ring-inset ring-outline-variant">
      {options.map(({ value: v, label: text, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-label-md transition-all ${value === v ? "bg-surface-container-lowest text-primary shadow-sm ring-1 ring-primary/20" : "text-on-surface-variant hover:text-on-surface"}`}
        >
          {Icon && <Icon className="h-4 w-4" aria-hidden />}
          {text}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, title, text }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-[64px] w-full items-center gap-4 rounded-xl p-4 text-left ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
        <Bell className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label-lg">{title}</span>
        <span className="text-body-sm text-on-surface-variant">{text}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${checked ? "bg-primary" : "bg-surface-container-highest"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="card flex flex-col gap-5 p-5 md:p-7">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function IconInput({ icon: Icon, ...props }) {
  return (
    <span className="relative block">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant" aria-hidden />
      <input className="input pl-11" {...props} />
    </span>
  );
}

const SECTIONS = [
  ["documents", FileText, () => t("Ҳуҷҷатҳо")],
  ["payments", ReceiptText, () => t("Пардохтҳо")],
  ["lessons", GraduationCap, () => t("Дарсҳои забони русӣ")],
  ["exams", PenLine, () => t("Имтиҳонҳо")],
  ["saved_jobs", Bookmark, () => t("Кори захирашуда")],
  ["job_alerts", BellPlus, () => t("Огоҳии кори нав")],
  ["reviews", Star, () => t("Баҳо ва шарҳҳо")],
  ["blacklist_reports", ShieldAlert, () => t("Шикоят аз корфармо")],
  ["housing", Building2, () => t("Эълонҳои манзил")],
  ["places", MapPin, () => t("Ҷойҳои пешниҳодшуда")],
  ["shops", ShoppingBag, () => t("Мағозаҳо")],
  ["feedback", MessageSquare, () => t("Фикру мулоҳиза")],
  ["flights", Plane, () => t("Пайгирии чипта")],
];

const KIND = Object.fromEntries(SECTIONS.map(([key, icon, label]) => [key, { icon, label }]));

const merged = (source) => ({
  ...source,
  reviews: (source.place_reviews || 0) + (source.shop_reviews || 0) + (source.employer_reviews || 0),
});

function MyActivity() {
  const { data } = useApi("/auth/activity/");
  if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />;
  const totals = merged(data.totals);
  const share = SECTIONS.map(([key, icon, label]) => ({ key, icon, label: label(), count: totals[key] || 0 }))
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count);
  return (
    <section className="flex flex-col gap-3 lg:gap-4" aria-label={t("Фаъолияти шумо")}>
      <h2 className="flex items-center gap-2 px-1 text-[18px] font-semibold lg:text-[22px]">
        <Activity className="h-5 w-5 text-primary" aria-hidden />
        {t("Фаъолияти шумо")}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile icon={CalendarDays} value={data.member_days} label={t("Рӯз бо Muhojir")} />
        <StatTile icon={Sparkles} value={data.total} label={t("Ҳамаи амалҳо")} />
        <StatTile icon={Flame} accent="text-orange-500" value={data.streak} label={t("Рӯз пай дар пай")} hint={t("беҳтарин: {0}", data.best_streak)} />
        <StatTile icon={ReceiptText} value={rub(data.paid)} label={t("Пардохт сабт шуд")} hint={t("{0} чек", totals.payments)} />
      </div>
      <StatCard title={t("Рӯзҳои фаъол")} icon={CalendarDays} aside={t("{0} дар ин ҳафта", data.this_week)}>
        <Heatmap days={data.days} unit={t("амал")} />
      </StatCard>
      <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
        <StatCard title={t("Дар куҷо фаъол ҳастед")} icon={BarChart3}>
          {share.length ? <ShareBars items={share.slice(0, 6)} /> : <p className="text-body-sm text-on-surface-variant">{t("Ҳоло амал нест. Ҳуҷҷат илова кунед ё дарси аввалро хонед.")}</p>}
        </StatCard>
        <StatCard title={t("Охирин амалҳо")} icon={Clock}>
          {data.recent.length ? (
            <ol className="relative flex flex-col gap-3 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-outline-variant">
              {data.recent.map((r, i) => {
                const k = KIND[r.kind] || KIND.documents;
                return (
                  <li key={`${r.kind}-${r.at}-${i}`} className="relative">
                    <Link to={r.to} className="flex items-center gap-3 transition-colors hover:text-primary">
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary ring-1 ring-outline-variant">
                        <k.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-label-md">{r.title || k.label()}</span>
                        <span className="text-body-sm text-on-surface-variant">{r.title ? `${k.label()} · ` : ""}{ago(r.at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-body-sm text-on-surface-variant">{t("Ҳоло амал нест.")}</p>
          )}
        </StatCard>
      </div>
    </section>
  );
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { dark, setDark } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const docs = useApi("/documents/my-documents/?page_size=1");
  const savedJobs = useApi("/jobs/jobs/?saved=true&page_size=1");

  useEffect(() => {
    setForm({ full_name: user.full_name || "", phone: user.phone || "", city: user.city || "", language: user.language, email_reminders: user.email_reminders });
  }, [user]);

  if (!form) return null;
  const set = (key, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const data = await api("/auth/profile/", { method: "PATCH", body: { ...form, phone: form.phone.trim() || null } });
      setUser(data);
      setSaved(true);
      if (data.language !== lang) setLang(data.language);
    } catch (err) {
      if (err.status === 400 && err.data && !err.data.detail) setErrors(err.data);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  const name = user.full_name?.trim();
  const shortcuts = [
    { to: "/documents", icon: FileText, label: t("Ҳуҷҷатҳои ман"), count: docs.data?.count },
    { to: "/saved-jobs", icon: Bookmark, label: t("Захирашуда"), count: savedJobs.data?.count },
    { to: "/payments", icon: ReceiptText, label: t("Бойгонии чекҳо") },
    { to: "/notifications", icon: Bell, label: t("Огоҳиҳо") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] p-6 text-white shadow-[0_24px_60px_-28px_rgba(29,78,216,0.7)] md:p-8 lg:p-10 dark:from-[#0f1d4a] dark:via-[#132a66] dark:to-[#1a3a8a] dark:shadow-none dark:ring-1 dark:ring-white/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sky-300/20 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-5">
          <AvatarPicker user={user} name={name} setUser={setUser} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight md:text-[30px] lg:text-[38px]">{name || t("Номи худро нависед")}</h1>
            <div className="mt-1.5 flex min-w-0 items-center gap-2 text-body-md text-white/85">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{showEmail ? user.email : maskEmail(user.email)}</span>
              <button type="button" onClick={() => setShowEmail((v) => !v)} aria-label={showEmail ? t("Почтаро пинҳон кардан") : t("Почтаро нишон додан")} className="-m-2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white">
                {showEmail ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {user.role !== "migrant" && ROLE_NAMES[user.role] && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-label-sm text-white ring-1 ring-white/25">{ROLE_NAMES[user.role]()}</span>
              )}
              {user.date_joined && <span className="text-label-sm font-normal text-white/75">{t("Аз {0} бо мо", date(user.date_joined))}</span>}
            </div>
          </div>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map(({ to, icon: Icon, label, count }) => (
          <StaggerItem key={to}>
            <Link to={to} className="card group flex h-full flex-col gap-3 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:ring-primary/30">
              <span className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {count != null && <span className="text-[22px] font-semibold tabular-nums">{count}</span>}
              </span>
              <span className="flex items-center justify-between gap-1 text-label-md">
                {label}
                <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <MyActivity />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <Section title={t("Маълумоти шахсӣ")}>
          <Field label={t("Ному насаб")} error={errors.full_name}>
            <IconInput icon={UserRound} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" placeholder={t("Масалан: Алӣ Каримов")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("Телефон (ихтиёрӣ)")} error={errors.phone} hint={t("Ба касе нишон дода намешавад")}>
              <IconInput icon={Phone} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 999 123-45-67" autoComplete="tel" />
            </Field>
            <Field label={t("Шаҳр дар Русия")} error={errors.city}>
              <IconInput icon={Building2} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Масалан: Москва")} />
            </Field>
          </div>
        </Section>

        <Section title={t("Танзимот")}>
          <div className="flex flex-col gap-2">
            <span className="label flex items-center gap-2"><Languages className="h-4 w-4 text-primary" aria-hidden />{t("Забон")}</span>
            <Segmented
              label={t("Забон")}
              value={form.language}
              onChange={(v) => set("language", v)}
              options={[{ value: "tg", label: "Тоҷикӣ" }, { value: "ru", label: "Русский" }]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="label flex items-center gap-2">{dark ? <Moon className="h-4 w-4 text-primary" aria-hidden /> : <Sun className="h-4 w-4 text-primary" aria-hidden />}{t("Намуди сайт")}</span>
            <Segmented
              label={t("Намуди сайт")}
              value={dark ? "dark" : "light"}
              onChange={(v) => setDark(v === "dark")}
              options={[{ value: "light", label: t("Равшан"), icon: Sun }, { value: "dark", label: t("Торик"), icon: Moon }]}
            />
          </div>
          <Toggle checked={form.email_reminders} onChange={(v) => set("email_reminders", v)} title={t("Ёдраскунӣ ба почтаи электронӣ")} text={t("Пеш аз тамом шудани мӯҳлати ҳуҷҷатҳо")} />
        </Section>

        <div className="flex flex-col gap-4 lg:col-span-2">
        <ErrorBox error={error} />
        {saved && <p role="status" className="rounded-xl bg-tertiary-fixed p-4 text-label-md text-on-tertiary-fixed">{t("Сабт шуд")}</p>}
        <Button type="submit" icon={Save} loading={busy} className="min-h-[52px] w-full text-[16px] lg:ml-auto lg:w-auto lg:min-w-[280px] shadow-lg shadow-primary/25 dark:shadow-none">{t("Сабт кардан")}</Button>
        </div>
      </form>

      {(user.role === "editor" || user.role === "admin") && (
        <a href="/admin/" className="card group flex items-center gap-4 p-5 transition-colors hover:ring-primary/30 md:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
            <PenSquare className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[17px] font-semibold">{t("Идораи мундариҷа")}</span>
            <span className="text-body-sm text-on-surface-variant">
              {user.role === "editor" ? t("Хабарҳо, роҳнамоҳо, саволҳои имтиҳон, сайтҳои ёрӣ, марказҳо ва нархҳои патент.") : t("Ҳамаи қисмҳои сайт, корбарон ва нақшҳо.")}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1" aria-hidden />
        </a>
      )}
      <PhoneApp />
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate("/");
        }}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl text-label-lg text-error ring-1 ring-inset ring-error/30 transition-colors hover:bg-error-container"
      >
        <LogOut className="h-5 w-5" aria-hidden />
        {t("Баромадан")}
      </button>
    </div>
  );
}
