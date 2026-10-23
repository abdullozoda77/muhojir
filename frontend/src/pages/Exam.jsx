import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Check, GraduationCap, Landmark, RotateCcw, Scale, Shuffle, Volume2, X } from "lucide-react";
import { apiAll } from "../api.js";
import { t } from "../i18n.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

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
    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 ring-1 ring-outline-variant">
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
      {shown && <p className="rounded-lg bg-surface-container-lowest p-4 text-body-lg ring-1 ring-outline-variant">{text}</p>}
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
      <div className="card mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-8 text-center md:p-12">
        <span className={`flex h-24 w-24 items-center justify-center rounded-full text-[30px] font-semibold tabular-nums ring-4 ${passed ? "text-tertiary ring-tertiary/40" : "text-warning ring-warning-container/50"}`}>
          {percent}%
        </span>
        <h2 className="text-[24px] font-semibold">{t("{0} аз {1} ҷавоби дуруст", right, list.length)}</h2>
        <p className="max-w-md text-body-md text-on-surface-variant">
          {passed ? t("Офарин! Шумо хуб тайёр ҳастед. Боз машқ кунед, то боварӣ зиёд шавад.") : t("Боз каме машқ кунед. Саволҳои хаторо такрор кунед ва шарҳҳоро хонед.")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && <Button icon={RotateCcw} onClick={() => restart(wrong)}>{t("Саволҳои хаторо такрор кардан")}</Button>}
          <Button variant="plain" icon={Shuffle} onClick={() => restart(questions)}>{t("Аз нав")}</Button>
          <Button variant="plain" onClick={onExit}>{t("Қисми дигар")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-9">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-md tabular-nums text-on-surface-variant">{t("Савол {0} аз {1}", index + 1, list.length)}</span>
        <button type="button" onClick={onExit} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
          <X className="h-4 w-4" aria-hidden />
          {t("Баромадан")}
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={index} aria-valuemin={0} aria-valuemax={list.length}>
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(index / list.length) * 100}%` }} />
      </div>

      {q.listen_text && <Listen key={q.id} text={q.listen_text} />}
      <h2 className="text-[22px] font-semibold leading-snug tracking-tight md:text-[26px]" lang="ru">{q.question}</h2>

      <div className="flex flex-col gap-2.5">
        {q.choices.map((choice) => {
          const state = !picked ? "" : choice.right ? "right" : choice === picked ? "wrong" : "dim";
          return (
            <button
              key={choice.text}
              type="button"
              lang="ru"
              disabled={Boolean(picked)}
              onClick={() => choose(choice)}
              className={`flex min-h-[52px] items-center justify-between gap-3 rounded-xl px-5 py-3 text-left text-body-lg ring-1 ring-inset transition-all ${
                state === "right" ? "bg-tertiary-fixed text-on-tertiary-fixed ring-2 ring-tertiary"
                  : state === "wrong" ? "bg-error-container text-on-error-container ring-2 ring-error"
                  : state === "dim" ? "opacity-50 ring-outline-variant"
                  : "ring-outline-variant hover:bg-surface-container-low hover:ring-outline/60"
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
          <p className={`rounded-xl border-l-[3px] p-4 text-body-md ${picked.right ? "border-tertiary bg-tertiary-fixed/50" : "border-error bg-error-container/50"}`} role="status">
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
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Барои патент")} title={t("Машқ барои имтиҳон")} text={t("Забони русӣ, таърихи Русия ва асосҳои қонун — бо шарҳ ба забони тоҷикӣ.")} icon={GraduationCap} />
      <ErrorBox error={error} />
      {all === null ? (
        <Skeleton className="h-64" />
      ) : all.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("Саволҳо ба наздикӣ илова мешаванд")} />
      ) : section ? (
        <Quiz key={section.key + section.round} section={section.key} questions={section.questions} onExit={() => setSection(null)} />
      ) : (
        <>
          <Stagger className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const count = s.key === "mixed" ? Math.min(MIXED_COUNT, all.length) : all.filter((q) => q.section === s.key).length;
              if (!count) return null;
              return (
                <StaggerItem key={s.key}>
                <button
                  type="button"
                  onClick={() => setSection({ key: s.key, questions: questionsOf(s.key), round: Date.now() })}
                  className={`group flex h-full w-full items-start gap-4 rounded-2xl bg-surface-container-lowest p-6 text-left ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)] ${s.key === "mixed" ? "ring-2 ring-ink" : "ring-outline-variant hover:ring-outline/50"}`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${s.key === "mixed" ? "bg-ink text-on-ink" : "bg-surface-container-low text-on-surface ring-1 ring-outline-variant"}`}>
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[18px] font-semibold leading-tight">{s.title()}</span>
                    <span className="text-body-sm text-on-surface-variant">{s.text()}</span>
                    <span className="mt-2 text-label-md text-on-surface-variant">
                      {t("{0} савол", count)}
                      {best[s.key] != null && <span className="text-tertiary"> · {t("беҳтарин натиҷа: {0}%", best[s.key])}</span>}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-outline transition-all group-hover:translate-x-0.5 group-hover:text-on-surface" aria-hidden />
                </button>
                </StaggerItem>
              );
            })}
          </Stagger>
          <p className="flex items-start gap-2 px-1 text-body-sm text-on-surface-variant">
            {t("Ин саволҳо барои машқ аст, на саволҳои худи имтиҳон. Имтиҳонро танҳо дар марказҳои иҷозатдошта супоред.")}
          </p>
        </>
      )}
    </div>
  );
}
