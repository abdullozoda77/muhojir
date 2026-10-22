import { useEffect } from "react";
import { Bell, BellRing, Briefcase, CheckCheck, Newspaper, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { LIVE_EVENT } from "../live.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

const KIND_ICON = { reminder: BellRing, job: Briefcase, news: Newspaper, system: Bell };

export default function Notifications() {
  const { data, loading, error, reload } = useApi("/auth/notifications/?page_size=100");
  // A new notification or one read in another tab: the list updates by itself.
  useEffect(() => {
    window.addEventListener(LIVE_EVENT, reload);
    return () => window.removeEventListener(LIVE_EVENT, reload);
  }, [reload]);
  const list = data?.results || [];
  const today = new Date().toDateString();
  const groups = [
    [t("Имрӯз"), list.filter((n) => new Date(n.created_at).toDateString() === today)],
    [t("Пештар"), list.filter((n) => new Date(n.created_at).toDateString() !== today)],
  ].filter(([, items]) => items.length);

  const markRead = async (n) => {
    if (!n.is_read) {
      await api(`/auth/notifications/${n.id}/`, { method: "PATCH", body: { is_read: true } }).catch(() => {});
      reload();
    }
  };
  const readAll = async () => {
    await api("/auth/notifications/read-all/", { method: "POST" }).catch(() => {});
    reload();
  };
  const remove = async (n) => {
    await api(`/auth/notifications/${n.id}/`, { method: "DELETE" }).catch(() => {});
    reload();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title={t("Огоҳиҳо")} icon={Bell}>
        {list.some((n) => !n.is_read) && <Button variant="light" icon={CheckCheck} onClick={readAll}>{t("Ҳамаро хондам")}</Button>}
      </PageHeader>
      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <EmptyState icon={Bell} title={t("Огоҳӣ нест")} text={t("Ёдраскуниҳо дар бораи мӯҳлати ҳуҷҷатҳо дар ин ҷо пайдо мешаванд.")} />
      ) : (
        groups.map(([title, items]) => (
          <section key={title} className="flex flex-col gap-3">
            <h2 className="font-display text-[20px] font-extrabold text-navy dark:text-on-surface">{title}</h2>
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind] || Bell;
              return (
                <div key={n.id} className={`card relative flex items-start gap-3 overflow-hidden p-5 ${n.is_read ? "" : "!ring-2 !ring-primary/40"}`}>
                  {!n.is_read && <span aria-hidden className="ikat-stripe-v absolute inset-y-0 left-0" />}
                  <button type="button" onClick={() => markRead(n)} className="flex flex-1 items-start gap-4 text-left">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${n.kind === "reminder" ? "bg-warning-fixed text-on-warning-fixed" : "bg-primary-fixed text-on-primary-fixed"}`}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2 font-display text-[17px] font-bold">
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-error" aria-label={t("Нав")} />}
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-body-md">{n.message}</span>
                      <span className="text-body-sm text-on-surface-variant">{ago(n.created_at)}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => remove(n)} aria-label={t("Нест кардан")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container-low hover:text-error">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
