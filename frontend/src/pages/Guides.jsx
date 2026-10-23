import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";
import { api, apiAll } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { docIcon } from "../components/DocCard.jsx";
import GuideSteps from "../components/GuideSteps.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

function News() {
  const first = useApi("/documents/news/");
  const [extra, setExtra] = useState({ results: [], next: undefined });
  const [busy, setBusy] = useState(false);
  const next = extra.next === undefined ? first.data?.next : extra.next;
  const items = [...(first.data?.results || []), ...extra.results];

  const more = async () => {
    setBusy(true);
    const data = await api(next.slice(next.indexOf("/api") + 4)).catch(() => null);
    if (data) setExtra((e) => ({ results: [...e.results, ...data.results], next: data.next }));
    setBusy(false);
  };

  return (
    <section className="flex flex-col gap-4" id="news">
      <h2 className="flex items-center gap-2 text-headline-md">
        <Newspaper className="h-6 w-6 text-secondary" aria-hidden />
        {t("Хабарҳои қонунгузорӣ")}
      </h2>
      {first.loading ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <p className="card p-6 text-body-md text-on-surface-variant">{t("Ҳоло хабар нест.")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((n) => (
            <Link key={n.id} to={`/news/${n.id}`} className="card flex flex-col gap-2 p-4 transition-shadow hover:shadow-md md:p-6">
              <span className="text-label-sm text-secondary">{date(n.published_at || n.created_at)}</span>
              <h3 className="text-headline-sm leading-snug">{n.title}</h3>
              <p className="line-clamp-3 text-body-sm text-on-surface-variant">{n.summary}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-label-md text-primary">
                {t("Муфассал хондан")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
      {next && <Button variant="soft" loading={busy} onClick={more} className="self-center">{t("Боз нишон додан")}</Button>}
    </section>
  );
}

export default function Guides() {
  const [params, setParams] = useSearchParams();
  const [types, setTypes] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiAll("/documents/document-types/")
      .then(setTypes)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const current = types.find((x) => String(x.id) === params.get("type")) || types[0];

  useEffect(() => {
    if (!current) return;
    setSteps(null);
    apiAll(`/documents/guide-steps/?document_type=${current.id}`).then(setSteps).catch((err) => {
      setError(err);
      setSteps([]);
    });
  }, [current]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Роҳнамои расмӣ")} title={t("Роҳнамо ва қонунҳо")} text={t("Барои ҳар ҳуҷҷат: куҷо рафтан, чӣ бурдан ва чӣ тавр пур кардан.")} />
      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-32" />
      ) : types.length === 0 ? (
        <EmptyState icon={BookOpen} title={t("Роҳнамоҳо ба наздикӣ илова мешаванд")} />
      ) : (
        <>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5" role="tablist">
            {types.map((x) => {
              const Icon = docIcon(x.slug);
              const active = x.id === current?.id;
              return (
                <button key={x.id} type="button" role="tab" aria-selected={active} onClick={() => setParams({ type: x.id }, { replace: true })} className={`flex min-h-[96px] w-40 shrink-0 flex-col items-start justify-between gap-2 rounded-2xl p-4 text-left transition-all md:w-auto ${active ? "bg-primary text-on-primary shadow-md" : "card hover:bg-surface-container-low"}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="text-label-lg">{t(x.title)}</span>
                </button>
              );
            })}
          </div>

          {current && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-headline-lg">{t(current.title)}</h2>
                {current.description && <p className="mt-1 max-w-3xl whitespace-pre-line text-body-lg text-on-surface-variant">{current.description}</p>}
              </div>
              {steps === null ? <Skeleton className="h-64" /> : steps.length ? <GuideSteps steps={steps} /> : <p className="card p-6 text-body-md text-on-surface-variant">{t("Қадамҳо ба наздикӣ илова мешаванд.")}</p>}
            </section>
          )}
        </>
      )}
      <News />
    </div>
  );
}
