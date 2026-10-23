import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Check, GraduationCap, Landmark, RotateCcw, Scale, Shuffle, Volume2, X } from "lucide-react";
import { apiAll } from "../api.js";
import { t } from "../i18n.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

// Practice for the exam in Russian language, history and law that is needed for the patent.
// Questions come from the admin panel; answers are shuffled here, so the right one is not always in the same place.

const SECTIONS = [
  { key: "mixed", icon: Shuffle, title: () => t("Санҷиши омехта"), text: () => t("15 саволи тасодуфӣ аз ҳамаи қисмҳо") },
  { key: "language", icon: BookOpenCheck, title: () => t("Забони русӣ"), text: () => t("Грамматика, хониш ва шунидан") },
  { key: "history", icon: Landmark, title: () => t("Таърихи Русия"), text: () => t("Санаҳо, идҳо ва шахсиятҳо") },
  { key: "law", icon: Scale, title: () => t("Асосҳои қонун"), text: () => t("Конститутсия ва ҳуқуқу вазифаҳои муҳоҷир") },
];
const MIXED_COUNT = 15;
const PASS = 0.75; // our goal for practice: three answers out of four
const BEST_KEY = "exam-best";

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Each option keeps whether it is the right one, so the order can change freely.
const prepare = (questions) =>
  questions.map((q) => ({ ...q, choices: shuffle(q.options.map((text, i) => ({ text, right: i === q.answer }))) }));

function readBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBest(section, percent) {
  try {
    const best = readBest();
    if ((best[section] ?? -1) < percent) localStorage.setItem(BEST_KEY, JSON.stringify({ ...best, [section]: percent }));
  } catch {
    // private mode: the best result is simply not kept
  }
}

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

function speak(text) {
  window.speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(text);
  phrase.lang = "ru-RU";
  phrase.rate = 0.85; // a little slower than normal speech, as for learners
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ru"));
  if (voice) phrase.voice = voice;
  window.speechSynthesis.speak(phrase);
}

function Listen({ text }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-primary-fixed/50 p-4">
      <div className="flex flex-wrap gap-2">
        {canSpeak && (
          <Button icon={Volume2} onClick={() => speak(text)}>
            {t("Гӯш кардан")}
          </Button>
        )}
        <Button variant="plain" onClick={() => setShown((s) => !s)}>
          {shown ? t("Матнро пинҳон кардан") : t("Матнро нишон додан")}
        </Button>
      </div>
      {shown && <p className="rounded-lg bg-surface-container-lowest p-3 text-body-lg">{text}</p>}
    </div>
  );
}

function Quiz({ section, questions, onExit }) {
  const [list, setList] = useState(() => prepare(questions));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // the chosen option of the current question
  const [wrong, setWrong] = useState([]);
  const done = index >= list.length;
  const q = list[index];
  const right = list.length - wrong.length;
  const percent = Math.round((right / list.length) * 100);

  useEffect(() => {
    if (done) saveBest(section, percent);
    return () => canSpeak && window.speechSynthesis.cancel();
  }, [done, section, percent]);

  const choose = (choice) => {
    if (picked) return;
    setPicked(choice);
    if (!choice.right) setWrong((w) => [...w, q]);
  };

  const next = () => {
    if (canSpeak) window.speechSynthesis.cancel();
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const restart = (questionsAgain) => {
    setList(prepare(shuffle(questionsAgain)));
    setIndex(0);
    setPicked(null);
    setWrong([]);
  };

  if (done) {
    const passed = right / list.length >= PASS;
    return (
      <div className="card flex flex-col items-center gap-4 p-6 text-center md:p-10">
        <span className={`flex h-20 w-20 items-center justify-center rounded-full text-headline-md font-bold ${passed ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-warning-fixed text-on-warning-fixed"}`}>
          {percent}%
        </span>
        <h2 className="text-headline-md">{t("{0} аз {1} ҷавоби дуруст", right, list.length)}</h2>
        <p className="max-w-md text-body-md text-on-surface-variant">
          {passed ? t("Офарин! Шумо хуб тайёр ҳастед. Боз машқ кунед, то боварӣ зиёд шавад.") : t("Боз каме машқ кунед. Саволҳои хаторо такрор кунед ва шарҳҳоро хонед.")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && <Button icon={RotateCcw} onClick={() => restart(wrong)}>{t("Саволҳои хаторо такрор кардан")}</Button>}
          <Button variant="soft" icon={Shuffle} onClick={() => restart(questions)}>{t("Аз нав")}</Button>
          <Button variant="plain" onClick={onExit}>{t("Қисми дигар")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-md text-on-surface-variant">{t("Савол {0} аз {1}", index + 1, list.length)}</span>
        <button type="button" onClick={onExit} className="inline-flex min-h-[44px] items-center gap-1 text-label-md text-on-surface-variant hover:text-primary">
          <X className="h-4 w-4" aria-hidden />
          {t("Баромадан")}
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={index} aria-valuemin={0} aria-valuemax={list.length}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(index / list.length) * 100}%` }} />
      </div>

      {q.listen_text && <Listen key={q.id} text={q.listen_text} />}
      <h2 className="text-headline-sm leading-snug" lang="ru">{q.question}</h2>

      <div className="flex flex-col gap-2">
        {q.choices.map((choice) => {
          const state = !picked ? "" : choice.right ? "right" : choice === picked ? "wrong" : "dim";
          return (
            <button
              key={choice.text}
              type="button"
              lang="ru"
              disabled={Boolean(picked)}
              onClick={() => choose(choice)}
              className={`flex min-h-[52px] items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-body-lg transition-colors ${
                state === "right" ? "border-tertiary bg-tertiary-fixed text-on-tertiary-fixed"
                  : state === "wrong" ? "border-error bg-error-container text-on-error-container"
                  : state === "dim" ? "border-transparent bg-surface-container-low opacity-60"
                  : "border-transparent bg-surface-container-low hover:border-primary"
              }`}
            >
              {choice.text}
              {state === "right" && <Check className="h-5 w-5 shrink-0" aria-label={t("Дуруст")} />}
              {state === "wrong" && <X className="h-5 w-5 shrink-0" aria-label={t("Хато")} />}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="flex flex-col gap-3">
          <p className={`rounded-xl p-4 text-body-md ${picked.right ? "bg-tertiary-fixed/60" : "bg-error-container/60"}`} role="status">
            <strong>{picked.right ? t("Дуруст!") : t("Хато.")}</strong> {q.explanation}
          </p>
          <Button onClick={next} className="self-end">
            {index + 1 < list.length ? t("Саволи навбатӣ") : t("Натиҷа")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Exam() {
  const [all, setAll] = useState(null);
  const [error, setError] = useState(null);
  const [section, setSection] = useState(null);
  const best = useMemo(readBest, [section]);

  useEffect(() => {
    apiAll("/documents/exam-questions/").then(setAll).catch((err) => {
      setError(err);
      setAll([]);
    });
  }, []);

  const questionsOf = (key) => (key === "mixed" ? shuffle(all).slice(0, MIXED_COUNT) : all.filter((q) => q.section === key));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Барои патент")} title={t("Машқ барои имтиҳон")} text={t("Забони русӣ, таърихи Русия ва асосҳои қонун — бо шарҳ ба забони тоҷикӣ.")} />
      <ErrorBox error={error} />
      {all === null ? (
        <Skeleton className="h-64" />
      ) : all.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("Саволҳо ба наздикӣ илова мешаванд")} />
      ) : section ? (
        <Quiz key={section.key + section.round} section={section.key} questions={section.questions} onExit={() => setSection(null)} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const count = s.key === "mixed" ? Math.min(MIXED_COUNT, all.length) : all.filter((q) => q.section === s.key).length;
              if (!count) return null;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection({ key: s.key, questions: questionsOf(s.key), round: Date.now() })}
                  className="card flex items-start gap-4 p-4 text-left transition-shadow hover:shadow-md md:p-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                    <s.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-headline-sm">{s.title()}</span>
                    <span className="text-body-sm text-on-surface-variant">{s.text()}</span>
                    <span className="text-label-md text-primary">
                      {t("{0} савол", count)}
                      {best[s.key] != null && ` · ${t("беҳтарин натиҷа: {0}%", best[s.key])}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="rounded-2xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
            {t("Ин саволҳо барои машқ аст, на саволҳои худи имтиҳон. Имтиҳонро танҳо дар марказҳои иҷозатдошта супоред.")}
          </p>
        </>
      )}
    </div>
  );
}
