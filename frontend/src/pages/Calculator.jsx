import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, Calculator as CalcIcon, Clock, ExternalLink, Info, ListChecks, MapPinned, Phone, Printer, Wallet } from "lucide-react";
import { apiAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import { t } from "../i18n.js";
import { num, rub } from "../format.js";
import { Checklist, papersOf } from "../components/GuideSteps.jsx";
import { useApi } from "../hooks.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

export default function Calculator() {
  const { user } = useAuth();
  const [regions, setRegions] = useState([]);
  const [patent, setPatent] = useState(null);
  const [steps, setSteps] = useState([]);
  const [myPatent, setMyPatent] = useState(null); // the worker's own patent, to record a payment for it
  const [regionId, setRegionId] = useState("");
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, types] = await Promise.all([apiAll("/documents/regions/"), apiAll("/documents/document-types/")]);
        setRegions(list);
        const moscow = list.find((r) => /москва/i.test(r.name) && !/обл|вил/i.test(r.name));
        setRegionId(String((moscow || list[0])?.id ?? ""));
        const type = types.find((x) => /patent/.test(x.slug));
        setPatent(type || null);
        if (type) setSteps(await apiAll(`/documents/guide-steps/?document_type=${type.id}`));
        if (type && user) {
          const mine = await apiAll(`/documents/my-documents/?document_type=${type.id}`);
          setMyPatent(mine[0] || null);
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const region = regions.find((r) => String(r.id) === regionId);
  const price = Number(region?.patent_monthly_price || 0);
  const papers = useMemo(() => (steps.length ? papersOf(steps[0]) : []), [steps]); // what to bring when applying (step 1)
  const centers = useApi(regionId ? `/documents/centers/?region=${regionId}&page_size=50` : null);
  const payLink = myPatent ? `/documents?pay=${myPatent.id}` : user ? "/documents" : "/login";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={region ? t("Нархҳои соли {0}", region.price_year) : t("Нархҳо аз рӯи минтақа")}
        title={t("Ҳисобкунаки нархи патент")}
        text={t("Минтақаи кори худро интихоб кунед ва маблағро пешакӣ донед.")}
        icon={CalcIcon}
      />

      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-96" />
      ) : regions.length === 0 ? (
        <EmptyState icon={CalcIcon} title={t("Нархҳо ҳанӯз илова нашудаанд")} text={t("Админ нархи патентро аз рӯи минтақаҳо ба наздикӣ илова мекунад.")} />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-7">
            <div className="card flex flex-col gap-6 p-6 md:p-8">
              <div>
                <p className="text-label-sm uppercase tracking-[0.18em] text-secondary">{t("Қадами аввал")}</p>
                <h2 className="mt-1 text-[26px] leading-tight md:text-[30px] font-display font-extrabold text-navy dark:text-on-surface">{t("Нархи патент чанд мешавад?")}</h2>
              </div>
              <label className="block">
                <span className="label">{t("Минтақаи кор")}</span>
                <select className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} — {rub(r.patent_monthly_price)} / {t("моҳ")}</option>
                  ))}
                </select>
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="months" className="text-label-md">{t("Барои чанд моҳ пардохт мекунед?")}</label>
                  <span className="rounded-full bg-navy px-4 py-1.5 text-label-lg font-bold text-white dark:bg-primary dark:text-on-primary">{t("{0} моҳ", months)}</span>
                </div>
                <input id="months" type="range" min={1} max={12} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-2.5 w-full cursor-pointer accent-primary" />
                {/* Each label sits under its own spot on the slider (1..12 are not evenly spaced labels). */}
                <div className="relative mx-2 mt-1 h-8 text-label-sm text-on-surface-variant">
                  {[1, 3, 6, 9, 12].map((m) => (
                    <button key={m} type="button" onClick={() => setMonths(m)} style={{ left: `${((m - 1) / 11) * 100}%` }} className={`absolute min-h-[32px] -translate-x-1/2 px-1.5 hover:text-primary ${months === m ? "font-bold text-primary" : ""}`}>{m}</button>
                  ))}
                </div>
              </div>

              {/* The total: dark blue with the sum big in gold, like a job's salary. */}
              <div className="flex flex-col gap-4">
                <div className="relative flex flex-col gap-4 overflow-hidden rounded-[28px] bg-navy p-6 text-white md:p-7">
                  <div aria-hidden className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
                  <div className="flag-line absolute inset-x-0 bottom-0 h-[5px]" />
                  <div className="relative">
                    <span className="text-body-sm text-white/70">{t("Маблағи умумӣ")}:</span>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="whitespace-nowrap font-display text-[40px] font-black leading-none tracking-tight text-gold md:text-[52px]" aria-live="polite">{rub(price * months)}</span>
                      <span className="text-body-sm text-white/70">{num(price)} ₽ × {t("{0} моҳ", months)}</span>
                    </div>
                  </div>
                  <Link to={payLink} className="relative inline-flex min-h-[48px] items-center justify-center gap-2 self-start rounded-full bg-secondary px-6 text-label-lg text-on-secondary shadow-[0_8px_20px_-8px_rgb(var(--c-secondary)/0.8)] transition-all hover:-translate-y-px hover:bg-secondary-container">
                    <Wallet className="h-5 w-5" aria-hidden />
                    {myPatent ? t("Пардохтро сабт кардан") : t("Патентро илова кунед ва пардохтро сабт кунед")}
                  </Link>
                </div>
                <div className="flex items-start gap-3 rounded-[20px] bg-warning-fixed/60 p-4 text-on-warning-fixed">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
                  <p className="text-body-sm">
                    {t("Ин ҳисоби тахминӣ аст. Нархи дақиқро ҳангоми пардохт дар чек санҷед. Пардохтро якчанд рӯз пеш аз анҷоми мӯҳлат кунед, то пул сари вақт расад.")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  [t("Нархи 1 моҳ"), rub(price)],
                  [t("Моҳҳо"), months],
                  [t("Соли нарх"), region?.price_year],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[20px] bg-surface-container-low p-3 text-center ring-1 ring-inset ring-outline-variant/40">
                    <span className="block text-label-sm text-on-surface-variant">{label}</span>
                    <span className="mt-0.5 block font-display text-[18px] font-extrabold text-navy dark:text-on-surface">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card flex flex-col gap-4 p-6 md:flex-row md:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
                <BellRing className="h-6 w-6" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="font-display text-[17px] font-bold">{t("Пардохти навбатиро фаромӯш накунед")}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {t("Патентро дар «Ҳуҷҷатҳои ман» илова кунед — пеш аз анҷоми мӯҳлат ба почтаи шумо ёдраскунӣ меояд.")}
                </p>
              </div>
              <Link to={user ? "/documents" : "/login"} className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-navy px-6 text-label-lg text-white shadow-[0_10px_22px_-10px_rgb(16_38_92/0.8)] transition-all hover:-translate-y-px hover:brightness-125 dark:bg-primary dark:text-on-primary">
                {user ? t("Патент илова кардан") : t("Ворид шудан")}
              </Link>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:col-span-5 xl:flex xl:flex-col">
            <div id="print-area" className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed">
                    <ListChecks className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[20px] leading-tight font-display font-extrabold text-navy dark:text-on-surface">{t("Ҳуҷҷатҳои зарурӣ")}</h2>
                    <span className="text-body-sm text-on-surface-variant">{t("Бо худ чиро бурдан лозим аст?")}</span>
                  </div>
                </div>
                {papers.length > 0 && <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-navy px-2 text-label-md text-white dark:bg-primary dark:text-on-primary">{papers.length}</span>}
              </div>
              {papers.length ? <Checklist items={papers} /> : <p className="text-body-sm text-on-surface-variant">{t("Рӯйхат ба наздикӣ илова мешавад.")}</p>}
              {papers.length > 0 && (
                <Button variant="soft" icon={Printer} onClick={() => window.print()} className="no-print self-start">
                  {t("Чоп кардан ё PDF")}
                </Button>
              )}
            </div>
            <div className="card flex flex-col gap-3 p-6">
              <h2 className="flex items-center gap-3 text-[20px] leading-tight font-display font-extrabold text-navy dark:text-on-surface">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
                  <MapPinned className="h-5 w-5" aria-hidden />
                </span>
                {t("Марказҳои муҳоҷират")}
              </h2>
              <p className="text-body-sm text-on-surface-variant">{t("Дар минтақаи {0}:", region?.name || "")}</p>
              {centers.data?.results?.length ? (
                centers.data.results.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1 rounded-[20px] bg-surface-container-low p-4">
                    <span className="font-display text-[16px] font-bold">{c.name}</span>
                    <span className="text-body-sm text-on-surface-variant">{c.address}</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
                      {c.working_hours && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-tertiary" aria-hidden />{c.working_hours}</span>}
                      {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-primary"><Phone className="h-3.5 w-3.5" aria-hidden />{c.phone}</a>}
                      {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">{t("Сайт")}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-body-sm text-on-surface-variant">{t("Барои ин минтақа ҳоло марказ илова нашудааст.")}</p>
              )}
            </div>
            {patent && (
              <Link to={`/guides?type=${patent.id}`} className="group relative flex min-h-[64px] items-center justify-between gap-3 overflow-hidden rounded-[28px] bg-navy p-6 text-white shadow-[0_18px_36px_-18px_rgb(16_38_92/0.8)]">
                <div className="flag-line absolute inset-x-0 bottom-0 h-[5px]" />
                <span className="relative">
                  <span className="block font-display text-[20px] font-extrabold leading-tight">{t("Роҳнамои қадам ба қадам")}</span>
                  <span className="text-body-sm text-white/70">{t("Гирифтани патент: {0} қадам", steps.length)}</span>
                </span>
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-navy transition-transform group-hover:translate-x-1">
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
