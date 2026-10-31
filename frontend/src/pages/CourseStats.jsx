import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, TrendingUp, CalendarDays, Check, Clock, Flame, PenLine, Star, Target, Trophy } from "lucide-react";
import { lang, t } from "../i18n.js";
import { useApi } from "../hooks.js";
import { ago } from "../format.js";
import { BackLink, BrandBadge, PageHeader, Skeleton } from "../components/ui.jsx";
import { Heatmap, LevelBars, LineChart, Ring, StatCard, StatTile } from "../components/Stats.jsx";

const levelTitle = (level) => (lang === "ru" && level.title_ru) || level.title;

export default function CourseStats() {
  const { data } = useApi("/course/stats/");
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  const percent = data.lessons_total ? Math.round((data.lessons_done / data.lessons_total) * 100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <BackLink to="/course">{t("Курси забони русӣ")}</BackLink>
      <PageHeader eyebrow={t("Курси забони русӣ")} title={t("Омори ман")} text={t("Пешрафти шумо дар дарсҳо ва имтиҳонҳо, рӯзҳои фаъол ва натиҷаҳо.")} icon={BarChart3} />
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2452] via-[#132f6b] to-[#1d4ed8] p-5 text-white shadow-[0_24px_60px_-30px_rgba(29,78,216,0.8)] md:p-6">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-5">
          <Ring value={data.lessons_done} total={data.lessons_total} size={112} stroke={10} track="stroke-white/15">
            <span className="font-display text-[26px] font-semibold leading-none tabular-nums">{percent}%</span>
            <span className="mt-1 text-[11px] text-white/70">{t("курс")}</span>
          </Ring>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
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
          <BrandBadge />
        </div>
      </div>
          {data.lessons_done === 0 && (
        <Link to="/course/1/1" className="group flex items-center gap-4 rounded-2xl bg-primary-fixed p-4 text-on-primary-fixed ring-1 ring-primary/20 transition-transform hover:-translate-y-0.5">
          <Star className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <span className="flex-1 text-body-md">{t("Омор пас аз дарси аввал пайдо мешавад. Дарси 1-ро сар кунед — 10 дақиқа.")}</span>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
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
              <div className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-label-md text-on-surface-variant">
                  {t("Дарсҳои хатмшуда дар 12 ҳафта")}
                  <span className="inline-flex items-center gap-1 tabular-nums text-on-surface"><TrendingUp className="h-4 w-4 text-tertiary" aria-hidden />+{data.weeks.reduce((n, w) => n + w.count, 0)}</span>
                </span>
                <LineChart points={data.weeks} unit={t("дарс")} />
              </div>
              <div className="h-px bg-outline-variant" />
              <span className="text-label-md text-on-surface-variant">{t("Дар ҳар сатҳ")}</span>
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
    </div>
  );
}
