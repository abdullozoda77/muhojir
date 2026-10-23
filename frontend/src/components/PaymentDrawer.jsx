import { useEffect, useState } from "react";
import { CheckCircle2, ReceiptText, Save, Wallet } from "lucide-react";
import { api, fileProblem } from "../api.js";
import { t } from "../i18n.js";
import { date, rub } from "../format.js";
import { Button, Drawer, ErrorBox, Field } from "./ui.jsx";

const today = () => new Date().toLocaleDateString("sv-SE"); // "2026-10-01" in the local time zone

// Record a payment for a document (e.g. the monthly patent tax) with a photo of the receipt.
// The server moves the document's end date forward by the months paid.
// doc = null: closed. monthlyPrice: the patent price of the document's region, to fill in the amount.
export default function PaymentDrawer({ doc, monthlyPrice, onClose, onSaved }) {
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!doc) return;
    setMonths(1);
    setAmount(monthlyPrice ? String(Math.round(monthlyPrice)) : "");
    setPaidAt(today());
    setNote("");
    setReceipt(null);
    setErrors({});
    setError(null);
    setDone(null);
  }, [doc, monthlyPrice]);

  const changeMonths = (value) => {
    setMonths(value);
    if (monthlyPrice) setAmount(String(Math.round(monthlyPrice * value)));
  };

  const chooseReceipt = (e) => {
    const file = e.target.files[0] || null;
    const problem = fileProblem(file);
    setErrors((x) => ({ ...x, receipt: problem }));
    setReceipt(problem ? null : file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    const data = new FormData();
    data.append("document", doc.id);
    data.append("months", months);
    data.append("amount", amount);
    data.append("paid_at", paidAt);
    data.append("note", note.trim());
    if (receipt) data.append("receipt", receipt);
    try {
      setDone(await api("/documents/payments/", { method: "POST", body: data }));
    } catch (err) {
      if (err.status === 400 && err.data && !err.data.detail) setErrors(err.data);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (done) onSaved();
    else onClose();
  };

  return (
    <Drawer open={Boolean(doc)} onClose={close} icon={Wallet} title={t("Пардохтро сабт кардан")} subtitle={doc && t(doc.document_type_title)}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </div>
          <h3 className="text-headline-sm">{t("Пардохт сабт шуд!")}</h3>
          <p className="max-w-sm text-body-md text-on-surface-variant">
            {t("Санаи нави анҷоми ҳуҷҷат: {0}. Ёдраскуниҳо аз рӯи ин сана меоянд.", date(done.document_expires_at))}
          </p>
          <Button onClick={close}>{t("Хуб")}</Button>
        </div>
      ) : doc ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="rounded-[22px] bg-primary-fixed p-3 text-body-sm text-on-primary-fixed">
            {t("Пулро дар бонк ё терминал пардохт кунед, баъд инҷо сабт кунед. Санаи анҷоми ҳуҷҷат ба қадри моҳҳои пардохтшуда дароз мешавад.")}
          </p>
          <p className="text-body-md">
            {t("Санаи ҳозираи анҷом")}: <strong>{date(doc.expires_at)}</strong>
          </p>
          <Field label={t("Барои чанд моҳ?")} required error={errors.months}>
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => changeMonths(m)} aria-pressed={months === m} className={`min-h-[48px] rounded-2xl text-label-lg ${months === m ? "bg-navy text-white dark:bg-primary dark:text-on-primary" : "bg-surface-container-low hover:bg-surface-container"}`}>
                  {m}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Маблағ (₽)")} required error={errors.amount} hint={monthlyPrice ? t("{0} дар як моҳ", rub(monthlyPrice)) : null}>
              <input className="input" type="number" inputMode="decimal" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label={t("Санаи пардохт")} required error={errors.paid_at}>
              <input className="input" type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
          </div>
          <div>
            <span className="label">{t("Сурати чек")}</span>
            <label className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-[22px] bg-surface-container-low p-4 text-center hover:bg-surface-container">
              <ReceiptText className="mb-1 h-7 w-7 text-primary" aria-hidden />
              <span className="text-label-md">{receipt ? receipt.name : t("Сурати чекро интихоб кунед")}</span>
              <span className="text-body-sm text-on-surface-variant">{t("Чек дар «Архиви чекҳо» нигоҳ дошта мешавад.")}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={chooseReceipt} />
            </label>
            {errors.receipt && <span className="mt-1 block text-body-sm text-error">{[].concat(errors.receipt).join(" ")}</span>}
          </div>
          <Field label={t("Ёддошт")} error={errors.note}>
            <input className="input" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Масалан: Сбербанк, терминал")} />
          </Field>
          <ErrorBox error={error || (errors.document && { message: [].concat(errors.document).join(" ") })} />
          <div className="flex gap-2">
            <Button variant="plain" onClick={onClose} className="w-1/3">{t("Бекор кардан")}</Button>
            <Button type="submit" icon={Save} loading={busy} className="flex-1">{t("Сабт кардан")}</Button>
          </div>
        </form>
      ) : null}
    </Drawer>
  );
}
