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
import { Stagger, StaggerItem } from "../components/motion.jsx";

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
      <h2 className="flex items-center gap-3 text-[22px] font-semibold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
          <Newspaper className="h-5 w-5" aria-hidden />
        </span>
        {t("Хабарҳои қонунгузорӣ")}
      </h2>
      {first.loading ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <p className="card p-7 text-body-md text-on-surface-variant">{t("Ҳоло хабар нест.")}</p>
      ) : (
        <Stagger inView className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((n) => (
            <StaggerItem key={n.id}>
            <Link to={`/news/${n.id}`} className="card group flex h-full flex-col gap-3 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)] hover:ring-outline/50">
              <span className="text-label-md text-on-surface-variant">{date(n.published_at || n.created_at)}</span>
              <h3 className="text-[17px] font-semibold leading-snug">{n.title}</h3>
              <p className="line-clamp-3 text-body-sm text-on-surface-variant">{n.summary}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-label-md text-primary">
                {t("Муфассал хондан")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      {next && <Button variant="plain" loading={busy} onClick={more} className="self-center">{t("Боз нишон додан")}</Button>}
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
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
            {types.map((x) => {
              const Icon = docIcon(x.slug);
              const active = x.id === current?.id;
              return (
                <button key={x.id} type="button" role="tab" aria-selected={active} onClick={() => setParams({ type: x.id }, { replace: true })} className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-label-md transition-colors ${active ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(x.title)}
                </button>
              );
            })}
          </div>

          {current && (
            <section className="flex flex-col gap-8">
              <div>
                <h2 className="text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">{t(current.title)}</h2>
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
