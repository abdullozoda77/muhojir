import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Newspaper } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t, useLang } from "../i18n.js";
import { date } from "../format.js";
import { Button, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

export default function News() {
  const lang = useLang();
  const first = useApi("/documents/news/");
  const [extra, setExtra] = useState({ results: [], next: undefined });

  useEffect(() => setExtra({ results: [], next: undefined }), [lang]);
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
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Қонун")} title={t("Хабарҳои қонунгузорӣ")} icon={Newspaper} />
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
    </div>
  );
}
