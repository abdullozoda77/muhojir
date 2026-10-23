import { useEffect } from "react";
import { Bell, BellRing, Briefcase, CheckCheck, Newspaper, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { LIVE_EVENT } from "../live.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

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
          // One group (today, earlier): an inbox list; unread ones are tinted and have a blue dot.
          <Reveal as="section" key={title} className="flex flex-col gap-3">
            <h2 className="px-1 text-label-md text-on-surface-variant">{title}</h2>
            <div className="card flex flex-col divide-y divide-outline-variant overflow-hidden">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind] || Bell;
                return (
                  <div key={n.id} className={`group relative flex items-start gap-3 p-4 transition-colors md:p-5 ${n.is_read ? "hover:bg-surface-container-low" : "bg-primary/[0.04] hover:bg-primary/[0.07]"}`}>
                    <button type="button" onClick={() => markRead(n)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${n.kind === "reminder" ? "bg-warning-fixed text-on-warning-fixed ring-warning-container/30" : "bg-surface-container-low text-on-surface ring-outline-variant"}`}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[15px] font-semibold">
                          {n.title}
                          {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t("Нав")} />}
                        </span>
                        <span className="mt-0.5 block text-body-md text-on-surface-variant">{n.message}</span>
                        <span className="mt-1 block text-[12px] text-on-surface-variant/80">{ago(n.created_at)}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => remove(n)} aria-label={t("Нест кардан")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-outline transition-all hover:bg-surface-container-high hover:text-error md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Reveal>
        ))
      )}
    </div>
  );
}
