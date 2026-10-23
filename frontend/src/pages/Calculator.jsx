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
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={region ? t("Нархҳои соли {0}", region.price_year) : t("Нархҳо аз рӯи минтақа")}
        title={t("Ҳисобкунаки нархи патент")}
        text={t("Минтақаи кори худро интихоб кунед ва маблағро пешакӣ донед.")}
      />

      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-96" />
      ) : regions.length === 0 ? (
        <EmptyState icon={CalcIcon} title={t("Нархҳо ҳанӯз илова нашудаанд")} text={t("Админ нархи патентро аз рӯи минтақаҳо ба наздикӣ илова мекунад.")} />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-7">
            <div className="card flex flex-col gap-5 p-4 md:p-8">
              <div>
                <p className="text-label-sm uppercase tracking-wider text-primary">{t("Қадами аввал")}</p>
                <h2 className="text-headline-md">{t("Нархи патент чанд мешавад?")}</h2>
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
                  <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-lg font-bold text-primary">{t("{0} моҳ", months)}</span>
                </div>
                <input id="months" type="range" min={1} max={12} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-2.5 w-full cursor-pointer accent-primary" />
                {/* Each label sits under its own spot on the slider (1..12 are not evenly spaced labels). */}
                <div className="relative mx-2 mt-1 h-8 text-label-sm text-on-surface-variant">
                  {[1, 3, 6, 9, 12].map((m) => (
                    <button key={m} type="button" onClick={() => setMonths(m)} style={{ left: `${((m - 1) / 11) * 100}%` }} className="absolute min-h-[32px] -translate-x-1/2 px-1 hover:text-primary">{m}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-xl bg-surface-container p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-body-sm text-on-surface-variant">{t("Маблағи умумӣ")}:</span>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="whitespace-nowrap text-headline-xl font-bold tracking-tight text-primary" aria-live="polite">{rub(price * months)}</span>
                      <span className="text-body-sm text-on-surface-variant">{num(price)} ₽ × {t("{0} моҳ", months)}</span>
                    </div>
                  </div>
                  <Link to={payLink} className="inline-flex min-h-[48px] items-center justify-center gap-2 self-start rounded-xl bg-secondary px-5 text-label-lg text-on-secondary hover:bg-secondary-container">
                    <Wallet className="h-5 w-5" aria-hidden />
                    {myPatent ? t("Пардохтро сабт кардан") : t("Патентро илова кунед ва пардохтро сабт кунед")}
                  </Link>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-surface-container-lowest p-4 shadow-sm">
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
                  <div key={label} className="rounded-lg bg-surface-container-low p-3 text-center">
                    <span className="block text-label-sm text-on-surface-variant">{label}</span>
                    <span className="mt-0.5 block text-headline-sm font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
                <BellRing className="h-6 w-6" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="text-label-lg">{t("Пардохти навбатиро фаромӯш накунед")}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {t("Патентро дар «Ҳуҷҷатҳои ман» илова кунед — пеш аз анҷоми мӯҳлат ба почтаи шумо ёдраскунӣ меояд.")}
                </p>
              </div>
              <Link to={user ? "/documents" : "/login"} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-label-lg text-on-primary">
                {user ? t("Патент илова кардан") : t("Ворид шудан")}
              </Link>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:col-span-5 xl:flex xl:flex-col">
            <div id="print-area" className="card flex flex-col gap-4 p-4 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-primary">
                    <ListChecks className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-headline-sm font-bold">{t("Ҳуҷҷатҳои зарурӣ")}</h2>
                    <span className="text-body-sm text-on-surface-variant">{t("Бо худ чиро бурдан лозим аст?")}</span>
                  </div>
                </div>
                {papers.length > 0 && <span className="rounded bg-surface-container-high px-2 py-1 text-label-sm text-primary">{papers.length}</span>}
              </div>
              {papers.length ? <Checklist items={papers} /> : <p className="text-body-sm text-on-surface-variant">{t("Рӯйхат ба наздикӣ илова мешавад.")}</p>}
              {papers.length > 0 && (
                <Button variant="soft" icon={Printer} onClick={() => window.print()} className="no-print self-start">
                  {t("Чоп кардан ё PDF")}
                </Button>
              )}
            </div>
            <div className="card flex flex-col gap-2 p-4 md:p-6">
              <h2 className="flex items-center gap-2 text-headline-sm">
                <MapPinned className="h-6 w-6 text-secondary" aria-hidden />
                {t("Марказҳои муҳоҷират")}
              </h2>
              <p className="text-body-sm text-on-surface-variant">{t("Дар минтақаи {0}:", region?.name || "")}</p>
              {centers.data?.results?.length ? (
                centers.data.results.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-3">
                    <span className="text-label-lg">{c.name}</span>
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
              <Link to={`/guides?type=${patent.id}`} className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-banner p-4 text-white shadow-sm md:p-6">
                <span>
                  <span className="block text-headline-sm">{t("Роҳнамои қадам ба қадам")}</span>
                  <span className="text-body-sm text-on-navy">{t("Гирифтани патент: {0} қадам", steps.length)}</span>
                </span>
                <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
