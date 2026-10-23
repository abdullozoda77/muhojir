import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Building2, ExternalLink, MessageSquarePlus, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { JobRow, SourceBadge, VerifiedBadge } from "../components/JobCard.jsx";
import { StarPicker, Stars, average } from "../components/Stars.jsx";
import { Button, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";

function ReviewForm({ employerId, review, onDone, onCancel }) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [text, setText] = useState(review?.text || "");
  const [unpaid, setUnpaid] = useState(review?.salary_not_paid || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError(new Error(t("Баҳоро бо ситораҳо интихоб кунед.")));
    setBusy(true);
    setError(null);
    try {
      const body = { employer: employerId, rating, text: text.trim(), salary_not_paid: unpaid };
      await api(review ? `/jobs/reviews/${review.id}/` : "/jobs/reviews/", { method: review ? "PATCH" : "POST", body });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-4 md:p-6">
      <h3 className="text-headline-sm">{review ? t("Таҳрири шарҳ") : t("Шарҳ навиштан")}</h3>
      <StarPicker value={rating} onChange={setRating} />
      <label className="block">
        <span className="label">{t("Шарҳи шумо")}</span>
        <textarea className="input h-auto py-3" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Шароити кор, маош сари вақт буд ё не...")} />
      </label>
      <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl p-4 ${unpaid ? "bg-error-container text-on-error-container" : "bg-surface-container-low"}`}>
        <input type="checkbox" className="h-5 w-5 rounded text-error focus:ring-error" checked={unpaid} onChange={(e) => setUnpaid(e.target.checked)} />
        <Ban className="h-5 w-5 text-error" aria-hidden />
        <span>
          <span className="block text-label-lg">{t("Маош надоданд")}</span>
          <span className="text-body-sm">{t("Ин шикоят ба админ барои санҷиш меравад.")}</span>
        </span>
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

export default function EmployerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const employer = useApi(`/jobs/employers/${id}/`);
  const reviews = useApi(`/jobs/reviews/?employer=${id}&page_size=100`);
  const jobs = useApi(`/jobs/jobs/?employer=${id}`);
  const [editing, setEditing] = useState(null);
  const [writing, setWriting] = useState(false);

  if (employer.loading) return <Skeleton className="h-96" />;
  if (employer.error) return employer.error.status === 404 ? <EmptyState title={t("Корфармо ёфт нашуд")} /> : <ErrorBox error={employer.error} />;

  const e = employer.data;
  const list = reviews.data?.results || [];
  const rating = average(list);
  const complaints = list.filter((r) => r.salary_not_paid).length;
  const canReview = Boolean(user);

  const refresh = () => {
    setEditing(null);
    setWriting(false);
    reviews.reload();
  };

  const remove = async (review) => {
    if (!window.confirm(t("Шарҳро нест кунем?"))) return;
    await api(`/jobs/reviews/${review.id}/`, { method: "DELETE" }).catch(() => {});
    refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <Link to="/jobs" className="inline-flex min-h-[44px] items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("Ҷойи кор")}
      </Link>

      {e.is_blacklisted && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-error-container p-4 text-on-error-container md:p-6">
          <ShieldAlert className="h-8 w-8 shrink-0 text-error" aria-hidden />
          <div>
            <p className="text-headline-sm text-error">{t("Ин ширкат дар рӯйхати сиёҳ аст")}</p>
            {e.blacklist_reason && <p className="mt-1 text-body-md"><strong>{t("Сабаб")}:</strong> {e.blacklist_reason}</p>}
            <p className="mt-1 text-body-sm">{t("Ба ин ширкат кор накунед.")}</p>
          </div>
        </div>
      )}

      <section className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:p-8">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
          <Building2 className="h-8 w-8" aria-hidden />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-headline-lg">{e.name}</h1>
            {e.is_verified && <VerifiedBadge />}
            {e.source === "trudvsem" && <SourceBadge />}
          </div>
          <p className="text-body-md text-on-surface-variant">{[e.city, e.inn && `ИНН: ${e.inn}`].filter(Boolean).join(" • ")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Stars value={rating ?? 0} size="h-5 w-5" />
            <span className="text-label-lg">{rating ? rating.toFixed(1) : "—"}</span>
            <span className="text-body-sm text-on-surface-variant">({t("{0} шарҳ", list.length)})</span>
            {complaints > 0 && <span className="rounded-full bg-error-container px-2.5 py-1 text-label-sm text-on-error-container">{t("{0} шикоят аз маош", complaints)}</span>}
          </div>
        </div>
        {e.website && (
          <a href={e.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-surface-container-low px-5 text-label-lg text-primary hover:bg-surface-container">
            <ExternalLink className="h-5 w-5" aria-hidden />
            {t("Сайт")}
          </a>
        )}
      </section>
      {e.description && <p className="card whitespace-pre-line p-4 text-body-lg md:p-6">{e.description}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-headline-md">{t("Шарҳҳои коргарон")}</h2>
            {canReview && !writing && !list.some((r) => r.is_mine) && (
              <Button variant="soft" icon={MessageSquarePlus} onClick={() => setWriting(true)}>{t("Шарҳ навиштан")}</Button>
            )}
          </div>
          {!user && <p className="text-body-sm text-on-surface-variant"><Link to="/login" className="text-primary underline">{t("Ворид шавед")}</Link>, {t("то шарҳ нависед.")}</p>}
          {writing && <ReviewForm employerId={e.id} onDone={refresh} onCancel={() => setWriting(false)} />}
          <ErrorBox error={reviews.error} />
          {list.length === 0 && !reviews.loading ? (
            <p className="card p-6 text-body-md text-on-surface-variant">{t("Ҳоло шарҳ нест. Шумо аввалин бошед.")}</p>
          ) : (
            list.map((r) =>
              editing?.id === r.id ? (
                <ReviewForm key={r.id} employerId={e.id} review={r} onDone={refresh} onCancel={() => setEditing(null)} />
              ) : (
                <article key={r.id} className={`card flex flex-col gap-2 p-4 md:p-6 ${r.salary_not_paid ? "ring-1 ring-error/40" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-label-lg">{r.author_name}</span>
                      <Stars value={r.rating} />
                    </div>
                    <span className="text-body-sm text-on-surface-variant">{date(r.created_at)}</span>
                  </div>
                  {r.salary_not_paid && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-error-container px-2.5 py-1 text-label-sm text-on-error-container">
                      <Ban className="h-3.5 w-3.5" aria-hidden />
                      {t("Маош надоданд")}
                    </span>
                  )}
                  {r.text && <p className="whitespace-pre-line text-body-md">{r.text}</p>}
                  {r.is_mine && (
                    <div className="flex gap-2">
                      <Button variant="ghost" icon={Pencil} onClick={() => setEditing(r)}>{t("Таҳрир")}</Button>
                      <Button variant="ghost" icon={Trash2} onClick={() => remove(r)}>{t("Нест кардан")}</Button>
                    </div>
                  )}
                </article>
              ),
            )
          )}
        </section>
        <section className="flex flex-col gap-4 lg:col-span-5">
          <h2 className="text-headline-md">{t("Эълонҳои ин ширкат")}</h2>
          {jobs.data?.results?.length ? (
            <div className="flex flex-col divide-y divide-surface-container rounded-3xl bg-surface-container-lowest p-2 shadow-sm">
              {jobs.data.results.map((j) => (
                <JobRow key={j.id} job={j} compact />
              ))}
            </div>
          ) : (
            <p className="card p-6 text-body-md text-on-surface-variant">{t("Ҳоло эълони фаъол нест.")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
