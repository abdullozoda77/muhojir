import { Link } from "react-router-dom";
import { Eye, ReceiptText, Trash2, Wallet } from "lucide-react";
import { api, openPrivateFile } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date, rub } from "../format.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

// The receipts archive: every payment the user recorded, with the photo of its receipt.
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
          <Link to="/documents" className="inline-flex min-h-[48px] items-center rounded-full bg-navy px-6 text-label-lg text-white shadow-[0_10px_22px_-10px_rgb(16_38_92/0.8)] transition-all hover:-translate-y-px hover:brightness-125 dark:bg-primary dark:text-on-primary">{t("Ҳуҷҷатҳои ман")}</Link>
        </EmptyState>
      ) : (
        <>
          {/* The totals: how many payments (white) and how much in all (dark blue, the sum in gold). */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="flex flex-col items-start gap-3 rounded-[28px] bg-surface-container-lowest p-5 ring-1 ring-outline-variant/60">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-low text-primary">
                <ReceiptText className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-display text-[40px] font-black leading-none text-navy dark:text-on-surface">{list.length}</span>
              <span className="text-label-md text-on-surface-variant">{t("Пардохтҳо")}</span>
            </div>
            <div className="relative flex flex-col items-start gap-3 overflow-hidden rounded-[28px] bg-navy p-5 text-white shadow-[0_18px_36px_-18px_rgb(16_38_92/0.8)]">
              <div aria-hidden className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gold/25 blur-2xl" />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <span className="relative font-display text-[28px] font-black leading-none text-gold md:text-[40px]">{rub(total)}</span>
              <span className="relative text-label-md text-white/80">{t("Ҳамагӣ пардохт шуд")}</span>
            </div>
          </div>
          {list.map((p) => (
            <article key={p.id} className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6">
              <div className="flex flex-1 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
                  <ReceiptText className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <h3 className="font-display text-[18px] font-bold">{t(p.document_title)}</h3>
                  <p className="text-body-md">
                    <strong className="text-navy dark:text-on-surface">{rub(p.amount)}</strong> · {t("{0} моҳ", p.months)} · {date(p.paid_at)}
                  </p>
                  {p.note && <p className="text-body-sm text-on-surface-variant">{p.note}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {p.has_receipt ? (
                  <Button variant="soft" icon={Eye} onClick={() => openPrivateFile(`/documents/payments/${p.id}/receipt/`).catch(() => {})}>{t("Чек")}</Button>
                ) : (
                  <span className="self-center text-body-sm text-on-surface-variant">{t("Бе сурати чек")}</span>
                )}
                <Button variant="ghost" icon={Trash2} onClick={() => remove(p)} aria-label={t("Нест кардан")} />
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
