import { useId } from "react";

const STRIPES = [
  { y: 0, width: 20, color: "#dc161d" },
  { y: 25, width: 30, color: "#ffffff" },
  { y: 50, width: 20, color: "#197b30" },
];
const PERIOD = 220;
const AMPLITUDE = 22;

function wave(y) {
  let d = `M ${-PERIOD * 2} ${y} q ${PERIOD / 4} ${-AMPLITUDE} ${PERIOD / 2} 0`;
  for (let x = -PERIOD * 2 + PERIOD / 2; x < 900; x += PERIOD / 2) d += ` t ${PERIOD / 2} 0`;
  return d;
}

export default function FlagRibbons({ className = "" }) {
  const id = useId().replace(/:/g, "");
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg aria-hidden className={`pointer-events-none ${className}`} viewBox="0 0 600 240" preserveAspectRatio="xMaxYMid slice">
      <defs>
        <linearGradient id={`fade-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`mask-${id}`}>
          <rect width="600" height="240" fill={`url(#fade-${id})`} />
        </mask>
        <linearGradient id={`shine-${id}`} x1="0" x2={PERIOD} y1="0" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <g mask={`url(#mask-${id})`}>
        <g transform="translate(0 95) rotate(-9 300 25)">
          <g opacity="0.35" filter={`url(#glow-${id})`}>
            <path d={wave(25)} fill="none" stroke="#1d4ed8" strokeWidth="80" />
          </g>
          <g>
            {!still && <animateTransform attributeName="transform" type="translate" from={`${-PERIOD} 0`} to="0 0" dur="9s" repeatCount="indefinite" />}
            {STRIPES.map((s) => (
              <path key={s.color} d={wave(s.y)} fill="none" stroke={s.color} strokeWidth={s.width} />
            ))}
            <path d={wave(25)} fill="none" stroke={`url(#shine-${id})`} strokeWidth="70" />
          </g>
        </g>
      </g>
    </svg>
  );
}
