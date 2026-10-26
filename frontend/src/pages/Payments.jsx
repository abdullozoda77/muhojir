import { Link } from "react-router-dom";
import { Eye, ReceiptText, Trash2 } from "lucide-react";
import { api, openPrivateFile } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date, rub } from "../format.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

export default function Payments() {
  const { data, loading, error, reload } = useApi("/documents/payments/?page_size=100");
  const list = data?.results || [];
  const total = list.reduce((sum, p) => sum + Number(p.amount), 0);

  const remove = async (payment) => {
    if (!window.confirm(t("Ин пардохтро аз архив нест кунем? Санаи анҷоми ҳуҷҷат тағйир намеёбад."))) return;
    await api(`/documents/payments/${payment.id}/`, { method: "DELETE" }).catch(() => {});
    reload();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader eyebrow={t("Ҳуҷҷатҳо")} title={t("Архиви чекҳо")} text={t("Ҳамаи пардохтҳо ва сурати чекҳо дар як ҷо. Чекҳоро танҳо шумо мебинед.")} icon={ReceiptText} />
      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-48" />
      ) : list.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t("Ҳоло пардохт сабт нашудааст")} text={t("Дар «Ҳуҷҷатҳои ман» дар корти патент «Пардохти патентро сабт кардан»-ро пахш кунед.")}>
          <Link to="/documents" className="inline-flex min-h-[48px] items-center rounded-xl bg-ink px-6 text-label-lg text-on-ink transition-all hover:bg-ink/90">{t("Ҳуҷҷатҳои ман")}</Link>
        </EmptyState>
      ) : (
        <>
          <div className="card grid grid-cols-2 divide-x divide-outline-variant">
            <div className="flex flex-col gap-1 p-5 md:p-6">
              <span className="text-body-sm text-on-surface-variant">{t("Пардохтҳо")}</span>
              <span className="text-[30px] font-semibold leading-tight tracking-tight tabular-nums md:text-[36px]">{list.length}</span>
            </div>
            <div className="flex flex-col gap-1 p-5 md:p-6">
              <span className="text-body-sm text-on-surface-variant">{t("Ҳамагӣ пардохт шуд")}</span>
              <span className="text-[30px] font-semibold leading-tight tracking-tight tabular-nums md:text-[36px]">{rub(total)}</span>
            </div>
          </div>
          <div className="card flex flex-col divide-y divide-outline-variant">
          {list.map((p) => (
            <article key={p.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="flex flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
                  <ReceiptText className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold">{t(p.document_title)}</h3>
                  <p className="text-body-md text-on-surface-variant">
                    <strong className="text-on-surface">{rub(p.amount)}</strong> · {t("{0} моҳ", p.months)} · {date(p.paid_at)}
                  </p>
                  {p.note && <p className="text-body-sm text-on-surface-variant">{p.note}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {p.has_receipt ? (
                  <Button variant="plain" icon={Eye} onClick={() => openPrivateFile(`/documents/payments/${p.id}/receipt/`).catch(() => {})}>{t("Чек")}</Button>
                ) : (
                  <span className="self-center text-body-sm text-on-surface-variant">{t("Бе сурати чек")}</span>
                )}
                <Button variant="ghost" icon={Trash2} onClick={() => remove(p)} aria-label={t("Нест кардан")} />
              </div>
            </article>
          ))}
          </div>
        </>
      )}
    </div>
  );
}
