import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Award, Check, Clock, PenLine, ShieldCheck, Timer, Volume2, X } from "lucide-react";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { canSpeak, speak } from "../speech.js";
import { BackLink, Button, ErrorBox, Field, Skeleton } from "../components/ui.jsx";

const saveKey = (id) => `course-exam-${id}`;

function readAnswers(id, size) {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey(id)));
    if (Array.isArray(saved) && saved.length === size) return saved;
  } catch {
  }
  return Array(size).fill(null);
}

function keepAnswers(id, answers) {
  try {
    if (answers) localStorage.setItem(saveKey(id), JSON.stringify(answers));
    else localStorage.removeItem(saveKey(id));
  } catch {
  }
}

const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const time = (value) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function Start({ level, info, onStarted }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const start = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onStarted(await api(`/course/levels/${level.level}/exam/`, { method: "POST", body: { full_name: name } }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={start} className="card flex flex-col gap-5 p-6 md:p-9">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-on-ink"><PenLine className="h-6 w-6" aria-hidden /></span>
        <div>
          <p className="text-label-md text-on-surface-variant">{t("Сатҳи {0}", level.level)}</p>
          <h1 className="text-[24px] font-semibold leading-tight">{t("Имтиҳон: {0}", level.title)}</h1>
        </div>
      </div>
      <ul className="flex flex-col gap-2 text-body-md">
        {[
          [Check, t("{0} савол аз ҳамаи 10 дарси сатҳ", info.exam_size)],
          [Timer, t("{0} дақиқа вақт. Вақт тамом шавад, ҷавобҳо худ ба худ фиристода мешаванд.", info.exam_minutes)],
          [Award, t("Барои сертификат {0}% ҷавоби дуруст лозим", info.pass_percent)],
          [Clock, t("Агар нагузаред, баъд аз 1 соат боз супоридан мумкин")],
        ].map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-2.5"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />{text}</li>
        ))}
      </ul>
      <Field label={t("Ному насаб барои сертификат")} required hint={t("Мисли шиноснома нависед — маҳз ҳамин ном дар сертификат чоп мешавад.")}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={150} required autoComplete="name" />
      </Field>
      <ErrorBox error={error} />
      <Button type="submit" loading={busy} icon={ArrowRight} className="self-start">{level.exam.open ? t("Идома додан") : t("Оғози имтиҳон")}</Button>
    </form>
  );
}

function Questions({ exam, onFinished }) {
  const size = exam.questions.length;
  const [answers, setAnswers] = useState(() => readAnswers(exam.id, size));
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(exam.ends_at) - Date.now()) / 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const sent = useRef(false);
  const q = exam.questions[index];
  const unanswered = answers.filter((a) => a === null).length;

  const submit = useCallback(async () => {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/course/exams/${exam.id}/submit/`, { method: "POST", body: { answers } });
      keepAnswers(exam.id, null);
      onFinished(result);
    } catch (err) {
      sent.current = false;
      setError(err);
      setBusy(false);
    }
  }, [answers, exam.id, onFinished]);

  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, Math.round((new Date(exam.ends_at) - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [exam.ends_at]);

  useEffect(() => {
    if (left === 0) submit();
  }, [left, submit]);

  const choose = (option) => {
    const next = answers.map((a, i) => (i === index ? option : a));
    setAnswers(next);
    keepAnswers(exam.id, next);
  };

  const finish = () => {
    if (unanswered && !window.confirm(t("{0} савол бе ҷавоб монд. Имтиҳонро тамом мекунед?", unanswered))) return;
    submit();
  };

  return (
    <div className="card flex flex-col gap-5 p-5 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-md tabular-nums text-on-surface-variant">{t("Савол {0} аз {1}", index + 1, size)}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-lg tabular-nums ${left < 120 ? "bg-error-container text-on-error-container" : "bg-surface-container-high"}`} role="timer" aria-label={t("Вақти боқимонда")}>
          <Timer className="h-4 w-4" aria-hidden />{clock(left)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={t("Саволҳо")}>
        {exam.questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index}
            className={`h-8 w-8 rounded-lg text-[12px] font-semibold tabular-nums transition-colors ${i === index ? "bg-ink text-on-ink" : answers[i] !== null ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface-variant"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <h2 className="text-[21px] font-semibold leading-snug">{q.q}</h2>
      {q.listen && canSpeak && <Button icon={Volume2} variant="soft" className="self-start" onClick={() => speak(q.listen)}>{t("Гӯш кардан")}</Button>}
      {q.ru && <p lang="ru" className="rounded-xl bg-surface-container-low px-4 py-3 text-[19px] font-semibold ring-1 ring-outline-variant">{q.ru}</p>}
      <div className="flex flex-col gap-2">
        {q.options.map((option, i) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(i)}
            className={`flex min-h-[52px] items-center gap-3 rounded-xl px-4 py-3 text-left text-body-lg ring-inset transition-all ${answers[index] === i ? "bg-primary-fixed text-on-primary-fixed ring-2 ring-primary" : "ring-1 ring-outline-variant hover:bg-surface-container-low"}`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${answers[index] === i ? "bg-primary ring-primary" : "ring-outline"}`}>
              {answers[index] === i && <Check className="h-4 w-4 text-on-primary" aria-hidden />}
            </span>
            {option}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" icon={ArrowLeft} disabled={index === 0} onClick={() => setIndex(index - 1)}>{t("Пеш")}</Button>
        {index + 1 < size ? (
          <Button icon={ArrowRight} onClick={() => setIndex(index + 1)}>{t("Савол навбатӣ")}</Button>
        ) : (
          <Button variant="accent" loading={busy} onClick={finish}>{t("Тамом кардан")}</Button>
        )}
      </div>
      {index + 1 < size && (
        <button type="button" onClick={finish} disabled={busy} className="self-end text-label-md text-on-surface-variant underline underline-offset-4 hover:text-on-surface">
          {t("Тамом кардан ва фиристодан")}
        </button>
      )}
    </div>
  );
}

function Result({ result, level }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col items-center gap-4 p-8 text-center md:p-12">
        <span className={`flex h-28 w-28 items-center justify-center rounded-full text-[34px] font-semibold tabular-nums ring-4 ${result.passed ? "text-tertiary ring-tertiary/40" : "text-warning ring-warning-container/50"}`}>
          {result.percent}%
        </span>
        <h1 className="text-[26px] font-semibold">{result.passed ? t("Табрик! Шумо имтиҳонро супоридед!") : t("Ин дафъа нашуд")}</h1>
        <p className="max-w-md text-body-md text-on-surface-variant">
          {t("{0} аз {1} ҷавоби дуруст.", result.right, result.total)}{" "}
          {result.late && t("Ҷавобҳо баъд аз тамом шудани вақт расиданд. ")}
          {!result.passed && result.wait_until && t("Дарсҳоро такрор кунед ва аз соати {0} боз кӯшиш кунед.", time(result.wait_until))}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {result.certificate && (
            <Link to={`/certificates/${result.certificate.code}`} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-ink px-6 text-label-lg text-on-ink hover:bg-ink/90">
              <Award className="h-5 w-5" aria-hidden />{t("Сертификатро дидан")}
            </Link>
          )}
          <Link to="/course" className="inline-flex min-h-[48px] items-center rounded-xl px-5 text-label-lg ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low">
            {result.passed && level < 7 ? t("Ба сатҳи навбатӣ") : t("Ба курс")}
          </Link>
        </div>
      </div>
      <section className="card flex flex-col gap-3 p-5 md:p-7">
        <h2 className="text-[19px] font-semibold">{t("Таҳлили ҷавобҳо")}</h2>
        <ol className="flex flex-col gap-2">
          {result.review.map((item, i) => (
            <li key={i} className={`flex flex-col gap-1 rounded-xl p-3 ring-1 ring-inset ${item.right ? "ring-outline-variant" : "bg-error-container/30 ring-error/30"}`}>
              <span className="flex items-start gap-2 text-body-md font-semibold">
                {item.right ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-label={t("Дуруст")} /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-label={t("Хато")} />}
                {i + 1}. {item.q}
              </span>
              {!item.right && (
                <span className="pl-6 text-body-sm text-on-surface-variant">
                  {item.picked !== null && <>{t("Ҷавоби шумо:")} <s>{item.options[item.picked]}</s> · </>}
                  {t("Дуруст:")} <strong className="text-on-surface">{item.options[item.answer]}</strong>
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function CourseExam() {
  const { level: levelParam } = useParams();
  const number = Number(levelParam);
  const { data, error } = useApi("/course/");
  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [exam, result]);

  if (error) return <ErrorBox error={error} className="mt-8" />;
  if (!data) return <Skeleton className="mt-8 h-96" />;
  const level = data.levels.find((l) => l.level === number);
  if (!level) return <Navigate to="/course" replace />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-2 md:pt-6">
      {!exam && <BackLink to="/course">{t("Курси забони русӣ")}</BackLink>}
      {result ? (
        <Result result={result} level={number} />
      ) : exam ? (
        <Questions exam={exam} onFinished={setResult} />
      ) : level.exam.certificate ? (
        <div className="card flex flex-col items-start gap-4 p-8">
          <ShieldCheck className="h-8 w-8 text-tertiary" aria-hidden />
          <h1 className="text-[22px] font-semibold">{t("Шумо ин сатҳро аллакай супоридаед")}</h1>
          <Link to={`/certificates/${level.exam.certificate.code}`} className="text-label-lg text-primary underline underline-offset-4">{t("Сертификатро дидан")}</Link>
        </div>
      ) : !level.exam.ready ? (
        <div className="card flex flex-col items-start gap-4 p-8">
          <h1 className="text-[22px] font-semibold">{t("Аввал дарсҳоро хатм кунед")}</h1>
          <p className="text-body-md text-on-surface-variant">{t("Барои имтиҳон ҳамаи дарсҳоро хатм кунед: {0} аз {1}", level.exam.lessons_done, level.exam.lessons_total)}</p>
          <Link to="/course" className="text-label-lg text-primary underline underline-offset-4">{t("Ба курс")}</Link>
        </div>
      ) : level.exam.wait_until ? (
        <div className="card flex flex-col items-start gap-4 p-8">
          <Clock className="h-8 w-8 text-warning" aria-hidden />
          <h1 className="text-[22px] font-semibold">{t("Боз аз соати {0}", time(level.exam.wait_until))}</h1>
          <p className="text-body-md text-on-surface-variant">{t("Дар ин вақт дарсҳоро такрор кунед.")}</p>
        </div>
      ) : (
        <Start level={level} info={data} onStarted={setExam} />
      )}
    </div>
  );
}
