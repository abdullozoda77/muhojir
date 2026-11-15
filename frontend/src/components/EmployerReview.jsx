import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Banknote, CircleCheck, Clock, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { StarPicker, Stars } from "./Stars.jsx";
import { Button, ErrorBox } from "./ui.jsx";

export const PAID = {
  on_time: { icon: CircleCheck, label: () => t("Сари вақт доданд"), bar: "bg-primary", chip: "bg-tertiary-fixed text-on-tertiary-fixed" },
  late: { icon: Clock, label: () => t("Дер доданд"), bar: "bg-warning-container", chip: "bg-warning-fixed text-on-warning-fixed" },
  not_paid: { icon: Ban, label: () => t("Маош надоданд"), bar: "bg-error", chip: "bg-error-container text-on-error-container" },
};

function PaidChip({ value, className = "" }) {
  const paid = PAID[value];
  if (!paid) return null;
  const Icon = paid.icon;
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-label-sm ${paid.chip} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {paid.label()}
    </span>
  );
}

export function PayBadge({ employer, className = "" }) {
  const answered = employer.paid_on_time + employer.paid_late;
  if (employer.not_paid > 0) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-error-container px-2 py-1 text-label-sm text-on-error-container ${className}`}>
        <Ban className="h-3.5 w-3.5" aria-hidden />
        {t("Маош надоданд: {0}", employer.not_paid)}
      </span>
    );
  }
  if (!answered) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-tertiary-fixed px-2 py-1 text-label-sm text-on-tertiary-fixed ${className}`}>
      <Banknote className="h-3.5 w-3.5" aria-hidden />
      {t("Маош сари вақт: {0}%", Math.round((employer.paid_on_time / answered) * 100))}
    </span>
  );
}

export function PayStats({ employer }) {
  const total = employer.paid_on_time + employer.paid_late + employer.not_paid;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[22px] font-semibold leading-none tabular-nums">{employer.rating ? employer.rating.toFixed(1) : "—"}</span>
        <Stars value={employer.rating ?? 0} size="h-4 w-4" />
        <span className="text-body-sm text-on-surface-variant">({t("{0} шарҳ", employer.reviews_count)})</span>
      </div>
      {total > 0 ? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-high" aria-hidden>
            {["on_time", "late", "not_paid"].map((kind) => {
              const count = employer[kind === "on_time" ? "paid_on_time" : kind === "late" ? "paid_late" : "not_paid"];
              return count ? <span key={kind} className={PAID[kind].bar} style={{ width: `${(count / total) * 100}%` }} /> : null;
            })}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
            <li>{PAID.on_time.label()}: <strong className="tabular-nums">{employer.paid_on_time}</strong></li>
            <li>{PAID.late.label()}: <strong className="tabular-nums">{employer.paid_late}</strong></li>
            <li className={employer.not_paid ? "text-error" : ""}>{PAID.not_paid.label()}: <strong className="tabular-nums">{employer.not_paid}</strong></li>
          </ul>
        </>
      ) : (
        <p className="text-body-sm text-on-surface-variant">{t("Ҳоло касе нанавиштааст, ки маош сари вақт буд ё не.")}</p>
      )}
    </div>
  );
}

function PaidPicker({ value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label">{t("Маошро сари вақт доданд?")}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {Object.entries(PAID).map(([kind, paid]) => {
          const Icon = paid.icon;
          const on = value === kind;
          return (
            <button key={kind} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? "" : kind)}
              className={`flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-left text-label-md ring-1 ring-inset transition-colors ${on ? `${paid.chip} ring-transparent` : "ring-outline-variant hover:bg-surface-container-low"}`}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {paid.label()}
            </button>
          );
        })}
      </div>
      {value === "not_paid" && (
        <p className="text-body-sm text-error">{t("Ширкат бо шикояти шумо ба рӯйхати сиёҳ меравад. Агар баъд маошро диҳанд, шарҳро иваз кунед — шикоят нест мешавад.")}</p>
      )}
    </fieldset>
  );
}

export function ReviewForm({ employerId, jobId, review, onDone, onCancel }) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [text, setText] = useState(review?.text || "");
  const [paid, setPaid] = useState(review?.salary_paid || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError(new Error(t("Баҳоро бо ситораҳо интихоб кунед.")));
    setBusy(true);
    setError(null);
    try {
      const body = { employer: employerId, rating, text: text.trim(), salary_paid: paid };
      if (jobId && !review?.job) body.job = jobId;
      await api(review ? `/jobs/reviews/${review.id}/` : "/jobs/reviews/", { method: review ? "PATCH" : "POST", body });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-6 md:p-7">
      <h3 className="text-[18px] font-semibold">{review ? t("Таҳрири шарҳ") : t("Шарҳ навиштан")}</h3>
      <StarPicker value={rating} onChange={setRating} />
      <PaidPicker value={paid} onChange={setPaid} />
      <label className="block">
        <span className="label">{t("Шарҳи шумо")}</span>
        <textarea className="input h-auto py-3" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Шароити кор, маош сари вақт буд ё не...")} />
      </label>
      <p className="text-body-sm text-on-surface-variant">{t("Дар шарҳ танҳо номи шумо (бе насаб) нишон дода мешавад.")}</p>
      <ErrorBox error={error} />
      <div className="flex gap-2">
        {onCancel && <Button variant="plain" onClick={onCancel}>{t("Бекор кардан")}</Button>}
        <Button type="submit" loading={busy} className="flex-1">{t("Фиристодан")}</Button>
      </div>
    </form>
  );
}

export function ReviewItem({ review, onEdit, onRemove }) {
  const remove = async () => {
    if (!window.confirm(t("Шарҳро нест кунем?"))) return;
    await api(`/jobs/reviews/${review.id}/`, { method: "DELETE" }).catch(() => {});
    onRemove();
  };
  return (
    <article className={`card flex flex-col gap-3 p-5 md:p-6 ${review.salary_paid === "not_paid" ? "!ring-2 !ring-error/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[14px] font-semibold ring-1 ring-outline-variant" aria-hidden>{(review.author_name || "?").charAt(0)}</span>
          <span className="text-[15px] font-semibold">{review.is_mine ? t("Шумо") : review.author_name}</span>
          <Stars value={review.rating} />
        </div>
        <span className="text-body-sm text-on-surface-variant">{date(review.created_at)}</span>
      </div>
      {(review.salary_paid || review.job) && (
        <div className="flex flex-wrap items-center gap-2">
          <PaidChip value={review.salary_paid} />
          {review.job && <Link to={`/jobs/${review.job.id}`} className="text-body-sm text-on-surface-variant underline-offset-2 hover:underline">{t("Кор: {0}", review.job.title)}</Link>}
        </div>
      )}
      {review.text && <p className="whitespace-pre-line text-body-md">{review.text}</p>}
      {review.is_mine && (
        <div className="flex gap-2">
          <Button variant="ghost" icon={Pencil} onClick={onEdit}>{t("Таҳрир")}</Button>
          <Button variant="ghost" icon={Trash2} onClick={remove}>{t("Нест кардан")}</Button>
        </div>
      )}
    </article>
  );
}

export function useReviews(employerId, size = 100) {
  return useApi(employerId ? `/jobs/reviews/?employer=${employerId}&page_size=${size}` : null);
}

export function ReviewList({ employerId, jobId, reviews, limit, onChange }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(null);
  const [writing, setWriting] = useState(false);
  const list = reviews.data?.results || [];
  const mine = list.find((r) => r.is_mine);
  const shown = limit ? list.slice(0, limit) : list;
  if (limit && mine && !shown.includes(mine)) shown.unshift(mine);

  const refresh = () => {
    setEditing(null);
    setWriting(false);
    reviews.reload();
    onChange?.();
  };

  return (
    <div className="flex flex-col gap-4">
      {user && !writing && !mine && (
        <Button variant="plain" icon={MessageSquarePlus} onClick={() => setWriting(true)} className="self-start">{t("Шарҳ навиштан")}</Button>
      )}
      {!user && <p className="text-body-sm text-on-surface-variant"><Link to="/login" className="text-primary underline">{t("Ворид шавед")}</Link>, {t("то шарҳ нависед.")}</p>}
      {writing && <ReviewForm employerId={employerId} jobId={jobId} onDone={refresh} onCancel={() => setWriting(false)} />}
      <ErrorBox error={reviews.error} />
      {list.length === 0 && !reviews.loading ? (
        <p className="card p-7 text-body-md text-on-surface-variant">{t("Ҳоло шарҳ нест. Шумо аввалин бошед.")}</p>
      ) : (
        shown.map((r) =>
          editing?.id === r.id ? (
            <ReviewForm key={r.id} employerId={employerId} jobId={jobId} review={r} onDone={refresh} onCancel={() => setEditing(null)} />
          ) : (
            <ReviewItem key={r.id} review={r} onEdit={() => setEditing(r)} onRemove={refresh} />
          ),
        )
      )}
    </div>
  );
}
