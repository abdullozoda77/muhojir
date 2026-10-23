import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BellRing, BookOpen, Briefcase, Calculator, CalendarClock, Clock, FilePlus2, GraduationCap, MapPinned,
  Plane, Plus, SearchCheck, ShieldCheck, Wallet,
} from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useApi, useDocuments } from "../hooks.js";
import { t } from "../i18n.js";
import { date, num, todayTitle, usedPercent } from "../format.js";
import { JobRow } from "../components/JobCard.jsx";
import { Emblem } from "../components/Pattern.jsx";
import { STATUS, Skeleton, statusText } from "../components/ui.jsx";
import { CountUp, EASE, Intro, IntroItem, Reveal, Stagger, StaggerItem, m, startShown } from "../components/motion.jsx";

// The home page. Guests: the headline, live numbers, every service as a tile, how it works, fresh jobs and law
// news. Logged in: a greeting with the nearest deadline, the documents, the services.

// --- Pieces ---------------------------------------------------------------------------------------------------

// The hero: plain, on the page. The text on the left, a quiet panel on the right (wide screens).
function HeroStage({ children, aside }) {
  return (
    <section className="grid grid-cols-1 items-center gap-10 pt-6 md:pt-14 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:gap-16">
      {children}
      <m.div initial={startShown() ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}>
        {aside}
      </m.div>
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-container-lowest py-1 pl-1.5 pr-3 text-label-md text-on-surface-variant ring-1 ring-outline-variant">
      <Emblem className="h-3 w-[18px]" />
      {children}
    </span>
  );
}

// value: a number; it counts up once it has loaded.
// The three numbers in the colors of the flag of Tajikistan in the light theme: red, white (wider), green.
// At night the rows stay dark and keep only a thin stripe of their color on the left.
const STAT_TONES = {
  red: { row: "bg-[#cc1a22] text-white dark:bg-transparent dark:text-on-surface", label: "text-white/85 dark:text-on-surface-variant", bar: "dark:bg-[#e2343b]" },
  white: { row: "bg-white py-7 text-on-surface dark:bg-transparent dark:py-5", label: "text-on-surface-variant", bar: "dark:bg-white" },
  green: { row: "bg-[#167a32] text-white dark:bg-transparent dark:text-on-surface", label: "text-white/85 dark:text-on-surface-variant", bar: "dark:bg-[#2fa652]" },
};

const statRow = {
  hidden: { opacity: 0, x: -28 },
  shown: { opacity: 1, x: 0, transition: { duration: 0.55, ease: EASE } },
};

function Stat({ value, label, tone }) {
  const c = STAT_TONES[tone];
  return (
    <m.div variants={statRow} className={`group relative flex items-baseline justify-between gap-4 px-6 py-5 transition-[filter] duration-300 hover:brightness-110 ${c.row}`}>
      <span aria-hidden className={`absolute inset-y-3 left-0 hidden w-[3px] rounded-r-full dark:block ${c.bar}`} />
      <span className={`text-body-md font-medium ${c.label}`}>{label}</span>
      <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums transition-transform duration-300 ease-out group-hover:scale-110">
        {value == null ? "—" : <CountUp value={value} duration={1.6} format={num} />}
      </span>
    </m.div>
  );
}

const btnInk = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-ink px-6 text-label-lg text-on-ink transition-colors hover:bg-ink/90";
const btnPlain = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-6 text-label-lg text-on-surface ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low";
const tile = "group flex h-full flex-col justify-between gap-6 rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)] hover:ring-outline/50 md:p-6";

// Every service as a tile, all alike; the calculator is twice as wide.
const SERVICES = [
  { to: "/calculator", icon: Calculator, title: () => t("Нархи патент"), text: () => t("Барои ҳамаи 83 минтақаи Русия, соли 2026 — ва маблағ барои 1–12 моҳ."), big: true },
  { to: "/jobs", icon: Briefcase, title: () => t("Ҷойи кор"), text: () => t("Вакансияҳои воқеӣ аз «Работа России» бо суроға.") },
  { to: "/tickets", icon: Plane, title: () => t("Чиптаҳо"), text: () => t("Тоҷикистон ⇄ Русия, арзонтарин рӯзҳо.") },
  { to: "/places", icon: MapPinned, title: () => t("Ҷойҳо дар харита"), text: () => t("Марказҳои муҳоҷират, масҷид, сафорат, ошхона.") },
  { to: "/guides", icon: BookOpen, title: () => t("Роҳнамо"), text: () => t("Қадам ба қадам: куҷо равед, чӣ баред.") },
  { to: "/exam", icon: GraduationCap, title: () => t("Имтиҳон"), text: () => t("100 саволи машқӣ бо шарҳ.") },
  { to: "/checks", icon: SearchCheck, title: () => t("Санҷиши ҳуҷҷатҳо"), text: () => t("Патент, манъи даромадан, қарз.") },
];

function TileIcon({ icon: Icon }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function ServicesGrid() {
  return (
    <section className="flex flex-col gap-6">
      <Reveal>
        <SectionTitle kicker={t("Хизматҳо")} title={t("Ҳар чизе ки дар Русия лозим аст")} />
      </Reveal>
      <Stagger inView className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SERVICES.map((s) => (
          <StaggerItem key={s.to} className={s.big ? "col-span-2" : ""}>
            <Link to={s.to} className={tile}>
              <span className="flex items-start justify-between">
                <TileIcon icon={s.icon} />
                <ArrowUpRight className="h-4 w-4 text-outline transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-on-surface" aria-hidden />
              </span>
              <span className="flex flex-col gap-1">
                <span className={`font-semibold leading-tight tracking-tight ${s.big ? "text-[22px]" : "text-[17px]"}`}>{s.title()}</span>
                <span className="text-body-sm text-on-surface-variant">{s.text()}</span>
                {s.big && (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-label-md text-primary">
                    {t("Ҳисоб кардан")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                )}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function SectionTitle({ kicker, title, to, linkText }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        {kicker && <span className="text-label-md text-on-surface-variant">{kicker}</span>}
        <h2 className="text-[24px] font-semibold leading-tight text-on-surface md:text-[30px]">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="inline-flex min-h-[40px] shrink-0 items-center gap-1 text-label-md text-on-surface-variant transition-colors hover:text-on-surface">
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
    <Reveal as="section" className="grid grid-cols-1 gap-10 border-y border-outline-variant py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:py-16">
      <div className="flex flex-col gap-4">
        <span className="text-label-md text-on-surface-variant">{t("Чӣ тавр кор мекунад")}</span>
        <h2 className="text-[26px] font-semibold leading-tight text-on-surface md:text-[32px]">{t("Се қадам то оромӣ")}</h2>
        <Link to="/login" className={`${btnInk} mt-2 w-fit`}>
          {t("Оғоз кардан — бепул")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <Stagger as="ol" inView className="grid gap-8 md:grid-cols-3 md:gap-6">
        {steps.map(([Icon, title, text], i) => (
          <StaggerItem as="li" key={title} className="group flex flex-col gap-3">
            <span className="flex items-center gap-3">
              <TileIcon icon={Icon} />
              <span className="text-label-md tabular-nums text-outline">0{i + 1}</span>
            </span>
            <span className="text-[17px] font-semibold leading-tight">{title}</span>
            <span className="text-body-sm text-on-surface-variant">{text}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </Reveal>
  );
}

// Newest jobs in the user's city (or anywhere, when there are none there).
function JobsPanel({ city }) {
  const cityJobs = useApi(city ? `/jobs/jobs/?city=${encodeURIComponent(city)}&page_size=4` : null);
  const anyJobs = useApi(!city || (cityJobs.data && cityJobs.data.count === 0) ? "/jobs/jobs/?page_size=4" : null);
  const jobs = cityJobs.data?.count ? cityJobs.data : anyJobs.data;
  return (
    <Reveal as="section" className="flex min-w-0 flex-col gap-5">
      <SectionTitle kicker={t("Кор")} title={cityJobs.data?.count ? t("Кори нав дар {0}", city) : t("Ҷойҳои кории нав")} to="/jobs" linkText={t("Ҳама")} />
      <div className="card p-2">
        {cityJobs.loading || anyJobs.loading ? (
          <Skeleton className="h-60" />
        ) : jobs?.results?.length ? (
          <Stagger className="flex flex-col divide-y divide-outline-variant">
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
    </Reveal>
  );
}

function NewsPanel() {
  const news = useApi("/documents/news/?page_size=3");
  return (
    <Reveal as="section" delay={0.1} className="flex min-w-0 flex-col gap-5">
      <SectionTitle kicker={t("Қонун")} title={t("Хабарҳо")} to="/guides#news" linkText={t("Ҳама")} />
      <div className="card px-5">
        {news.loading && <Skeleton className="my-4 h-52" />}
        {news.data?.results && (
          <Stagger inView className="flex flex-col divide-y divide-outline-variant">
            {news.data.results.map((n) => (
              <StaggerItem key={n.id}>
                <Link to={`/news/${n.id}`} className="group flex flex-col gap-1.5 py-4">
                  <span className="text-label-sm font-medium tracking-normal text-on-surface-variant">{date(n.published_at || n.created_at)}</span>
                  <span className="text-[15px] font-medium leading-snug [overflow-wrap:anywhere] transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary">{n.title}</span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </Reveal>
  );
}

function Ring({ days, pct, tone, size = 112 }) {
  const stroke = 8;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-container-high" />
        <m.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={startShown() ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - (pct ?? 100) / 100) }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} className={tone} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums"><CountUp value={Math.abs(days)} /></span>
        <span className="mt-1 text-body-sm text-on-surface-variant">{days < 0 ? t("рӯз пеш") : t("рӯз монд")}</span>
      </div>
    </div>
  );
}

const RING_TONE = { expired: "text-error", expiring: "text-warning-container", valid: "text-tertiary-container" };
const DOT = { expired: "bg-error", expiring: "bg-warning-container", valid: "bg-tertiary-container" };

function DocTile({ doc }) {
  return (
    <Link to="/documents" className={tile}>
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${DOT[doc.status]}`} />
        <span className={`text-label-md ${STATUS[doc.status].accent}`}>{statusText(doc)}</span>
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[17px] font-semibold leading-tight">{t(doc.document_type_title)}</span>
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
  const stats = (
    <m.div
      className="flag-shine relative flex flex-col overflow-hidden rounded-2xl shadow-[0_24px_60px_-28px_rgba(120,20,20,0.45)] ring-1 ring-black/5 dark:divide-y dark:divide-outline-variant dark:bg-surface-container-lowest dark:shadow-none dark:ring-outline-variant"
      initial={startShown() ? false : "hidden"}
      animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } } }}
    >
      <Stat tone="red" value={jobs.data?.count} label={t("ҷойи кори фаъол")} />
      <Stat tone="white" value={regions.data?.count} label={t("минтақа бо нархи патент")} />
      <Stat tone="green" value={placesCount || null} label={t("ҷойи муфид дар харита")} />
    </m.div>
  );
  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <HeroStage aside={stats}>
        <Intro className="flex flex-col gap-6">
          <IntroItem><Eyebrow>{t("Барои муҳоҷирони тоҷик дар Русия")}</Eyebrow></IntroItem>
          <IntroItem as="h1" className="text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] md:text-[64px]">
            {t("Ҳуҷҷатҳо сари вақт.")}
            <br />
            <span className="text-ink dark:text-on-surface-variant">{t("Кори боэътимод.")}</span>
          </IntroItem>
          <IntroItem as="p" className="max-w-xl text-body-lg text-on-surface-variant md:text-[18px] md:leading-[30px]">
            {t("Мӯҳлати патент ва бақайдгириро фаромӯш накунед, нархи патентро ҳисоб кунед ва ҷойҳои кори воқеиро аз сайти давлатӣ ёбед. Ҳамааш бепул ва бо забони тоҷикӣ.")}
          </IntroItem>
          <IntroItem className="flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className={btnInk}>
              {t("Оғоз кардан — бепул")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link to="/jobs" className={btnPlain}>
              <Briefcase className="h-4 w-4" aria-hidden />
              {t("Кор ҷустан")}
            </Link>
          </IntroItem>
        </Intro>
      </HeroStage>

      <ServicesGrid />
      <HowItWorks />
      <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <JobsPanel />
        <NewsPanel />
      </div>
    </div>
  );
}

// Shown beside the greeting while there are no documents yet (the hero button already adds one).
const QUICK = ["/calculator", "/checks", "/exam"];

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

  // The nearest deadline, or quick links to the main services.
  const aside = loading ? (
    <Skeleton className="h-44" />
  ) : next ? (
    <Link to="/documents" className="card flex items-center gap-6 p-6 transition-colors hover:ring-outline/50">
      <Ring days={next.days_left} pct={usedPercent(next)} tone={RING_TONE[next.status]} />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant">
          <Clock className="h-4 w-4" aria-hidden />
          {next.status === "expired" ? t("Мӯҳлат гузашт") : t("Мӯҳлати наздиктарин")}
        </span>
        <span className="text-[22px] font-semibold leading-tight tracking-tight">{t(next.document_type_title)}</span>
        <span className="text-body-sm text-on-surface-variant">{[next.region_name, t("то {0}", date(next.expires_at))].filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  ) : (
    <div className="card flex flex-col p-2">
      <span className="px-4 pb-2 pt-4 text-label-md text-on-surface-variant">{t("Зуд оғоз кунед")}</span>
      {QUICK.map((to) => SERVICES.find((s) => s.to === to)).map((s) => (
        <Link key={s.to} to={s.to} className="group flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-surface-container-low">
          <TileIcon icon={s.icon} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-semibold leading-tight">{s.title()}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{s.text()}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-outline transition-all group-hover:translate-x-0.5 group-hover:text-on-surface" aria-hidden />
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <HeroStage aside={aside}>
        <Intro className="flex flex-col gap-5">
          <IntroItem><Eyebrow>{todayTitle()}</Eyebrow></IntroItem>
          <IntroItem as="h1" className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] md:text-[56px]">{firstName ? t("Салом, {0}!", firstName) : t("Салом!")}</IntroItem>
          <IntroItem as="p" className="max-w-lg text-body-lg text-on-surface-variant md:text-[18px]">{summary}</IntroItem>
          <IntroItem className="flex flex-wrap gap-3">
            {isPatent && (
              <Link to={`/documents?pay=${next.id}`} className={btnInk}>
                <Wallet className="h-4 w-4" aria-hidden />
                {t("Пардохтро сабт кардан")}
              </Link>
            )}
            <Link to="/documents" className={isPatent ? btnPlain : btnInk}>
              {docs.length ? t("Ҳамаи ҳуҷҷатҳо") : t("Ҳуҷҷат илова кардан")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </IntroItem>
        </Intro>
      </HeroStage>

      {docs.length > 1 && (
        <section className="flex flex-col gap-6">
          <Reveal>
            <SectionTitle kicker={t("Ҳуҷҷатҳо")} title={t("Ҳолати ҳуҷҷатҳо")} to="/documents" linkText={t("Ҳама")} />
          </Reveal>
          <Stagger inView className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {sorted.slice(1, 4).map((d) => (
              <StaggerItem key={d.id}>
                <DocTile doc={d} />
              </StaggerItem>
            ))}
            <StaggerItem>
              <Link to="/documents" className="flex h-full min-h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline/50 p-5 text-center text-label-md text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface">
                <Plus className="h-5 w-5" aria-hidden />
                {t("Ҳуҷҷат илова кардан")}
              </Link>
            </StaggerItem>
          </Stagger>
        </section>
      )}

      <ServicesGrid />
      <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <JobsPanel city={user.city} />
        <NewsPanel />
      </div>
      <Reveal>
        <Link to="/exam" className="card group flex flex-col items-start justify-between gap-5 p-6 transition-colors hover:ring-outline/50 md:flex-row md:items-center md:p-8">
          <span className="flex items-center gap-4">
            <TileIcon icon={GraduationCap} />
            <span className="flex flex-col gap-0.5">
              <span className="text-[19px] font-semibold leading-tight">{t("Ба имтиҳон омода шавед")}</span>
              <span className="text-body-sm text-on-surface-variant">{t("Забони русӣ, таърих ва қонун — 100 савол бо шарҳ.")}</span>
            </span>
          </span>
          <span className={btnPlain}>
            <CalendarClock className="h-4 w-4" aria-hidden />
            {t("Машқ кардан")}
          </span>
        </Link>
      </Reveal>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Skeleton className="h-96" />;
  if (!user) return <GuestHome />;
  return <MigrantHome user={user} />;
}
