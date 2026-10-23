import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock, FilePlus2, LayoutList, Mail, ReceiptText, SearchCheck, ShieldCheck, XCircle } from "lucide-react";
import { useDocuments } from "../hooks.js";
import { t } from "../i18n.js";
import { date, monthTitle } from "../format.js";
import DocCard from "../components/DocCard.jsx";
import DocForm from "../components/DocForm.jsx";
import PaymentDrawer from "../components/PaymentDrawer.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, STATUS, Skeleton, StatusBadge } from "../components/ui.jsx";

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
    <ol className="relative flex flex-col gap-8 border-l-2 border-dashed border-outline-variant pl-6 md:pl-10">
      {months.map(([month, list]) => (
        <li key={month} className="relative">
          <span className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-navy ring-4 ring-background md:-left-[49px] dark:bg-primary" />
          <h3 className="mb-3 font-display text-[22px] font-extrabold capitalize text-navy dark:text-on-surface">{monthTitle(month)}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {list.map((d) => (
              <button key={d.id} type="button" onClick={() => onEdit(d)} className={`flex flex-col justify-between gap-3 rounded-[24px] p-5 text-left transition-transform hover:-translate-y-0.5 ${STATUS[d.status].box}`}>
                <div>
                  <span className="text-label-sm uppercase">{date(d.expires_at)}</span>
                  <p className="mt-1 font-display text-[18px] font-bold leading-tight">{t(d.document_type_title)}</p>
                  {d.region_name && <p className="text-body-sm opacity-80">{d.region_name}</p>}
                </div>
                <StatusBadge doc={d} className="self-start bg-surface-container-lowest/60" />
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" role="tablist">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" role="tab" aria-selected={on} onClick={() => setFilter(f.key)} className={`flex flex-col items-start gap-3 rounded-[28px] p-5 text-left transition-all ${on ? "bg-navy text-white shadow-[0_18px_36px_-18px_rgb(16_38_92/0.8)] dark:bg-primary dark:text-on-primary" : "bg-surface-container-lowest ring-1 ring-outline-variant/60 hover:-translate-y-0.5"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${on ? "bg-white/15" : "bg-surface-container-low"}`}>
                {f.icon ? <f.icon className={`h-5 w-5 ${on ? "" : f.tone}`} aria-hidden /> : <LayoutList className="h-5 w-5" aria-hidden />}
              </span>
              <span className="font-display text-[40px] font-black leading-none">{counts[f.key]}</span>
              <span className={`text-label-md ${on ? "text-white/80" : "text-on-surface-variant"}`}>{f.label()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/checks" className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-label-md text-primary ring-1 ring-outline-variant hover:bg-surface-container-lowest">
          <SearchCheck className="h-4 w-4" aria-hidden />
          {t("Санҷиш дар сайтҳои расмӣ")}
        </Link>
        <div className="inline-flex rounded-full bg-surface-container-lowest p-1 ring-1 ring-outline-variant/60">
          {[
            ["list", LayoutList, t("Рӯйхат")],
            ["calendar", CalendarDays, t("Тақвим")],
          ].map(([key, Icon, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-label-md transition-colors ${view === key ? "bg-navy text-white dark:bg-primary dark:text-on-primary" : "text-on-surface-variant"}`}>
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
        <Stagger key={filter} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <StaggerItem key={d.id} className="flex">
              <DocCard doc={d} slug={slugOf(d)} onEdit={setEditing} onPay={setPaying} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {SERVICES.map((s) => (
          <Link key={s.to} to={s.to} className="flex flex-col gap-3 rounded-[28px] bg-surface-container-lowest p-6 ring-1 ring-outline-variant/60 transition-all hover:-translate-y-0.5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed">
                <s.icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-display text-[18px] font-bold">{s.title()}</h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">{s.text()}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 self-end text-label-md text-primary">
              {t("Кушодан")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

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
