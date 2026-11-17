import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { apiAll } from "../api.js";
import { t, useLang } from "../i18n.js";
import { docIcon } from "../components/DocCard.jsx";
import GuideSteps from "../components/GuideSteps.jsx";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

export default function Guides() {
  const lang = useLang();
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
  }, [lang]);

  const current = types.find((x) => String(x.id) === params.get("type")) || types[0];

  useEffect(() => {
    if (!current) return;
    setSteps(null);
    apiAll(`/documents/guide-steps/?document_type=${current.id}`).then(setSteps).catch((err) => {
      setError(err);
      setSteps([]);
    });
  }, [current?.id, lang]);

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
    </div>
  );
}
