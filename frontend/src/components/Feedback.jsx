import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Angry, Bug, CheckCircle2, Frown, Heart, Laugh, Lightbulb, LogIn, Meh, MessageSquareText, MessagesSquare, Smile } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { StarPicker } from "./Stars.jsx";
import { Button, Drawer, ErrorBox, Field } from "./ui.jsx";

const KINDS = [
  { value: "idea", get label() { return t("Пешниҳод"); }, icon: Lightbulb },
  { value: "bug", get label() { return t("Хато дар сайт"); }, icon: Bug },
  { value: "praise", get label() { return t("Ташаккур"); }, icon: Heart },
  { value: "other", get label() { return t("Дигар"); }, icon: MessageSquareText },
];

const FACES = [
  { rating: 1, icon: Angry, get label() { return t("Тамоман не"); }, kind: "bug", hover: "group-hover:bg-error-container group-hover:text-on-error-container" },
  { rating: 2, icon: Frown, get label() { return t("Бад"); }, kind: "idea", hover: "group-hover:bg-error-container group-hover:text-on-error-container" },
  { rating: 3, icon: Meh, get label() { return t("Миёна"); }, kind: "idea", hover: "group-hover:bg-warning-fixed group-hover:text-on-warning-fixed" },
  { rating: 4, icon: Smile, get label() { return t("Хуб"); }, kind: "idea", hover: "group-hover:bg-tertiary-fixed group-hover:text-on-tertiary-fixed" },
  { rating: 5, icon: Laugh, get label() { return t("Аъло"); }, kind: "praise", hover: "group-hover:bg-tertiary-fixed group-hover:text-on-tertiary-fixed" },
];

function MyFeedback({ tick }) {
  const { data } = useApi(`/feedback/mine/?t=${tick}`);
  if (!data?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[16px] font-semibold">{t("Фикрҳои ман")}</h3>
      {data.map((f) => (
        <div key={f.id} className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 text-body-sm">
          <p className="flex justify-between gap-2 text-on-surface-variant">
            <span>{t(f.kind_label)}</span>
            <span>{ago(f.created_at)}</span>
          </p>
          <p className="whitespace-pre-line">{f.message}</p>
          {f.reply ? (
            <p className="whitespace-pre-line rounded-lg bg-primary-fixed/60 p-2.5">
              <span className="font-semibold">{t("Ҷавоби Muhojir:")}</span> {f.reply}
            </p>
          ) : (
            <p className="text-on-surface-variant">{f.status === "new" ? t("Ҳанӯз хонда нашуд") : t("Хонда шуд")}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function FeedbackForm({ start, onSent }) {
  const { pathname } = useLocation();
  const [kind, setKind] = useState(start?.kind || "idea");
  const [rating, setRating] = useState(start?.rating || null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/feedback/", { method: "POST", body: { kind, rating, message, page: pathname } });
      setMessage("");
      setRating(null);
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => setKind(k.value)} aria-pressed={kind === k.value} className={`flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-label-md ring-1 ring-inset transition-colors ${kind === k.value ? "bg-ink text-on-ink ring-ink" : "ring-outline-variant hover:bg-surface-container-low"}`}>
            <k.icon className="h-4 w-4 shrink-0" aria-hidden />
            {k.label}
          </button>
        ))}
      </div>
      <div>
        <span className="label">{t("Сайт ба шумо чӣ қадар писанд аст?")}</span>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <Field label={t("Фикри шумо")} required error={error?.data?.message}>
        <textarea className="input" rows={5} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === "bug" ? t("Чӣ кор кардед ва чӣ шуд? Масалан: тугмаи «Захира» дар саҳифаи ҳуҷҷатҳо кор намекунад.") : t("Чӣ хуб аст, чӣ намерасад, чиро илова кунем?")} />
      </Field>
      <ErrorBox error={error && !error.data?.message ? error : null} />
      <Button type="submit" loading={saving} disabled={message.trim().length < 5} icon={MessagesSquare}>
        {t("Фиристодан")}
      </Button>
    </form>
  );
}

export default function FeedbackBanner() {
  const { user } = useAuth();
  const [start, setStart] = useState(null);
  const [sent, setSent] = useState(false);
  const [tick, setTick] = useState(0);
  const open = start !== null;

  useEffect(() => {
    if (open) setSent(false);
  }, [open]);

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-primary-fixed/50 p-5 ring-1 ring-primary/20 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="flex max-w-xl flex-col gap-2">
            <span className="inline-flex items-center gap-2 text-label-md text-primary">
              <MessagesSquare className="h-4 w-4" aria-hidden />
              {t("Фикру мулоҳиза")}
            </span>
            <h2 className="font-display text-[24px] font-semibold leading-tight md:text-[28px]">{t("Чизе ба шумо писанд нест? Ба мо гӯед.")}</h2>
            <p className="text-body-md text-on-surface-variant">{t("Muhojir-ро барои шумо месозем. Хато, камбудӣ ё фикри нав — ҳар чӣ бошад, нависед. Ҳар фикрро мехонем ва ҷавоб медиҳем.")}</p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-label-md text-on-surface-variant">{t("Сайт ба шумо чӣ қадар писанд аст?")}</p>
            <div className="flex gap-1.5 md:gap-2">
              {FACES.map((f) => (
                <button key={f.rating} type="button" onClick={() => setStart({ rating: f.rating, kind: f.kind })} className="group flex w-[60px] flex-col items-center gap-1.5 rounded-xl py-2 transition-all hover:-translate-y-0.5 md:w-[68px]" aria-label={f.label}>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant transition-colors md:h-14 md:w-14 group-hover:ring-transparent ${f.hover}`}>
                    <f.icon className="h-6 w-6 transition-transform group-hover:scale-110 md:h-7 md:w-7" aria-hidden />
                  </span>
                  <span className="text-label-sm text-on-surface-variant">{f.label}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStart({ kind: "bug" })} className="inline-flex items-center gap-1.5 self-start text-label-md text-primary hover:underline">
              <Bug className="h-4 w-4" aria-hidden />
              {t("Дар сайт хато ёфтам")}
            </button>
          </div>
        </div>
      </section>
      {createPortal(
        <Drawer open={open} onClose={() => setStart(null)} title={t("Фикру мулоҳиза")} subtitle={t("Ба мо гӯед, чӣ хуб аст ва чиро беҳтар кунем.")} icon={MessagesSquare}>
          {!user ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-body-md text-on-surface-variant">{t("Барои навиштани фикр ворид шавед — ҷавоби моро дар огоҳиҳо мегиред.")}</p>
              <Link to="/login" state={{ from: window.location.pathname }} onClick={() => setStart(null)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-lg text-on-ink">
                <LogIn className="h-4 w-4" aria-hidden />
                {t("Ворид шудан")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {sent ? (
                <div className="flex flex-col items-start gap-3 rounded-xl bg-tertiary-fixed p-4 text-on-tertiary-fixed">
                  <span className="flex items-center gap-2 text-[16px] font-semibold">
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                    {t("Ташаккур! Фикри шумо расид.")}
                  </span>
                  <p className="text-body-sm">{t("Вақте ҷавоб диҳем, дар огоҳиҳо мебинед.")}</p>
                  <Button variant="plain" onClick={() => setSent(false)}>{t("Боз навиштан")}</Button>
                </div>
              ) : (
                <FeedbackForm key={JSON.stringify(start)} start={start} onSent={() => { setSent(true); setTick((n) => n + 1); }} />
              )}
              <MyFeedback tick={tick} />
            </div>
          )}
        </Drawer>,
        document.body,
      )}
    </>
  );
}
