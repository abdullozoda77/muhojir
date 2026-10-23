import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BellRing, BookOpen, Briefcase, Calculator, CalendarClock, Clock, FilePlus2, GraduationCap, MapPinned,
  Newspaper, Plane, Plus, SearchCheck, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useApi, useDocuments } from "../hooks.js";
import { t } from "../i18n.js";
import { date, num, todayTitle, usedPercent } from "../format.js";
import { JobRow } from "../components/JobCard.jsx";
import { Emblem, FlagShowcase, WavingFlag } from "../components/Pattern.jsx";
import { STATUS, Skeleton, statusText } from "../components/ui.jsx";
import { CountUp, EASE, Stagger, StaggerItem, m, startShown } from "../components/motion.jsx";

// The home page. Guests: the hero with the flag and the road home, live numbers, every service as a tile, how it
// works, fresh jobs and law news. Logged in: a greeting with the nearest deadline, the documents, the services.

// --- Pieces ---------------------------------------------------------------------------------------------------

// The dark-blue stage of the hero: the text on the left, the flag of Tajikistan floating on the right.
function HeroStage({ children }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[36px] bg-navy text-white shadow-[0_40px_80px_-40px_rgb(16_38_92/0.9)] md:rounded-[44px]">
      <div aria-hidden className="absolute -left-24 -top-24 -z-10 h-96 w-96 rounded-full bg-primary-container/45 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 right-0 -z-10 h-96 w-[640px] rounded-full bg-[#197b30]/25 blur-3xl" />
      <div aria-hidden className="absolute -right-10 -top-24 -z-10 h-80 w-[520px] rounded-full bg-[#dc161d]/20 blur-3xl" />
      <div className="flag-line absolute inset-x-0 bottom-0 h-[6px]" />
      <div className="grid items-center gap-10 p-6 sm:p-10 xl:grid-cols-[1.15fr_1fr] xl:p-14">
        {children}
        <div className="hidden px-4 md:block">
          <FlagShowcase />
        </div>
      </div>
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3.5 text-label-md text-white ring-1 ring-white/20 backdrop-blur">
      <Emblem className="h-4 w-6" />
      {children}
    </span>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-[30px] font-extrabold leading-none md:text-[36px]">{value ?? "—"}</span>
      <span className="mt-1 text-body-sm text-white/70">{label}</span>
    </div>
  );
}

// Every service as a tile. The first is big and dark; the others light, each with its own accent.
const SERVICES = [
  { to: "/calculator", icon: Calculator, title: () => t("Нархи патент"), text: () => t("Барои ҳамаи 83 минтақаи Русия, соли 2026 — ва маблағ барои 1–12 моҳ."), big: true },
  { to: "/jobs", icon: Briefcase, title: () => t("Ҷойи кор"), text: () => t("Вакансияҳои воқеӣ аз «Работа России» бо суроға."), tone: "bg-primary-fixed text-on-primary-fixed" },
  { to: "/tickets", icon: Plane, title: () => t("Чиптаҳо"), text: () => t("Тоҷикистон ⇄ Русия, арзонтарин рӯзҳо."), tone: "bg-secondary-fixed text-on-secondary-fixed" },
  { to: "/places", icon: MapPinned, title: () => t("Ҷойҳо дар харита"), text: () => t("Марказҳои муҳоҷират, масҷид, сафорат, ошхона."), tone: "bg-tertiary-fixed text-on-tertiary-fixed" },
  { to: "/guides", icon: BookOpen, title: () => t("Роҳнамо"), text: () => t("Қадам ба қадам: куҷо равед, чӣ баред."), tone: "bg-warning-fixed text-on-warning-fixed" },
  { to: "/exam", icon: GraduationCap, title: () => t("Имтиҳон"), text: () => t("100 саволи машқӣ бо шарҳ."), tone: "bg-surface-container-high text-on-surface" },
  { to: "/checks", icon: SearchCheck, title: () => t("Санҷиши ҳуҷҷатҳо"), text: () => t("Патент, манъи даромадан, қарз."), tone: "bg-surface-container-high text-on-surface" },
];

function ServicesGrid() {
  return (
    <section className="flex flex-col gap-5">
      <SectionTitle kicker={t("Хизматҳо")} title={t("Ҳар чизе ки дар Русия лозим аст")} />
      <Stagger className="grid auto-rows-[minmax(150px,auto)] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {SERVICES.map((s) => (
          <StaggerItem key={s.to} className={s.big ? "col-span-2 row-span-2" : ""}>
            {s.big ? (
              <Link to={s.to} className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[32px] bg-navy p-7 text-white shadow-[0_24px_50px_-28px_rgb(16_38_92/0.9)] md:p-9">
                <WavingFlag className="absolute -right-24 bottom-0 h-48 w-[420px] opacity-25 transition-opacity duration-500 group-hover:opacity-40" />
                <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/10 ring-1 ring-white/20">
                  <s.icon className="h-7 w-7" aria-hidden />
                </span>
                <span className="relative flex flex-col gap-3">
                  <span className="font-display text-[34px] font-extrabold leading-[1.05] md:text-[44px]">{s.title()}</span>
                  <span className="max-w-sm text-body-lg text-white/75">{s.text()}</span>
                  <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-5 py-3 text-label-lg text-on-secondary transition-transform group-hover:translate-x-1">
                    {t("Ҳисоб кардан")}
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </span>
                </span>
              </Link>
            ) : (
              <Link to={s.to} className="group flex h-full flex-col justify-between gap-4 rounded-[28px] bg-surface-container-lowest p-5 ring-1 ring-outline-variant/60 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgb(16_38_92/0.45)] md:p-6">
                <span className="flex items-start justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}>
                    <s.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-outline transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-display text-[19px] font-bold leading-tight">{s.title()}</span>
                  <span className="text-body-sm text-on-surface-variant">{s.text()}</span>
                </span>
              </Link>
            )}
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function SectionTitle({ kicker, title, to, linkText }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        {kicker && <span className="text-label-md uppercase tracking-[0.16em] text-secondary">{kicker}</span>}
        <h2 className="font-display text-[26px] font-extrabold leading-tight text-navy dark:text-on-surface md:text-[34px]">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-label-lg text-primary ring-1 ring-outline-variant transition-colors hover:bg-surface-container-lowest">
          {linkText}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    [FilePlus2, t("Ҳуҷҷатҳоро илова кунед"), t("Патент, бақайдгирӣ, корти муҳоҷиратӣ — бо санаи тамомшавӣ.")],
    [BellRing, t("Ёдраскунӣ гиред"), t("Пеш аз тамом шудани мӯҳлат ба почта ва дар сайт хабар меояд.")],
    [ShieldCheck, t("Ором кор кунед"), t("Ҷарима ва бекор шудани патент — на барои шумо.")],
  ];
  return (
    <section className="grid gap-4 rounded-[36px] bg-surface-container-lowest p-6 ring-1 ring-outline-variant/60 md:grid-cols-[1fr_2fr] md:p-10">
      <div className="flex flex-col gap-3">
        <span className="text-label-md uppercase tracking-[0.16em] text-secondary">{t("Чӣ тавр кор мекунад")}</span>
        <h2 className="font-display text-[28px] font-extrabold leading-tight text-navy dark:text-on-surface md:text-[36px]">{t("Се қадам то оромӣ")}</h2>
        <Link to="/login" className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-navy px-5 py-3 text-label-lg text-white dark:bg-primary dark:text-on-primary">
          {t("Оғоз кардан — бепул")}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map(([Icon, title, text], i) => (
          <li key={title} className="relative flex flex-col gap-3 rounded-[26px] bg-background p-5">
            <span className="font-display text-[44px] font-extrabold leading-none text-outline-variant">0{i + 1}</span>
            <Icon className="h-6 w-6 text-primary" aria-hidden />
            <span className="font-display text-[18px] font-bold leading-tight">{title}</span>
            <span className="text-body-sm text-on-surface-variant">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Newest jobs in the user's city (or anywhere, when there are none there).
function JobsPanel({ city }) {
  const cityJobs = useApi(city ? `/jobs/jobs/?city=${encodeURIComponent(city)}&page_size=4` : null);
  const anyJobs = useApi(!city || (cityJobs.data && cityJobs.data.count === 0) ? "/jobs/jobs/?page_size=4" : null);
  const jobs = cityJobs.data?.count ? cityJobs.data : anyJobs.data;
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle kicker={t("Кор")} title={cityJobs.data?.count ? t("Кори нав дар {0}", city) : t("Ҷойҳои кории нав")} to="/jobs" linkText={t("Ҳама")} />
      <div className="rounded-[32px] bg-surface-container-lowest p-2 ring-1 ring-outline-variant/60 md:p-3">
        {cityJobs.loading || anyJobs.loading ? (
          <Skeleton className="h-60" />
        ) : jobs?.results?.length ? (
          <Stagger className="flex flex-col divide-y divide-outline-variant/50">
            {jobs.results.map((job) => (
              <StaggerItem key={job.id}>
                <JobRow job={job} compact />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <p className="px-4 py-8 text-body-md text-on-surface-variant">{t("Ҳоло эълони кор нест. Ба наздикӣ илова мешавад.")}</p>
        )}
      </div>
    </section>
  );
}

function NewsPanel() {
  const news = useApi("/documents/news/?page_size=3");
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle kicker={t("Қонун")} title={t("Хабарҳо")} to="/guides#news" linkText={t("Ҳама")} />
      <div className="flex flex-col gap-3">
        {news.loading && <Skeleton className="h-60" />}
        {news.data?.results?.map((n, i) => (
          <Link key={n.id} to={`/news/${n.id}`} className={`group flex flex-col gap-2 rounded-[26px] p-5 transition-all hover:-translate-y-0.5 ${i === 0 ? "bg-secondary text-on-secondary" : "bg-surface-container-lowest ring-1 ring-outline-variant/60"}`}>
            <span className={`inline-flex items-center gap-1.5 text-label-sm uppercase ${i === 0 ? "text-white/80" : "text-secondary"}`}>
              <Newspaper className="h-3.5 w-3.5" aria-hidden />
              {date(n.published_at || n.created_at)}
            </span>
            <span className="font-display text-[17px] font-bold leading-snug">{n.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Ring({ days, pct, tone, size = 120 }) {
  const stroke = 12;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/15" />
        <m.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={startShown() ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - (pct ?? 100) / 100) }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} className={tone} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[36px] font-extrabold leading-none"><CountUp value={Math.abs(days)} /></span>
        <span className="mt-1 text-body-sm text-white/70">{days < 0 ? t("рӯз пеш") : t("рӯз монд")}</span>
      </div>
    </div>
  );
}

const RING_TONE = { expired: "text-[#ff8a8a]", expiring: "text-gold", valid: "text-[#6fe39a]" };
const DOT = { expired: "bg-error", expiring: "bg-warning-container", valid: "bg-tertiary-container" };

function DocTile({ doc }) {
  return (
    <Link to="/documents" className="group flex h-full flex-col justify-between gap-4 rounded-[26px] bg-surface-container-lowest p-5 ring-1 ring-outline-variant/60 transition-all hover:-translate-y-0.5">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[doc.status]}`} />
        <span className={`text-label-md ${STATUS[doc.status].accent}`}>{statusText(doc)}</span>
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-[18px] font-bold leading-tight">{t(doc.document_type_title)}</span>
        <span className="text-body-sm text-on-surface-variant">{t("то {0}", date(doc.expires_at))}</span>
      </span>
    </Link>
  );
}

// --- Pages ----------------------------------------------------------------------------------------------------

function GuestHome() {
  const jobs = useApi("/jobs/jobs/?page_size=1");
  const regions = useApi("/documents/regions/?page_size=1");
  const places = useApi("/places/summary/");
  const placesCount = places.data ? Object.values(places.data.categories).reduce((a, b) => a + b, 0) : null;
  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <HeroStage>
        <div className="flex flex-col gap-6">
          <Eyebrow>{t("Барои муҳоҷирони тоҷик дар Русия")}</Eyebrow>
          <h1 className="font-display text-[44px] font-black leading-[0.98] tracking-tight md:text-[72px]">
            {t("Ҳуҷҷатҳо сари вақт.")}
            <br />
            <span className="bg-gradient-to-r from-gold to-[#ffe2a3] bg-clip-text text-transparent">{t("Кори боэътимод.")}</span>
          </h1>
          <p className="max-w-xl text-body-lg text-white/80 md:text-[19px] md:leading-8">
            {t("Мӯҳлати патент ва бақайдгириро фаромӯш накунед, нархи патентро ҳисоб кунед ва ҷойҳои кори воқеиро аз сайти давлатӣ ёбед. Ҳамааш бепул ва бо забони тоҷикӣ.")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-secondary px-7 text-label-lg text-on-secondary shadow-[0_14px_30px_-12px_rgb(var(--c-secondary)/0.9)] transition-transform hover:-translate-y-0.5">
              {t("Оғоз кардан — бепул")}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link to="/jobs" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-white/10 px-7 text-label-lg ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/20">
              <Briefcase className="h-5 w-5" aria-hidden />
              {t("Кор ҷустан")}
            </Link>
          </div>
          <div className="mt-2 grid max-w-xl grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <Stat value={jobs.data ? num(jobs.data.count) : null} label={t("ҷойи кори фаъол")} />
            <Stat value={regions.data?.count} label={t("минтақа бо нархи патент")} />
            <Stat value={placesCount ? num(placesCount) : null} label={t("ҷойи муфид дар харита")} />
          </div>
        </div>
      </HeroStage>

      <ServicesGrid />
      <HowItWorks />
      <div className="grid items-start gap-8 xl:grid-cols-[1.6fr_1fr]">
        <JobsPanel />
        <NewsPanel />
      </div>
    </div>
  );
}

function MigrantHome({ user }) {
  const { docs, types, loading } = useDocuments();
  const order = { expired: 0, expiring: 1, valid: 2 };
  const sorted = [...docs].sort((a, b) => order[a.status] - order[b.status] || a.expires_at.localeCompare(b.expires_at));
  const next = sorted[0];
  const firstName = user.full_name?.split(" ")[0];
  const needAttention = docs.filter((d) => d.status !== "valid").length;
  const isPatent = next && /patent/.test(types.find((x) => x.id === next.document_type)?.slug || "");

  const summary = loading
    ? ""
    : needAttention
      ? t("{0} ҳуҷҷат диққати шуморо талаб мекунад.", needAttention)
      : docs.length
        ? t("Ҳамаи ҳуҷҷатҳо тартиб аст. Мо пеш аз мӯҳлат хабар медиҳем.")
        : t("Ҳуҷҷатҳои худро илова кунед — мо мӯҳлатҳоро назорат мекунем.");

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <HeroStage>
        <div className="flex flex-col gap-5">
          <Eyebrow>{todayTitle()}</Eyebrow>
          <h1 className="font-display text-[40px] font-black leading-[1] tracking-tight md:text-[60px]">{firstName ? t("Салом, {0}!", firstName) : t("Салом!")}</h1>
          <p className="max-w-lg text-body-lg text-white/80 md:text-[19px]">{summary}</p>
          <div className="flex flex-wrap gap-3">
            {isPatent && (
              <Link to={`/documents?pay=${next.id}`} className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-secondary px-6 text-label-lg text-on-secondary shadow-[0_14px_30px_-12px_rgb(var(--c-secondary)/0.9)]">
                <Wallet className="h-5 w-5" aria-hidden />
                {t("Пардохтро сабт кардан")}
              </Link>
            )}
            <Link to="/documents" className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-white/10 px-6 text-label-lg ring-1 ring-white/30 hover:bg-white/20">
              {docs.length ? t("Ҳамаи ҳуҷҷатҳо") : t("Ҳуҷҷат илова кардан")}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-56 bg-white/10" />
          ) : next ? (
            <Link to="/documents" className="flex items-center gap-6 rounded-[32px] bg-white/[0.08] p-5 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.12] md:p-6">
              <Ring days={next.days_left} pct={usedPercent(next)} tone={RING_TONE[next.status]} />
              <span className="flex min-w-0 flex-col gap-2">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-label-md">
                  <Clock className="h-4 w-4" aria-hidden />
                  {next.status === "expired" ? t("Мӯҳлат гузашт") : t("Мӯҳлати наздиктарин")}
                </span>
                <span className="font-display text-[26px] font-extrabold leading-tight md:text-[30px]">{t(next.document_type_title)}</span>
                <span className="text-body-sm text-white/70">{[next.region_name, t("то {0}", date(next.expires_at))].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
          ) : (
            <Link to="/documents" className="flex items-center gap-5 rounded-[32px] bg-white/[0.08] p-6 ring-1 ring-white/15 backdrop-blur-md md:p-8">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-secondary">
                <FilePlus2 className="h-8 w-8" aria-hidden />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-display text-[22px] font-extrabold leading-tight">{t("Ҳуҷҷати аввалини худро илова кунед")}</span>
                <span className="text-body-sm text-white/70">{t("Мо пеш аз тамом шудани мӯҳлат ба почтаи шумо ёдрас мекунем.")}</span>
              </span>
            </Link>
          )}
        </div>
      </HeroStage>

      {docs.length > 1 && (
        <section className="flex flex-col gap-5">
          <SectionTitle kicker={t("Ҳуҷҷатҳо")} title={t("Ҳолати ҳуҷҷатҳо")} to="/documents" linkText={t("Ҳама")} />
          <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {sorted.slice(1, 4).map((d) => (
              <StaggerItem key={d.id}>
                <DocTile doc={d} />
              </StaggerItem>
            ))}
            <StaggerItem>
              <Link to="/documents" className="flex h-full min-h-[130px] flex-col items-center justify-center gap-2 rounded-[26px] border-2 border-dashed border-outline-variant p-5 text-center text-label-lg text-primary hover:bg-surface-container-lowest">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-fixed">
                  <Plus className="h-5 w-5" aria-hidden />
                </span>
                {t("Ҳуҷҷат илова кардан")}
              </Link>
            </StaggerItem>
          </Stagger>
        </section>
      )}

      <ServicesGrid />
      <div className="grid items-start gap-8 xl:grid-cols-[1.6fr_1fr]">
        <JobsPanel city={user.city} />
        <NewsPanel />
      </div>
      <Link to="/exam" className="group flex flex-col items-start justify-between gap-4 rounded-[32px] bg-gradient-to-r from-primary to-navy p-7 text-white md:flex-row md:items-center md:p-9">
        <span className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/10 ring-1 ring-white/20">
            <Sparkles className="h-7 w-7" aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="font-display text-[24px] font-extrabold leading-tight">{t("Ба имтиҳон омода шавед")}</span>
            <span className="text-body-md text-white/75">{t("Забони русӣ, таърих ва қонун — 100 савол бо шарҳ.")}</span>
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-label-lg text-navy transition-transform group-hover:translate-x-1">
          <CalendarClock className="h-5 w-5" aria-hidden />
          {t("Машқ кардан")}
        </span>
      </Link>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Skeleton className="h-96" />;
  if (!user) return <GuestHome />;
  return <MigrantHome user={user} />;
}
