import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, EyeOff, Heart, MapPin, MessageCircle, Send, Trash2, UserRound } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { BackLink, Button, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";
import { canEdit } from "../components/Layout.jsx";
import { topicOf } from "./Questions.jsx";

function AnswerCard({ a, canChoose, onChange, onRemove, editor }) {
  const [busy, setBusy] = useState("");

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  };

  const like = () => run("like", async () => {
    const r = await api(`/questions/answers/${a.id}/like/`, { method: "POST" });
    onChange({ ...a, likes: r.likes, liked: r.liked });
  });
  const best = () => run("best", async () => {
    await api(`/questions/answers/${a.id}/best/`, { method: "POST" });
    onChange(null);
  });
  const remove = () => {
    if (!window.confirm(t("Ҷавобро нест кунем?"))) return;
    run("delete", async () => {
      await api(`/questions/answers/${a.id}/`, { method: "DELETE" });
      onRemove(a);
    });
  };
  const hide = () => run("hide", async () => {
    await api(`/questions/answers/${a.id}/`, { method: "PATCH", body: { is_hidden: !a.is_hidden } });
    onChange(null);
  });

  return (
    <article className={`card flex flex-col gap-3 p-5 ${a.best ? "ring-2 ring-tertiary" : ""} ${a.is_hidden ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-medium text-on-surface">{a.name}</span>
        {a.by_asker && <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm">{t("Савол-диҳанда")}</span>}
        <span>· {ago(a.created_at)}</span>
        {a.best && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-label-sm text-on-tertiary-fixed">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {t("Ҷавоби беҳтарин")}
          </span>
        )}
      </div>
      <p className="whitespace-pre-line text-body-md [overflow-wrap:anywhere]">{a.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={like} disabled={a.mine || !!busy} aria-pressed={a.liked} className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md ring-1 ring-inset transition-colors disabled:cursor-default ${a.liked ? "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-400" : "ring-outline-variant hover:bg-surface-container-low"}`}>
          <Heart className={`h-4 w-4 ${a.liked ? "fill-current" : ""}`} aria-hidden />
          <span className="tabular-nums">{a.likes}</span>
          <span className="sr-only">{t("Фоиданок")}</span>
        </button>
        {canChoose && (
          <button type="button" onClick={best} disabled={!!busy} className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md ring-1 ring-inset transition-colors ${a.best ? "bg-tertiary-fixed text-on-tertiary-fixed ring-transparent" : "ring-outline-variant hover:bg-surface-container-low"}`}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {a.best ? t("Бекор кардан") : t("Беҳтарин")}
          </button>
        )}
        {editor && (
          <button type="button" onClick={hide} disabled={!!busy} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low">
            <EyeOff className="h-4 w-4" aria-hidden />
            {a.is_hidden ? t("Нишон додан") : t("Пинҳон кардан")}
          </button>
        )}
        {a.can_delete && (
          <button type="button" onClick={remove} disabled={!!busy} className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md text-error hover:bg-error-container/50">
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("Нест кардан")}
          </button>
        )}
      </div>
    </article>
  );
}

export default function QuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editor = Boolean(canEdit(user));
  const { data: q, error, loading, reload } = useApi(`/questions/${id}/`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [answers, setAnswers] = useState(null);

  const list = answers && answers.id === q?.id ? answers.items : q?.answers || [];

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    try {
      await api(`/questions/${id}/answers/`, { method: "POST", body: { body } });
      setBody("");
      setAnswers(null);
      reload();
    } catch (er) {
      setSendError(er);
    } finally {
      setSending(false);
    }
  };

  const change = (a) => {
    if (a === null) {
      setAnswers(null);
      reload();
    } else {
      setAnswers({ id: q.id, items: list.map((x) => (x.id === a.id ? a : x)) });
    }
  };

  const removeQuestion = async () => {
    if (!window.confirm(t("Саволро нест кунем?"))) return;
    await api(`/questions/${id}/`, { method: "DELETE" });
    navigate("/questions", { replace: true });
  };

  if (loading && !q) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (error || !q) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/questions">{t("Ба ҳамаи саволҳо")}</BackLink>
        <ErrorBox error={error} />
      </div>
    );
  }

  const topic = topicOf(q.topic);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink to="/questions">{t("Ба ҳамаи саволҳо")}</BackLink>

      <section className="card flex flex-col gap-4 p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface">
            <topic.icon className="h-3.5 w-3.5" aria-hidden />
            {topic.label()}
          </span>
          {q.solved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-on-tertiary-fixed">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {t("Ҳалшуда")}
            </span>
          )}
          {q.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{q.city}</span>}
        </div>
        <h1 className="text-headline-md [overflow-wrap:anywhere]">{q.title}</h1>
        {q.body && <p className="whitespace-pre-line text-body-md text-on-surface [overflow-wrap:anywhere]">{q.body}</p>}
        <div className="flex flex-wrap items-center gap-3 text-label-md text-on-surface-variant">
          <span>{q.name} · {ago(q.created_at)}</span>
          {q.can_delete && (
            <button type="button" onClick={removeQuestion} className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-error hover:bg-error-container/50">
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Нест кардан")}
            </button>
          )}
        </div>
      </section>

      <h2 className="flex items-center gap-2 text-[20px] font-semibold">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
        {list.length ? t("{0} ҷавоб", list.length) : t("Ҳоло ҷавоб нест")}
      </h2>

      {list.length ? (
        <div className="flex flex-col gap-3">
          {list.map((a) => (
            <AnswerCard key={a.id} a={a} canChoose={q.can_choose_best} editor={editor} onChange={change}
              onRemove={() => { setAnswers(null); reload(); }} />
          ))}
        </div>
      ) : (
        <EmptyState icon={MessageCircle} title={t("Аввалин шуда ҷавоб диҳед")} text={t("Агар медонед, ба ҳамватан ёрӣ диҳед.")} />
      )}

      <form onSubmit={send} className="card flex flex-col gap-3 p-5">
        <label className="text-label-lg" htmlFor="answer">{q.mine ? t("Илова ё ҷавоб ба шарҳҳо") : t("Ҷавоби шумо")}</label>
        <textarea id="answer" className="input min-h-[110px] resize-y" rows={4} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("Аз таҷрибаи худ нависед: чӣ кор кардед, ба куҷо рафтед, чанд пул шуд.")} />
        <ErrorBox error={sendError} />
        <Button type="submit" loading={sending} icon={Send} disabled={body.trim().length < 5} className="self-end">{t("Ҷавоб додан")}</Button>
      </form>
    </div>
  );
}
