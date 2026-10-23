import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { t } from "../i18n.js";
import Pattern from "./Pattern.jsx";
import { RevealGroup, StaggerItem } from "./motion.jsx";

const MVD = "https://xn--b1aew.xn--p1ai/mvd/structure1/Glavnie_upravlenija/guvm/inostrannim_grazhdanam";

const COLUMNS = [
  {
    title: () => t("Хизматҳо"),
    links: [
      ["/documents", () => t("Ҳуҷҷатҳои ман")],
      ["/calculator", () => t("Калкулятори патент")],
      ["/jobs", () => t("Ҷойи кор")],
      ["/exam", () => t("Машқ барои имтиҳон")],
      ["/tickets", () => t("Чиптаҳои ҳавопаймо")],
      ["/places", () => t("Ҷойҳо дар харита")],
    ],
  },
  {
    title: () => t("Маълумот"),
    links: [
      ["/guides", () => t("Роҳнамо ва қонунҳо")],
      ["/checks", () => t("Санҷиши ҳуҷҷатҳо")],
      ["/help", () => t("Маркази ёрии ҳуқуқӣ")],
      ["/guides#news", () => t("Хабарҳои қонун")],
    ],
  },
];

// Official sites people need most; the full list is on the help page.
const OFFICIAL = [
  [MVD, "МВД России"],
  ["https://www.gosuslugi.ru/", "Госуслуги"],
  ["https://migration.tj/", () => t("Хадамоти муҳоҷирати ҶТ")],
  ["https://tajembassy.ru/", () => t("Сафорати ҶТ дар Русия")],
];

// On hover a link slides a little to the right and an underline grows under it from the left.
const linkStyle = "group/link inline-flex min-h-[36px] items-center gap-1.5 self-start text-body-md text-on-navy transition-[color,transform] duration-300 hover:text-white motion-safe:hover:translate-x-1";
const underline = "bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/link:bg-[length:100%_1px]";

export default function Footer() {
  return (
    <footer className="relative isolate mx-3 mb-28 overflow-hidden rounded-[36px] bg-navy text-white md:mx-6 lg:mb-6">
      {/* The flag on the right, faint, and the flag line along the top edge. */}
      <Pattern opacity={0.3} motion="none" />
      <div className="flag-line absolute inset-x-0 top-0 h-[6px]" />
      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-10 px-6 pb-8 pt-12 md:px-10 md:pt-14">
        {/* A big closing line, and the columns rising one after another when the footer comes into view. */}
        <div className="flex flex-col justify-between gap-6 border-b border-white/15 pb-10 md:flex-row md:items-end">
          <p className="max-w-2xl font-display text-[30px] font-extrabold leading-[1.1] md:text-[44px]">
            {t("Дар Русия кор кунед — бе тарс аз ҷарима ва мӯҳлатҳо.")}
          </p>
          <Link to="/login" className="inline-flex min-h-[56px] shrink-0 items-center gap-2 self-start rounded-full bg-white px-7 text-label-lg text-navy transition-transform hover:-translate-y-0.5 md:self-auto">
            {t("Оғоз кардан — бепул")}
          </Link>
        </div>
        <RevealGroup className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <StaggerItem className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <Link to="/" className="group flex items-center gap-2.5 self-start">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-0.5 transition-transform duration-500 motion-safe:group-hover:-rotate-6">
                <img src="/logo.png" alt="" className="h-full w-full" />
              </span>
              <span className="font-display text-[24px] font-extrabold">Muhojir</span>
            </Link>
            <p className="max-w-xs text-body-md text-on-navy/80">{t("Ҳуҷҷатҳо сари вақт, кори боэътимод — барои муҳоҷирони тоҷик дар Русия. Ройгон ва бо забони тоҷикӣ.")}</p>
          </StaggerItem>

          {COLUMNS.map((col) => (
            <StaggerItem as="nav" key={col.title()} aria-label={col.title()} className="flex flex-col gap-1">
              <h2 className="mb-1 font-sans text-label-md uppercase tracking-[0.16em] text-gold">{col.title()}</h2>
              {col.links.map(([to, label]) => (
                <Link key={to} to={to} className={linkStyle}>
                  <span className={underline}>{label()}</span>
                </Link>
              ))}
            </StaggerItem>
          ))}

          <StaggerItem as="nav" aria-label={t("Сайтҳои расмӣ")} className="col-span-2 flex flex-col gap-1 lg:col-span-1">
            <h2 className="mb-1 font-sans text-label-md uppercase tracking-[0.16em] text-gold">{t("Сайтҳои расмӣ")}</h2>
            {OFFICIAL.map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={linkStyle}>
                <span className={underline}>{typeof label === "function" ? label() : label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-300 motion-safe:group-hover/link:-translate-y-0.5 motion-safe:group-hover/link:translate-x-0.5" aria-hidden />
              </a>
            ))}
          </StaggerItem>
        </RevealGroup>

        <div className="flex flex-col gap-2 border-t border-white/15 pt-5 text-body-sm text-on-navy/70 md:flex-row md:items-start md:justify-between md:gap-8">
          <p className="whitespace-nowrap">© {new Date().getFullYear()} Muhojir</p>
          <p className="max-w-2xl md:text-right">
            {t("Muhojir сайти давлатӣ нест. Маълумот барои кӯмак аст — қоидаҳо ва нархҳоро дар сайтҳои расмӣ санҷед. Ҷойҳои кор аз сайти давлатии «Работа России» гирифта мешаванд.")}
          </p>
        </div>
      </div>
    </footer>
  );
}
