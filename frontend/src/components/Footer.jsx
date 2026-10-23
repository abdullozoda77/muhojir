import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { t } from "../i18n.js";
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

const linkStyle = "inline-flex min-h-[32px] items-center gap-1.5 self-start text-body-sm text-on-surface-variant transition-colors hover:text-on-surface";

export default function Footer() {
  return (
    <footer className="mb-24 border-t border-outline-variant lg:mb-0">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pb-8 pt-12 md:px-6 md:pt-16">
        <RevealGroup className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          <StaggerItem className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 self-start">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-0.5 ring-1 ring-outline-variant">
                <img src="/logo.png" alt="" className="h-full w-full" />
              </span>
              <span className="text-[17px] font-semibold tracking-tight">Muhojir</span>
            </Link>
            <p className="max-w-xs text-body-sm text-on-surface-variant">{t("Ҳуҷҷатҳо сари вақт, кори боэътимод — барои муҳоҷирони тоҷик дар Русия. Ройгон ва бо забони тоҷикӣ.")}</p>
          </StaggerItem>

          {COLUMNS.map((col) => (
            <StaggerItem as="nav" key={col.title()} aria-label={col.title()} className="flex flex-col gap-0.5">
              <h2 className="mb-2 font-sans text-label-md tracking-normal text-on-surface">{col.title()}</h2>
              {col.links.map(([to, label]) => (
                <Link key={to} to={to} className={linkStyle}>
                  {label()}
                </Link>
              ))}
            </StaggerItem>
          ))}

          <StaggerItem as="nav" aria-label={t("Сайтҳои расмӣ")} className="col-span-2 flex flex-col gap-0.5 lg:col-span-1">
            <h2 className="mb-2 font-sans text-label-md tracking-normal text-on-surface">{t("Сайтҳои расмӣ")}</h2>
            {OFFICIAL.map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={linkStyle}>
                {typeof label === "function" ? label() : label}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              </a>
            ))}
          </StaggerItem>
        </RevealGroup>

        <div className="flex flex-col gap-2 border-t border-outline-variant pt-6 text-body-sm text-on-surface-variant md:flex-row md:items-start md:justify-between md:gap-8">
          <p className="whitespace-nowrap">© {new Date().getFullYear()} Muhojir</p>
          <p className="max-w-2xl text-[12px] leading-[18px] md:text-right">
            {t("Muhojir сайти давлатӣ нест. Маълумот барои кӯмак аст — қоидаҳо ва нархҳоро дар сайтҳои расмӣ санҷед. Ҷойҳои кор аз сайти давлатии «Работа России» гирифта мешаванд.")}
          </p>
        </div>
      </div>
    </footer>
  );
}
