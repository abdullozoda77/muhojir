import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Lightbulb, Lock, RotateCcw, Undo2, X } from "lucide-react";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { BackLink, Button, ErrorBox, Skeleton } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const clean = (text) => text.toLowerCase().replace(/ё/g, "е").replace(/[.,!?;:«»"—–-]/g, " ").replace(/\s+/g, " ").trim();
const pieces = (text) => text.replace(/[.,!?;:«»"—–]/g, " ").split(/\s+/).filter(Boolean);

function Say({ text, className = "" }) {
  return <span lang="ru" className={className}>{text}</span>;
}

const progressKey = (level, number) => `lesson-progress-${level}-${number}`;

function readProgress(level, number, total) {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey(level, number)));
    if (saved && saved.index > 0 && saved.index < total) return saved;
  } catch {
  }
  return null;
}

const PENDING = "lesson-pending";

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING));
  } catch {
    return null;
  }
}

function keepPending(value) {
  try {
    if (value) sessionStorage.setItem(PENDING, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING);
  } catch {
  }
}

function keepProgress(level, number, value) {
  try {
    if (value) localStorage.setItem(progressKey(level, number), JSON.stringify(value));
    else localStorage.removeItem(progressKey(level, number));
  } catch {
  }
}

function Theory({ lesson }) {
  return (
    <div className="flex flex-col gap-4">
      {lesson.theory.map((block) => (
        <Reveal key={block.title} className="card flex flex-col gap-3 p-5 md:p-7">
          <h2 className="flex items-center gap-2 text-[19px] font-semibold">
            <Lightbulb className="h-5 w-5 shrink-0 text-warning" aria-hidden />
            {block.title}
          </h2>
          <p className="text-body-lg leading-relaxed text-on-surface">{block.text}</p>
          {block.examples?.length > 0 && (
            <ul className="mt-1 flex flex-col divide-y divide-outline-variant rounded-xl bg-surface-container-low ring-1 ring-outline-variant">
              {block.examples.map(([ru, tg]) => (
                <li key={ru} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Say text={ru} className="text-body-lg font-semibold" />
                  <span className="text-body-md text-on-surface-variant">{tg}</span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      ))}
      <Reveal className="card flex flex-col gap-3 p-5 md:p-7">
        <h2 className="text-[19px] font-semibold">{t("Калимаҳои дарс")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {lesson.words.map(([ru, tg]) => (
            <li key={ru} className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 ring-1 ring-inset ring-outline-variant">
              <Say text={ru} className="text-body-lg font-semibold" />
              <span className="text-right text-body-sm text-on-surface-variant">{tg}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}

function Choice({ exercise, onAnswer }) {
  const choices = useMemo(() => shuffle(exercise.options.map((text, i) => ({ text, right: i === exercise.answer }))), [exercise]);
  const [picked, setPicked] = useState(null);
  const pick = (choice) => {
    if (picked) return;
    setPicked(choice);
    onAnswer(choice.right);
  };
  return (
    <div className="flex flex-col gap-4">
      {exercise.ru && <p lang="ru" className="rounded-xl bg-surface-container-low px-4 py-3 text-[20px] font-semibold ring-1 ring-outline-variant">{exercise.ru}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const state = !picked ? "" : choice.right ? "right" : choice === picked ? "wrong" : "dim";
          return (
            <button
              key={choice.text}
              type="button"
              disabled={Boolean(picked)}
              onClick={() => pick(choice)}
              className={`flex min-h-[52px] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-body-lg ring-1 ring-inset transition-all ${
                state === "right" ? "bg-tertiary-fixed text-on-tertiary-fixed ring-2 ring-tertiary"
                  : state === "wrong" ? "bg-error-container text-on-error-container ring-2 ring-error"
                  : state === "dim" ? "opacity-50 ring-outline-variant"
                  : "ring-outline-variant hover:bg-surface-container-low"
              }`}
            >
              {choice.text}
              {state === "right" && <Check className="h-5 w-5 shrink-0" aria-hidden />}
              {state === "wrong" && <X className="h-5 w-5 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
      {picked && exercise.explain && (
        <p className={`rounded-xl border-l-[3px] p-4 text-body-md ${picked.right ? "border-tertiary bg-tertiary-fixed/50" : "border-error bg-error-container/50"}`} role="status">
          <strong>{picked.right ? t("Дуруст!") : t("Хато.")}</strong> {exercise.explain}
        </p>
      )}
    </div>
  );
}

function Build({ exercise, onAnswer }) {
  const tiles = useMemo(() => shuffle(pieces(exercise.answer).map((word, id) => ({ word, id }))), [exercise]);
  const [chosen, setChosen] = useState([]);
  const [result, setResult] = useState(null);
  const left = tiles.filter((tile) => !chosen.includes(tile));
  const check = () => {
    const right = clean(chosen.map((tile) => tile.word).join(" ")) === clean(exercise.answer);
    setResult(right);
    onAnswer(right);
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-surface-container-low px-4 py-3 text-[19px] font-semibold ring-1 ring-outline-variant">{exercise.tg}</p>
      <div className={`flex min-h-[60px] flex-wrap items-center gap-2 rounded-xl border-2 border-dashed p-3 ${result === null ? "border-outline-variant" : result ? "border-tertiary bg-tertiary-fixed/40" : "border-error bg-error-container/40"}`} lang="ru">
        {chosen.length === 0 && <span className="px-1 text-body-sm text-on-surface-variant">{t("Калимаҳоро бо тартиби дуруст пахш кунед")}</span>}
        {chosen.map((tile) => (
          <button key={tile.id} type="button" disabled={result !== null} onClick={() => setChosen(chosen.filter((c) => c !== tile))} className="min-h-[40px] rounded-lg bg-ink px-3 text-body-lg text-on-ink">
            {tile.word}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" lang="ru">
        {left.map((tile) => (
          <button key={tile.id} type="button" disabled={result !== null} onClick={() => setChosen([...chosen, tile])} className="min-h-[40px] rounded-lg bg-surface-container-lowest px-3 text-body-lg ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            {tile.word}
          </button>
        ))}
      </div>
      {result === null ? (
        <div className="flex gap-2">
          <Button onClick={check} disabled={left.length > 0}>{t("Санҷидан")}</Button>
          {chosen.length > 0 && <Button variant="ghost" icon={Undo2} onClick={() => setChosen(chosen.slice(0, -1))}>{t("Бозгашт")}</Button>}
        </div>
      ) : (
        <p className={`rounded-xl border-l-[3px] p-4 text-body-md ${result ? "border-tertiary bg-tertiary-fixed/50" : "border-error bg-error-container/50"}`} role="status">
          <strong>{result ? t("Дуруст!") : t("Хато.")}</strong>{" "}
          {t("Ҷавоб:")} <Say text={exercise.answer} className="font-semibold" />
        </p>
      )}
    </div>
  );
}

function Practice({ lesson, start, onSave, onDone }) {
  const [index, setIndex] = useState(start?.index ?? 0);
  const [answered, setAnswered] = useState(null);
  const [right, setRight] = useState(start?.right ?? 0);
  const exercise = lesson.exercises[index];
  const total = lesson.exercises.length;

  const answer = (ok) => {
    const score = right + (ok ? 1 : 0);
    setAnswered(ok);
    setRight(score);
    if (index + 1 < total) onSave({ index: index + 1, right: score });
  };
  const next = () => {
    if (index + 1 >= total) onDone(Math.round((right * 100) / total));
    else {
      setIndex(index + 1);
      setAnswered(null);
    }
  };

  return (
    <div className="card flex flex-col gap-5 p-5 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-md tabular-nums text-on-surface-variant">{t("Машқ {0} аз {1}", index + 1, total)}</span>
        <span className="text-label-md tabular-nums text-tertiary">{t("{0} дуруст", right)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(index / total) * 100}%` }} />
      </div>
      <h3 className="text-[20px] font-semibold leading-snug">{exercise.type === "build" ? t("Ҷумларо ба русӣ созед:") : exercise.q}</h3>
      {exercise.type === "build"
        ? <Build key={index} exercise={exercise} onAnswer={answer} />
        : <Choice key={index} exercise={exercise} onAnswer={answer} />}
      {answered !== null && (
        <Button onClick={next} icon={ArrowRight} className="self-end">
          {index + 1 < total ? t("Машқи навбатӣ") : t("Натиҷа")}
        </Button>
      )}
    </div>
  );
}

function Result({ percent, lesson, user, saved, saveError, onRetry }) {
  const passed = percent >= lesson.lesson_pass;
  const nextLink = lesson.number < lesson.lessons_total ? `/course/${lesson.level}/${lesson.number + 1}` : `/course/${lesson.level}/exam`;
  return (
    <div className="card flex flex-col items-center gap-4 p-8 text-center md:p-12">
      <span className={`flex h-24 w-24 items-center justify-center rounded-full text-[30px] font-semibold tabular-nums ring-4 ${passed ? "text-tertiary ring-tertiary/40" : "text-warning ring-warning-container/50"}`}>
        {percent}%
      </span>
      <h2 className="text-[24px] font-semibold">{passed ? t("Дарс хатм шуд!") : t("Боз як бор кӯшиш кунед")}</h2>
      <p className="max-w-md text-body-md text-on-surface-variant">
        {passed
          ? saved ? t("Натиҷа нигоҳ дошта шуд.") : t("Барои нигоҳ доштани натиҷа ва гирифтани сертификат ворид шавед.")
          : t("Барои хатми дарс ҳадди ақал {0}% лозим. Назарияро боз хонед ва машқро такрор кунед.", lesson.lesson_pass)}
      </p>
      <ErrorBox error={saveError} />
      <div className="flex flex-wrap justify-center gap-2">
        {passed && !user && (
          <Link to="/login" state={{ from: `/course/${lesson.level}/${lesson.number}` }} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-lg text-on-ink hover:bg-ink/90">
            {t("Ворид шудан ва идома додан")}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        )}
        {passed && saved && (
          <Link to={nextLink} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-lg text-on-ink hover:bg-ink/90">
            {lesson.number < lesson.lessons_total ? t("Дарси навбатӣ") : t("Ба имтиҳон")}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        )}
        <Button variant="plain" icon={RotateCcw} onClick={onRetry}>{t("Аз нав")}</Button>
      </div>
    </div>
  );
}

export default function Lesson() {
  const { level, number } = useParams();
  const { user } = useAuth();
  const { data: lesson, error, loading } = useApi(`/course/levels/${level}/lessons/${number}/?u=${user?.id ?? ""}`);
  const [stage, setStage] = useState("learn");
  const [percent, setPercent] = useState(0);
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    setSaved(false);
    window.scrollTo({ top: 0 });
  }, [level, number]);

  useEffect(() => {
    if (!lesson) return;
    const saved = readProgress(level, number, lesson.exercises.length);
    setResume(saved);
    setStage(saved ? "practice" : "learn");
  }, [lesson, level, number]);

  useEffect(() => {
    const pending = readPending();
    if (!user || !lesson || !pending || pending.level !== Number(level) || pending.number !== Number(number)) return;
    keepPending(null);
    api(`/course/levels/${level}/lessons/${number}/complete/`, { method: "POST", body: { score: pending.score } })
      .then(() => {
        setPercent(pending.score);
        setSaved(true);
        setStage("done");
      })
      .catch(setSaveError);
  }, [user, lesson, level, number]);

  const save = (value) => {
    keepProgress(level, number, value);
    setResume(value);
  };

  const finish = async (score) => {
    save(null);
    setPercent(score);
    setStage("done");
    setSaveError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (score < lesson.lesson_pass) return;
    if (!user) {
      keepPending({ level: Number(level), number: Number(number), score });
      return;
    }
    try {
      await api(`/course/levels/${level}/lessons/${number}/complete/`, { method: "POST", body: { score } });
      setSaved(true);
    } catch (err) {
      setSaveError(err);
    }
  };

  if (loading || (!lesson && !error)) return <Skeleton className="mt-8 h-96" />;
  if (error?.status === 403) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-2 md:pt-6">
        <BackLink to="/course">{t("Курси забони русӣ")}</BackLink>
        <div className="card flex flex-col items-start gap-4 p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high"><Lock className="h-6 w-6" aria-hidden /></span>
          <h1 className="text-[22px] font-semibold">{t("Ин дарс ҳоло баста аст")}</h1>
          <p className="text-body-md text-on-surface-variant">
            {user ? t("Дарсҳо бо тартиб кушода мешаванд: аввал дарси пешинаро хатм кунед.") : t("Барои идома додан ворид шавед — пешрафти шумо нигоҳ дошта мешавад ва дарсҳо бо тартиб кушода мешаванд.")}
          </p>
          <Link to={user ? "/course" : "/login"} state={user ? undefined : { from: `/course/${level}/${number}` }} className="inline-flex min-h-[44px] items-center rounded-xl bg-ink px-5 text-label-lg text-on-ink hover:bg-ink/90">
            {user ? t("Ба курс") : t("Ворид шудан")}
          </Link>
        </div>
      </div>
    );
  }
  if (error) return <ErrorBox error={error} className="mt-8" />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-2 md:pt-6">
      <BackLink to="/course">{t("Курси забони русӣ")}</BackLink>
      <header className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface-variant">
          {t("Сатҳи {0}", lesson.level)} · {lesson.level_title} · {t("Дарси {0} аз {1}", lesson.number, lesson.lessons_total)}
        </span>
        <h1 className="font-display text-[28px] font-semibold leading-tight md:text-[36px]">{lesson.title}</h1>
        <p className="text-body-lg text-on-surface-variant">{lesson.goal}</p>
        {lesson.score !== null && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-tertiary-fixed px-3 py-1 text-label-md text-on-tertiary-fixed"><Check className="h-4 w-4" aria-hidden />{t("Хатм шуд: {0}%", lesson.score)}</span>}
      </header>

      {stage === "learn" && (
        <>
          <Theory lesson={lesson} />
          <Button icon={ArrowRight} className="self-end" onClick={() => { setStage("practice"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {resume ? t("Идомаи машқҳо: {0} аз {1}", resume.index + 1, lesson.exercises.length) : t("Ба машқҳо")}
          </Button>
        </>
      )}
      {stage === "practice" && <Practice key={round} lesson={lesson} start={resume} onSave={save} onDone={finish} />}
      {stage === "done" && (
        <Result percent={percent} lesson={lesson} user={user} saved={saved} saveError={saveError} onRetry={() => { save(null); setRound((r) => r + 1); setStage("practice"); }} />
      )}

      <nav className="flex justify-between gap-2 pt-2">
        {lesson.number > 1 ? (
          <Link to={`/course/${lesson.level}/${lesson.number - 1}`} className="inline-flex min-h-[40px] items-center gap-1.5 text-label-md text-on-surface-variant hover:text-on-surface">
            <ArrowLeft className="h-4 w-4" aria-hidden />{t("Дарси пешина")}
          </Link>
        ) : <span />}
        {stage !== "learn" && (
          <button type="button" onClick={() => setStage("learn")} className="text-label-md text-on-surface-variant underline underline-offset-4 hover:text-on-surface">
            {t("Назарияро боз хондан")}
          </button>
        )}
      </nav>
    </div>
  );
}
