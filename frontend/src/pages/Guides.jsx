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
      <h2 className="flex items-center gap-3 text-[26px] font-display font-extrabold text-navy dark:text-on-surface">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
          <Newspaper className="h-5 w-5" aria-hidden />
        </span>
        {t("Хабарҳои қонунгузорӣ")}
      </h2>
      {first.loading ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <p className="card p-7 text-body-md text-on-surface-variant">{t("Ҳоло хабар нест.")}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((n) => (
            <Link key={n.id} to={`/news/${n.id}`} className="card group flex flex-col gap-3 p-6 transition-transform hover:-translate-y-0.5">
              <span className="inline-flex w-fit items-center rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">{date(n.published_at || n.created_at)}</span>
              <h3 className="font-display text-[19px] font-bold leading-snug">{n.title}</h3>
              <p className="line-clamp-3 text-body-sm text-on-surface-variant">{n.summary}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-label-md text-primary">
                {t("Муфассал хондан")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
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
      <PageHeader eyebrow={t("Роҳнамои расмӣ")} title={t("Роҳнамо ва қонунҳо")} text={t("Барои ҳар ҳуҷҷат: куҷо рафтан, чӣ бурдан ва чӣ тавр пур кардан.")} icon={BookOpen} />
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
                <button key={x.id} type="button" role="tab" aria-selected={active} onClick={() => setParams({ type: x.id }, { replace: true })} className={`flex min-h-[112px] w-44 shrink-0 flex-col items-start justify-between gap-3 rounded-[28px] p-5 text-left transition-all md:w-auto ${active ? "bg-navy text-white shadow-[0_18px_36px_-18px_rgb(16_38_92/0.8)] dark:bg-primary dark:text-on-primary" : "bg-surface-container-lowest ring-1 ring-outline-variant/60 hover:-translate-y-0.5"}`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? "bg-white/15" : "bg-primary-fixed text-on-primary-fixed"}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-display text-[16px] font-bold leading-tight">{t(x.title)}</span>
                </button>
              );
            })}
          </div>

          {current && (
            <section className="flex flex-col gap-5">
              <div>
                <h2 className="text-[30px] leading-tight md:text-[38px] font-display font-extrabold text-navy dark:text-on-surface">{t(current.title)}</h2>
                {current.description && <p className="mt-2 max-w-3xl whitespace-pre-line text-body-lg text-on-surface-variant">{current.description}</p>}
              </div>
              {steps === null ? <Skeleton className="h-64" /> : steps.length ? <GuideSteps steps={steps} /> : <p className="card p-7 text-body-md text-on-surface-variant">{t("Қадамҳо ба наздикӣ илова мешаванд.")}</p>}
            </section>
          )}
        </>
      )}
      <News />
    </div>
  );
}
