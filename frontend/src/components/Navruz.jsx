import { t } from "../i18n.js";
import { isNavruz } from "./SeasonFall.jsx";

const BLADES = Array.from({ length: 23 }, (_, i) => {
  const x = 26 + i * 3.1;
  const lean = (i - 11) * 0.9 + (i % 3 === 0 ? -2 : i % 3 === 1 ? 2 : 0);
  const top = 14 + ((i * 7) % 11);
  return { x, lean, top, tone: ["#3f9a3a", "#58b847", "#2f7d2f", "#6cc456"][i % 4] };
});

function Sabza() {
  return (
    <svg viewBox="0 0 120 110" className="h-24 w-24 shrink-0 md:h-28 md:w-28" aria-hidden>
      {BLADES.map((b, i) => (
        <path key={i} d={`M${b.x} 78 Q${b.x + b.lean * 0.4} ${(78 + b.top) / 2} ${b.x + b.lean} ${b.top}`} stroke={b.tone} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ))}
      <path d="M18 76 H102 L94 96 Q60 104 26 96 Z" fill="#c9d6e8" />
      <path d="M18 76 H102 L100 81 Q60 87 20 81 Z" fill="#e7eef8" />
      <path d="M22 84 Q60 92 98 84" stroke="#d93b3b" strokeWidth="4" fill="none" />
      <path d="M58 88 l-7 13 M62 88 l7 13" stroke="#d93b3b" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="60" cy="87" r="4" fill="#e04848" />
    </svg>
  );
}

export default function NavruzBanner() {
  if (!isNavruz()) return null;
  return (
    <section className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#eaf7e3] via-[#fdf3f6] to-[#fff8ea] p-6 text-center ring-1 ring-[#bfe0b0] sm:flex-row sm:text-left md:p-8 dark:from-[#10261a] dark:via-[#1d1a2e] dark:to-[#2a2116] dark:ring-[#2f5a35]">
      <Sabza />
      <div className="flex flex-col gap-1.5">
        <span className="text-label-md text-[#2f7d2f] dark:text-[#8fd47f]">{t("21 март — Наврӯзи оламафрӯз")}</span>
        <h2 className="text-[26px] font-semibold leading-tight text-on-surface md:text-[32px]">{t("Наврӯз муборак!")}</h2>
        <p className="max-w-2xl text-body-md text-on-surface-variant">{t("Бигзор соли нав ба шумо ва ба хонадонатон дар Ватан саломатӣ, хушӣ ва баракат орад. Ҳар куҷо ки бошед — дили мо бо шумост.")}</p>
      </div>
    </section>
  );
}
