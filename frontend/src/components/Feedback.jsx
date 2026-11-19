import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Bug, CheckCircle2, Heart, ImagePlus, Lightbulb, LogIn, MessageSquareText, MessagesSquare, X } from "lucide-react";
import { api, openPrivateFile, errorText } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { StarPicker } from "./Stars.jsx";
import { fitPhoto } from "./Shop.jsx";
import { Button, Drawer, ErrorBox, Field } from "./ui.jsx";

const KINDS = [
  { value: "idea", get label() { return t("Пешниҳод"); }, icon: Lightbulb },
  { value: "bug", get label() { return t("Хато дар сайт"); }, icon: Bug },
  { value: "praise", get label() { return t("Ташаккур"); }, icon: Heart },
  { value: "other", get label() { return t("Дигар"); }, icon: MessageSquareText },
];

const FACES = [
  { rating: 1, get label() { return t("Бад"); }, kind: "idea", color: "#ef4444" },
  { rating: 3, get label() { return t("Миёна"); }, kind: "idea", color: "#f59e0b" },
  { rating: 4, get label() { return t("Хуб"); }, kind: "idea", color: "#84cc16" },
  { rating: 5, get label() { return t("Аъло"); }, kind: "praise", color: "#22c55e" },
];

const ACTIONS = KINDS.filter((k) => k.value !== "other");

function RatingScale({ onPick }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-lg text-on-surface">{t("Сайт ба шумо чӣ қадар писанд аст?")}</p>
      <div className="grid grid-cols-4 gap-2">
        {FACES.map((f) => (
          <button key={f.rating} type="button" onClick={() => onPick(f)} style={{ "--c": f.color }}
            className="group flex flex-col items-center gap-2.5 rounded-xl bg-surface px-1 pb-3 pt-2 ring-1 ring-inset ring-outline-variant/70 transition-all hover:-translate-y-0.5 hover:ring-[color:var(--c)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c)]">
            <span className="h-1.5 w-full rounded-full bg-[color:var(--c)] opacity-75 transition-opacity group-hover:opacity-100" aria-hidden />
            <span className="text-label-md text-on-surface">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

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
          {f.photo && (
            <button type="button" onClick={() => openPrivateFile(f.photo.replace(/^\/api/, "")).catch(() => null)} className="inline-flex items-center gap-1.5 self-start text-label-md text-primary hover:underline">
              <ImagePlus className="h-4 w-4" aria-hidden />
              {t("Дидани сурат")}
            </button>
          )}
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
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries({ kind, rating: rating ?? "", message, page: pathname }).forEach(([k, v]) => body.append(k, v));
      if (photo) body.append("photo", (await fitPhoto(photo, 1600).catch(() => null)) || photo, "photo.webp");
      await api("/feedback/", { method: "POST", body });
      setMessage("");
      setRating(null);
      setPhoto(null);
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
        <textarea className="input min-h-[180px] resize-y" rows={6} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === "bug" ? t("Чӣ кор кардед ва чӣ шуд? Масалан: тугмаи «Захира» дар саҳифаи ҳуҷҷатҳо кор намекунад.") : t("Чӣ хуб аст, чӣ намерасад, чиро илова кунем?")} />
      </Field>
      <div>
        <span className="label">{t("Сурат (агар хоҳед)")}</span>
        {preview ? (
          <div className="relative w-fit">
            <img src={preview} alt="" className="max-h-40 rounded-xl object-contain ring-1 ring-outline-variant" />
            <button type="button" onClick={() => setPhoto(null)} aria-label={t("Тоза кардан")} className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-on-ink shadow">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-outline/50 text-label-md text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface">
            <ImagePlus className="h-5 w-5" aria-hidden />
            {t("Сурат ё скриншот илова кардан")}
          </button>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { setPhoto(e.target.files?.[0] || null); e.target.value = ""; }} />
        {error?.data?.photo && <p className="mt-1 text-body-sm text-error">{errorText(error.data.photo)}</p>}
      </div>
      <ErrorBox error={error && !error.data?.message && !error.data?.photo ? error : null} />
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
      <section className="overflow-hidden rounded-3xl bg-surface-container-low ring-1 ring-outline-variant/50">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex flex-col gap-5 p-5 md:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <MessagesSquare className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-label-lg text-primary">{t("Фикру мулоҳиза")}</span>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[24px] font-semibold leading-tight md:text-[30px]">{t("Чизе ба шумо писанд нест? Ба мо гӯед.")}</h2>
              <p className="max-w-xl text-body-md text-on-surface-variant">{t("Muhojir-ро барои шумо месозем. Хато, камбудӣ ё фикри нав — ҳар чӣ бошад, нависед. Ҳар фикрро мехонем ва ҷавоб медиҳем.")}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ACTIONS.map((k) => (
                <button key={k.value} type="button" onClick={() => setStart({ kind: k.value })}
                  className="group flex min-h-[52px] items-center gap-3 rounded-xl bg-surface px-4 text-left text-label-md text-on-surface ring-1 ring-inset ring-outline-variant/70 transition-colors hover:bg-ink hover:text-on-ink hover:ring-ink">
                  <k.icon className="h-4 w-4 shrink-0 text-primary transition-colors group-hover:text-on-ink" aria-hidden />
                  <span className="flex-1">{k.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center border-t border-outline-variant/50 bg-primary-fixed/30 p-5 md:border-l md:border-t-0 md:p-8">
            <RatingScale onPick={(f) => setStart({ rating: f.rating, kind: f.kind })} />
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
