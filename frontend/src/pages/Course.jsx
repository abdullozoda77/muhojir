import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Check, ChevronDown, Clock, Languages, Lock, LogIn, PenLine } from "lucide-react";
import { t } from "../i18n.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

const time = (value) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function nextLesson(levels) {
  for (const level of levels) {
    if (level.exam.certificate) continue;
    const lesson = level.lessons.find((l) => l.score === null);
    if (lesson) return { level, lesson };
    return { level, exam: true };
  }
  return null;
}

function firstOpen(levels) {
  const level = levels.find((l) => !l.exam.certificate);
  return (level || levels[0])?.level;
}

function ExamPanel({ level, user, size, minutes, pass }) {
  const { exam } = level;
  if (exam.certificate) {
    return (
      <Link to={`/certificates/${exam.certificate.code}`} className="flex items-center gap-3 rounded-xl bg-tertiary-fixed p-4 text-on-tertiary-fixed ring-1 ring-tertiary/30 transition-transform hover:-translate-y-0.5">
        <Award className="h-6 w-6 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-label-lg">{t("Сертификат гирифтед — {0}%", exam.certificate.percent)}</span>
          <span className="text-body-sm opacity-80">№ {exam.certificate.number}</span>
        </span>
        <span className="text-label-md underline underline-offset-4">{t("Дидан")}</span>
      </Link>
    );
  }
  const note = !exam.ready
    ? t("Барои имтиҳон ҳамаи дарсҳоро хатм кунед: {0} аз {1}", exam.lessons_done, exam.lessons_total)
    : t("{0} савол, {1} дақиқа. Барои сертификат {2}% ҷавоби дуруст лозим.", size, minutes, pass);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 ring-1 ring-outline-variant sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest ring-1 ring-outline-variant">
        {exam.ready ? <PenLine className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5 text-on-surface-variant" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-label-lg">{t("Имтиҳони сатҳ ва сертификат")}</span>
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
  const next = level.lessons.find((l) => l.score === null) || level.lessons[0];
  return (
    <section className={`overflow-hidden rounded-2xl bg-surface-container-lowest ring-1 transition-shadow ${open ? "ring-outline/50 shadow-[0_18px_40px_-28px_rgb(16_36_84/0.45)]" : "ring-outline-variant"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-5 text-left md:p-6">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[20px] font-semibold tabular-nums ${level.exam.certificate ? "bg-tertiary text-on-tertiary" : "bg-ink text-on-ink"}`}>
          {level.exam.certificate ? <Check className="h-6 w-6" aria-label={t("Хатм шуд")} /> : level.level}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">{t("Сатҳи {0}", level.level)} · ≈ {level.cefr}</span>
          <span className="text-[18px] font-semibold leading-tight md:text-[20px]">{level.title}</span>
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
              </StaggerItem>
            ))}
          </Stagger>
          <ExamPanel level={level} user={user} size={info.exam_size} minutes={info.exam_minutes} pass={info.pass_percent} />
        </div>
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

  const certificates = data?.levels.filter((l) => l.exam.certificate).length ?? 0;
  const lessonsDone = data?.levels.reduce((sum, l) => sum + l.exam.lessons_done, 0) ?? 0;
  const lessonsTotal = data?.levels.reduce((sum, l) => sum + l.exam.lessons_total, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t("Ройгон ва бо забони тоҷикӣ")}
        title={t("Курси забони русӣ")}
        text={t("Аз алифбо то гуфтугӯи озод: 7 сатҳ, 70 дарс. Баъд аз ҳар 10 дарс имтиҳон супоред ва сертификат гиред.")}
        icon={Languages}
      />
      <ErrorBox error={error} />
      {data && (
        <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
          {[[lessonsDone, t("дарс хатм шуд")], [lessonsTotal - lessonsDone, t("дарс монд")], [certificates, t("сертификат")]].map(([n, label]) => (
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
                {next.exam ? t("Имтиҳони сатҳ ва сертификат") : t("Дарси {0}: {1}", next.lesson.number, next.lesson.title)}
              </span>
            </span>
            <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        );
      })()}
      {!user && (
        <Link to="/login" state={{ from: "/course" }} className="flex items-center gap-3 rounded-xl bg-primary-fixed p-4 text-on-primary-fixed ring-1 ring-primary/15">
          <LogIn className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-body-md">{t("Дарсҳоро бе сабти ном хондан мумкин. Барои нигоҳ доштани пешрафт ва гирифтани сертификат ворид шавед.")}</span>
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
