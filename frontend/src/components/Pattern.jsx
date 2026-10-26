import { useId } from "react";

const FLAG_SRC = "/flag-tj.svg";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function FlagCloth({ id, animate }) {
  return (
    <g>
      <image href={FLAG_SRC} width="700" height="350" preserveAspectRatio="none" />
      <rect width="700" height="350" fill={`url(#folds-${id})`}>
        {animate && <animate attributeName="x" from="-200" to="0" dur="5s" repeatCount="indefinite" />}
      </rect>
    </g>
  );
}

export function WavingFlag({ className = "", fade = true }) {
  const id = useId().replace(/:/g, "");
  const animate = !reducedMotion();
  return (
    <svg aria-hidden className={className} viewBox="0 0 700 350" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`folds-${id}`} x1="0" x2="200" y1="0" y2="40" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
          <stop offset="0" stopColor="#000" stopOpacity="0.14" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0.03" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={`fade-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={fade ? 0 : 1} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={fade ? 0.55 : 1} />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`mask-${id}`}>
          <rect width="700" height="350" fill={`url(#fade-${id})`} />
        </mask>
      </defs>
      <g mask={`url(#mask-${id})`}>
        <FlagCloth id={id} animate={animate} />
      </g>
    </svg>
  );
}

export default function Pattern({ opacity = 1, motion = "drift" }) {
  const id = useId().replace(/:/g, "");
  const animate = motion !== "none" && !reducedMotion();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-[78%] md:w-[60%]" viewBox="0 0 700 350" preserveAspectRatio="xMaxYMid slice" style={{ opacity }}>
      <defs>
        <linearGradient id={`folds-${id}`} x1="0" x2="200" y1="0" y2="40" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
          <stop offset="0" stopColor="#000" stopOpacity="0.14" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0.03" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={`fade-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.75" />
        </linearGradient>
        <mask id={`mask-${id}`}>
          <rect width="700" height="350" fill={`url(#fade-${id})`} />
        </mask>
      </defs>
      <g mask={`url(#mask-${id})`}>
        <FlagCloth id={id} animate={animate} />
      </g>
    </svg>
  );
}

export const EDGE_TO_EDGE = "-mx-4 -mt-6 rounded-b-2xl md:mx-0 md:mt-0 md:rounded-2xl";

export function Hero({ eyebrow, title, text, children, tall = false, art = null }) {
  return (
    <section className={`${EDGE_TO_EDGE} relative overflow-hidden bg-banner px-6 pt-8 text-white md:px-10 md:pt-10 ${tall ? "pb-28 md:pb-32" : "pb-8 md:pb-10"}`}>
      <Glow />
      <Pattern opacity={art ? 0.55 : 1} />
      <div className="relative grid grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex max-w-3xl flex-col gap-2">
          {eyebrow && <span className="flex items-center gap-2 text-label-md uppercase tracking-[0.18em] text-navy-muted"><Emblem className="h-3.5 w-3.5" />{eyebrow}</span>}
          <h1 className="font-display text-[36px] font-semibold leading-[42px] md:text-[54px] md:leading-[60px]">{title}</h1>
          {text && <p className="text-body-lg text-on-navy md:text-[18px] md:leading-7">{text}</p>}
          {children}
        </div>
        {art && <div className="hidden xl:block">{art}</div>}
      </div>
    </section>
  );
}

export function Overlap({ children, className = "" }) {
  return <div className={`relative z-10 -mt-20 flex flex-col gap-7 px-2 md:-mt-24 md:px-6 ${className}`}>{children}</div>;
}

export function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-gold/25 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary-container/40 blur-3xl" />
    </div>
  );
}

export function FlagShowcase({ className = "" }) {
  return (
    <div className={`flag-showcase relative mx-auto w-full max-w-[520px] [perspective:1200px] ${className}`}>
      <div className="flag-float relative aspect-[2/1] overflow-hidden rounded-xl ring-1 ring-white/20 [transform:rotateY(-14deg)_rotateX(6deg)]">
        <img src={FLAG_SRC} alt={""} aria-hidden className="h-full w-full object-cover" />
        <div aria-hidden className="flag-folds absolute inset-0" />
        <div aria-hidden className="flag-shine absolute inset-0" />
      </div>
      <div aria-hidden className="mx-auto mt-6 h-6 w-3/4 rounded-[50%] bg-black/40 blur-xl" />
    </div>
  );
}

export function Emblem({ className = "h-4 w-6" }) {
  return <img src={FLAG_SRC} alt="" aria-hidden className={`${className} shrink-0 rounded-[3px] object-cover shadow-sm ring-1 ring-black/10`} />;
}
