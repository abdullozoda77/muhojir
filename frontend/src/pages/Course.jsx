import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, BarChart3, CalendarDays, Check, ChevronDown, Clock, Flame, Languages, Lock, LogIn, PenLine, Star, Target, Trophy } from "lucide-react";
import { lang, t } from "../i18n.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";
import { ago } from "../format.js";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Heatmap, LevelBars, Ring, StatCard, StatTile } from "../components/Stats.jsx";

const levelTitle = (level) => (lang === "ru" && level.title_ru) || level.title;

const time = (value) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function nextLesson(levels) {
  for (const level of levels) {
    if (level.exam.passed) continue;
    const lesson = level.lessons.find((l) => l.score === null);
    if (lesson) return { level, lesson };
    return { level, exam: true };
  }
  return null;
}

function firstOpen(levels) {
  const level = levels.find((l) => !l.exam.passed);
  return (level || levels[0])?.level;
}

function ExamPanel({ level, user, size, minutes, pass }) {
  const { exam } = level;
  if (exam.passed) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-tertiary-fixed p-4 text-on-tertiary-fixed ring-1 ring-tertiary/30">
        <Check className="h-6 w-6 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-label-lg">{t("Имтиҳон супорида шуд — {0}%", exam.percent)}</span>
          <span className="text-body-sm opacity-80">{exam.final ? t("Курс пурра хатм шуд") : t("Сатҳи навбатӣ кушода шуд")}</span>
        </span>
      </div>
    );
  }
  const note = !exam.ready
    ? t("Барои имтиҳон ҳамаи дарсҳоро хатм кунед: {0} аз {1}", exam.lessons_done, exam.lessons_total)
    : exam.final
      ? t("{0} савол, {1} дақиқа, {2}% лозим. Баъди ин имтиҳон сертификат дода мешавад.", size, minutes, pass)
      : t("{0} савол, {1} дақиқа. Барои гузаштан ба сатҳи навбатӣ {2}% лозим.", size, minutes, pass);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 ring-1 ring-outline-variant sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest ring-1 ring-outline-variant">
        {exam.ready ? <PenLine className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5 text-on-surface-variant" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-label-lg">{exam.final ? t("Имтиҳони ниҳоӣ ва сертификат") : t("Имтиҳони сатҳ")}</span>
        <span className="text-body-sm text-on-surface-variant">{note}</span>
      </span>
      {exam.ready && user && (exam.wait_until ? (
        <span className="inline-flex items-center gap-1.5 text-label-md text-warning">
          <Clock className="h-4 w-4" aria-hidden />
          {t("Боз аз соати {0}", time(exam.wait_until))}
        </span>
      ) : (
        <Link to={`/course/${level.level}/exam`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-ink px-5 text-label-lg text-on-ink transition-colors hover:bg-ink/90">
          {exam.open ? t("Идома додан") : t("Супоридани имтиҳон")}
        </Link>
      ))}
    </div>
  );
}

function Level({ level, open, onToggle, user, info }) {
  const done = level.exam.lessons_done;
  const total = level.exam.lessons_total;
  const next = level.lessons.find((l) => l.score === null && l.unlocked);
  return (
    <section className={`overflow-hidden rounded-2xl bg-surface-container-lowest ring-1 transition-shadow ${open ? "ring-outline/50 shadow-[0_18px_40px_-28px_rgb(16_36_84/0.45)]" : "ring-outline-variant"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-5 text-left md:p-6">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[20px] font-semibold tabular-nums ${level.exam.passed ? "bg-tertiary text-on-tertiary" : level.unlocked ? "bg-ink text-on-ink" : "bg-surface-container-high text-on-surface-variant"}`}>
          {level.exam.passed ? <Check className="h-6 w-6" aria-label={t("Хатм шуд")} /> : level.unlocked ? level.level : <Lock className="h-5 w-5" aria-label={t("Баста")} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">{t("Сатҳи {0}", level.level)} · ≈ {level.cefr}</span>
          <span className="text-[18px] font-semibold leading-tight md:text-[20px]">{levelTitle(level)}</span>
          <span className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
            <span className="block h-full rounded-full bg-tertiary transition-all duration-700" style={{ width: `${(done / total) * 100}%` }} />
          </span>
        </span>
        <span className="hidden text-label-md tabular-nums text-on-surface-variant sm:block">{done}/{total}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-on-surface-variant transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-outline-variant p-5 md:p-6">
          <p className="text-body-md text-on-surface-variant">{level.text}</p>
          <Stagger as="ol" className="grid gap-2 sm:grid-cols-2">
            {level.lessons.map((lesson) => (
              <StaggerItem as="li" key={lesson.number}>
                {!lesson.unlocked ? (
                  <div className="flex h-full items-start gap-3 rounded-xl p-3 opacity-60 ring-1 ring-inset ring-outline-variant" aria-disabled="true">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                      <Lock className="h-4 w-4" aria-label={t("Баста")} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-label-lg leading-snug">{lesson.title}</span>
                      <span className="text-body-sm text-on-surface-variant">
                        {lesson.number === 1 ? t("Пас аз имтиҳони сатҳи {0} кушода мешавад", level.level - 1) : t("Аввал дарси {0}-ро хатм кунед", lesson.number - 1)}
                      </span>
                    </span>
                  </div>
                ) : (
                <Link
                  to={`/course/${level.level}/${lesson.number}`}
                  className={`group flex h-full items-start gap-3 rounded-xl p-3 ring-1 ring-inset transition-colors hover:bg-surface-container-low ${lesson === next && done < total ? "ring-2 ring-primary" : "ring-outline-variant"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-label-md tabular-nums ${lesson.score !== null ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container-high text-on-surface"}`}>
                    {lesson.score !== null ? <Check className="h-4 w-4" aria-label={t("Хатм шуд")} /> : lesson.number}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-label-lg leading-snug">{lesson.title}</span>
                    {lesson.score !== null ? (
                      <span className="text-body-sm text-tertiary">{t("Натиҷа: {0}%", lesson.score)}</span>
                    ) : (
                      <span className="line-clamp-2 text-body-sm text-on-surface-variant">{lesson.goal}</span>
                    )}
                  </span>
                </Link>
                )}
              </StaggerItem>
            ))}
          </Stagger>
          <ExamPanel level={level} user={user} size={info.exam_size} minutes={info.exam_minutes} pass={info.pass_percent} />
        </div>
      )}
    </section>
  );
}

function CourseStats() {
  const { data } = useApi("/course/stats/");
  const [open, setOpen] = useState(true);
  if (!data) return <Skeleton className="h-48" />;
  const percent = data.lessons_total ? Math.round((data.lessons_done / data.lessons_total) * 100) : 0;
  return (
    <section className="flex flex-col gap-3" aria-label={t("Омори ман")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          {t("Омори ман")}
        </h2>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface">
          {open ? t("Пинҳон кардан") : t("Нишон додан")}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2452] via-[#132f6b] to-[#1d4ed8] p-5 text-white shadow-[0_24px_60px_-30px_rgba(29,78,216,0.8)] md:p-6">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-5">
          <Ring value={data.lessons_done} total={data.lessons_total} size={112} stroke={10}>
            <span className="font-display text-[26px] font-semibold leading-none tabular-nums">{percent}%</span>
            <span className="mt-1 text-[11px] text-white/70">{t("курс")}</span>
          </Ring>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3">
            {[
              [Flame, data.streak, t("рӯз пай дар пай"), "text-orange-300"],
              [Target, data.average_score === null ? "—" : `${data.average_score}%`, t("натиҷаи миёна"), "text-sky-300"],
              [Check, `${data.lessons_done}/${data.lessons_total}`, t("дарс"), "text-emerald-300"],
              [Trophy, `${data.levels_passed}/${data.levels_total}`, t("сатҳ"), "text-amber-300"],
            ].map(([Icon, value, label, color]) => (
              <div key={label} className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 font-display text-[22px] font-semibold leading-tight tabular-nums">
                  <Icon className={`h-4 w-4 shrink-0 ${color}`} aria-hidden />
                  {value}
                </span>
                <span className="truncate text-[12px] text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {open && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile icon={CalendarDays} value={data.this_week} label={t("Дар ин ҳафта")} hint={t("дарс ва имтиҳон")} />
            <StatTile icon={Flame} accent="text-orange-500" value={data.best_streak} label={t("Беҳтарин силсила")} hint={t("рӯз пай дар пай")} />
            <StatTile icon={Star} accent="text-amber-500" value={data.perfect} label={t("Дарс бо 100%")} hint={t("бе ягон хато")} />
            <StatTile icon={PenLine} value={data.exams.best_percent === null ? "—" : `${data.exams.best_percent}%`} label={t("Беҳтарин имтиҳон")} hint={t("{0} кӯшиш", data.exams.attempts)} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <StatCard title={t("Фаъолият")} icon={CalendarDays} aside={t("{0} рӯзи фаъол", data.active_days)}>
              <Heatmap days={data.days} unit={t("амал")} />
            </StatCard>
            <StatCard title={t("Пешрафт дар сатҳҳо")} icon={BarChart3} aside={t("{0} аз {1}", data.levels_passed, data.levels_total)}>
              <LevelBars levels={data.levels} title={levelTitle} />
            </StatCard>
          </div>
          {data.recent.length > 0 && (
            <StatCard title={t("Охирин дарсҳо")} icon={Clock}>
              <ul className="flex flex-col divide-y divide-outline-variant">
                {data.recent.map((r) => (
                  <li key={`${r.level}-${r.number}`}>
                    <Link to={`/course/${r.level}/${r.number}`} className="flex items-center gap-3 py-2.5 transition-colors hover:text-primary">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-label-md tabular-nums">{r.level}.{r.number}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-label-lg">{r.title}</span>
                        <span className="text-body-sm text-on-surface-variant">{ago(r.at)}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-label-md tabular-nums ${r.score >= 90 ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container-high text-on-surface"}`}>{r.score}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </StatCard>
          )}
        </>
      )}
    </section>
  );
}

export default function Course() {
  const { user } = useAuth();
  const { data, error } = useApi(`/course/?u=${user?.id ?? ""}`);
  const [openLevel, setOpenLevel] = useState(null);

  useEffect(() => {
    if (data && openLevel === null) setOpenLevel(firstOpen(data.levels));
  }, [data, openLevel]);

  const passedLevels = data?.levels.filter((l) => l.exam.passed).length ?? 0;
  const lessonsDone = data?.levels.reduce((sum, l) => sum + l.exam.lessons_done, 0) ?? 0;
  const lessonsTotal = data?.levels.reduce((sum, l) => sum + l.exam.lessons_total, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t("Ройгон ва бо забони тоҷикӣ")}
        title={t("Курси забони русӣ")}
        text={t("Аз алифбо то гуфтугӯи озод: 7 сатҳ, 70 дарс. Баъд аз ҳар 10 дарс имтиҳон, дар охири курс — сертификат.")}
        icon={Languages}
      />
      <ErrorBox error={error} />
      {data && !user && (
        <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
          {[[lessonsDone, t("дарс хатм шуд")], [lessonsTotal - lessonsDone, t("дарс монд")], [passedLevels, t("сатҳ супорида шуд")]].map(([n, label]) => (
            <div key={label} className="flex flex-col rounded-xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant">
              <span className="text-[24px] font-semibold tabular-nums">{n}</span>
              <span className="text-body-sm text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>
      )}
      {data && user && (() => {
        const next = nextLesson(data.levels);
        if (!next || lessonsDone === 0) return null;
        const to = next.exam ? `/course/${next.level.level}/exam` : `/course/${next.level.level}/${next.lesson.number}`;
        return (
          <Link to={to} className="group flex items-center gap-4 rounded-2xl bg-ink p-5 text-on-ink transition-transform hover:-translate-y-0.5">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-label-md opacity-70">{t("Идома додан")} · {t("Сатҳи {0}", next.level.level)}</span>
              <span className="text-[18px] font-semibold leading-tight">
                {next.exam ? (next.level.exam.final ? t("Имтиҳони ниҳоӣ ва сертификат") : t("Имтиҳони сатҳ")) : t("Дарси {0}: {1}", next.lesson.number, next.lesson.title)}
              </span>
            </span>
            <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        );
      })()}
      {user && <CourseStats key={`${lessonsDone}-${passedLevels}`} />}
      {data && (data.certificate ? (
        <Link to={`/certificates/${data.certificate.code}`} className="flex items-center gap-4 rounded-2xl bg-tertiary-fixed p-5 text-on-tertiary-fixed ring-1 ring-tertiary/30 transition-transform hover:-translate-y-0.5">
          <Award className="h-8 w-8 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[18px] font-semibold">{t("Сертификати шумо — {0}%", data.certificate.percent)}</span>
            <span className="text-body-sm opacity-80">№ {data.certificate.number}</span>
          </span>
          <span className="text-label-md underline underline-offset-4">{t("Дидан")}</span>
        </Link>
      ) : (
        <Link to="/certificates/sample" className="group flex items-center gap-4 overflow-hidden rounded-2xl bg-[#0f2452] p-4 text-white ring-1 ring-[#d9b765]/40 transition-transform hover:-translate-y-0.5">
          <span className="relative flex h-16 w-[90px] shrink-0 flex-col items-center justify-center rounded-md border border-[#d9b765] bg-gradient-to-b from-[#1a3a7a] to-[#0b1a3d]">
            <span className="text-[7px] font-extrabold tracking-[0.2em] text-white">СЕРТИФИКАТ</span>
            <span className="mt-1 h-px w-12 bg-[#d9b765]" />
            <Award className="mt-1 h-4 w-4 text-[#d9b765]" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-semibold">{t("Сертификат пас аз хатми ҳамаи 7 сатҳ")}</span>
            <span className="text-body-sm text-white/70">{t("Бо номи шумо, рақам, мӯҳр ва QR-код барои санҷиш. Намунаро бинед.")}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      ))}
      {!user && (
        <Link to="/login" state={{ from: "/course" }} className="flex items-center gap-3 rounded-xl bg-primary-fixed p-4 text-on-primary-fixed ring-1 ring-primary/15">
          <LogIn className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-body-md">{t("Дарси аввалро бе сабти ном хондан мумкин. Барои нигоҳ доштани пешрафт ва гирифтани сертификат ворид шавед.")}</span>
        </Link>
      )}
      {!data && !error ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data && (
        <div className="flex flex-col gap-3">
          {data.levels.map((level) => (
            <Level
              key={level.level}
              level={level}
              user={user}
              info={data}
              open={openLevel === level.level}
              onToggle={() => setOpenLevel(openLevel === level.level ? 0 : level.level)}
            />
          ))}
        </div>
      )}
      <p className="px-1 text-body-sm text-on-surface-variant">
        {t("Сертификати Muhojir ҳуҷҷати давлатӣ нест ва имтиҳони давлатии забони русиро барои патент иваз намекунад. Он нишон медиҳад, ки шумо курсро хатм кардаед.")}
      </p>
    </div>
  );
}
