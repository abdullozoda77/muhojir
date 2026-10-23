import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock, FilePlus2, LayoutList, Mail, ReceiptText, SearchCheck, ShieldCheck, XCircle } from "lucide-react";
import { useDocuments } from "../hooks.js";
import { t } from "../i18n.js";
import { date, monthTitle } from "../format.js";
import DocCard from "../components/DocCard.jsx";
import DocForm from "../components/DocForm.jsx";
import PaymentDrawer from "../components/PaymentDrawer.jsx";
import { Stagger, StaggerItem, m } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton, StatusBadge } from "../components/ui.jsx";

const FILTERS = [
  { key: "all", label: () => t("Ҳама") },
  { key: "expiring", label: () => t("Наздик ба анҷом"), icon: Clock, tone: "text-warning" },
  { key: "expired", label: () => t("Мӯҳлат гузашта"), icon: XCircle, tone: "text-error" },
  { key: "valid", label: () => t("Эътибор дорад"), icon: CheckCircle2, tone: "text-tertiary" },
];

// The calendar view: a timeline by month of the end date, nearest first.
function Calendar({ docs, onEdit }) {
  const months = useMemo(() => {
    const groups = new Map();
    [...docs].sort((a, b) => a.expires_at.localeCompare(b.expires_at)).forEach((d) => {
      const key = d.expires_at.slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), d]);
    });
    return [...groups.entries()];
  }, [docs]);

  return (
    <ol className="relative flex flex-col gap-8 border-l border-outline-variant pl-6 md:pl-10">
      {months.map(([month, list]) => (
        <li key={month} className="relative">
          <span className="absolute -left-[30px] top-1.5 h-3 w-3 rounded-full bg-ink ring-4 ring-background md:-left-[46px]" />
          <h3 className="mb-3 text-[18px] font-semibold capitalize">{monthTitle(month)}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {list.map((d) => (
              <button key={d.id} type="button" onClick={() => onEdit(d)} className="card flex flex-col justify-between gap-3 p-5 text-left transition-colors hover:ring-outline/50">
                <div>
                  <span className="text-label-md tabular-nums text-on-surface-variant">{date(d.expires_at)}</span>
                  <p className="mt-1 text-[17px] font-semibold leading-tight">{t(d.document_type_title)}</p>
                  {d.region_name && <p className="text-body-sm text-on-surface-variant">{d.region_name}</p>}
                </div>
                <StatusBadge doc={d} className="self-start" />
              </button>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

const SERVICES = [
  { to: "/profile", icon: Mail, title: () => t("Ёдраскунӣ ба почта"), text: () => t("Пеш аз анҷоми мӯҳлат мактуб меояд. Дар профил фаъол ё хомӯш кунед.") },
  { to: "/help", icon: BookOpen, title: () => t("Сайтҳои расмӣ"), text: () => t("Қоидаҳои патент ва қонунҳои Русияро дар сайтҳои расмӣ хонед.") },
  { to: "/payments", icon: ReceiptText, title: () => t("Архиви чекҳо"), text: () => t("Ҳамаи чекҳои пардохт дар як ҷо нигоҳ дошта мешаванд.") },
];

export default function Documents() {
  const { docs, types, regions, loading, error, reload } = useDocuments();
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [params, setParams] = useSearchParams();

  // /documents?pay=<id> (from the home page or the calculator) opens the payment form for that document.
  useEffect(() => {
    const id = Number(params.get("pay"));
    const doc = id && docs.find((d) => d.id === id);
    if (doc) {
      setPaying(doc);
      setParams({}, { replace: true });
    }
  }, [params, docs, setParams]);

  const priceOf = (doc) => Number(regions.find((r) => r.id === doc?.region)?.patent_monthly_price || 0);

  const slugOf = (doc) => types.find((x) => x.id === doc.document_type)?.slug;
  const counts = { all: docs.length, expiring: 0, expired: 0, valid: 0 };
  docs.forEach((d) => (counts[d.status] += 1));
  // Most urgent first: expired, then ending soon, then the rest by end date.
  const order = { expired: 0, expiring: 1, valid: 2 };
  const shown = docs.filter((d) => filter === "all" || d.status === filter).sort((a, b) => order[a.status] - order[b.status] || a.expires_at.localeCompare(b.expires_at));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Муҳоҷирати бехатар")} title={t("Ҳуҷҷатҳои ман")} text={t("Ҳуҷҷатҳоро сари вақт нав кунед ва аз ҷарима ва ихроҷ эмин бошед.")} icon={ShieldCheck}>
        <Button variant="accent" icon={FilePlus2} onClick={() => setEditing({})}>{t("Ҳуҷҷати нав")}</Button>
      </PageHeader>

      {/* The four counts are also the filter. */}
      <div className="card grid grid-cols-2 overflow-hidden md:grid-cols-4" role="tablist">
        {FILTERS.map((f, i) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" role="tab" aria-selected={on} onClick={() => setFilter(f.key)} className={`relative flex flex-col items-start gap-2 p-5 text-left transition-colors ${i % 2 ? "border-l border-outline-variant" : ""} ${i > 1 ? "border-t border-outline-variant md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""} ${on ? "bg-surface-container-low" : "hover:bg-surface-container-low/60"}`}>
              <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
                {f.icon ? <f.icon className={`h-4 w-4 ${f.tone}`} aria-hidden /> : <LayoutList className="h-4 w-4" aria-hidden />}
                {f.label()}
              </span>
              <span className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">{counts[f.key]}</span>
              {on && <m.span layoutId="doc-filter" className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/checks" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
          <SearchCheck className="h-4 w-4" aria-hidden />
          {t("Санҷиш дар сайтҳои расмӣ")}
        </Link>
        <div className="inline-flex rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
          {[
            ["list", LayoutList, t("Рӯйхат")],
            ["calendar", CalendarDays, t("Тақвим")],
          ].map(([key, Icon, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 text-label-md transition-colors ${view === key ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <ErrorBox error={error} />
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : docs.length === 0 ? (
        <EmptyState icon={FilePlus2} title={t("Ҳуҷҷати аввалини худро илова кунед")} text={t("Патент, бақайдгирӣ, корти муҳоҷиратӣ ё суғуртаро илова кунед, то мо пеш аз тамом шудани мӯҳлат ёдрас кунем.")}>
          <Button icon={FilePlus2} onClick={() => setEditing({})}>{t("Ҳуҷҷат илова кардан")}</Button>
        </EmptyState>
      ) : view === "calendar" ? (
        <Calendar docs={shown} onEdit={setEditing} />
      ) : shown.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("Дар ин бахш ҳуҷҷат нест")} />
      ) : (
        <Stagger key={filter} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <StaggerItem key={d.id} className="flex min-w-0">
              <DocCard doc={d} slug={slugOf(d)} onEdit={setEditing} onPay={setPaying} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Stagger inView className="grid gap-3 md:grid-cols-3">
        {SERVICES.map((s) => (
          <StaggerItem key={s.to}>
          <Link to={s.to} className="card group flex h-full flex-col gap-3 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)] hover:ring-outline/50">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface ring-1 ring-outline-variant">
                <s.icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold">{s.title()}</h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">{s.text()}</p>
              </div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 self-end text-label-md text-on-surface-variant transition-colors group-hover:text-on-surface">
              {t("Кушодан")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <DocForm
        doc={editing}
        types={types}
        regions={regions}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <PaymentDrawer
        doc={paying}
        monthlyPrice={priceOf(paying)}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          reload();
        }}
      />
    </div>
  );
}
