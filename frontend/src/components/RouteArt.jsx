import { t } from "../i18n.js";

// The journey of every migrant, drawn for the home banner: the Pamir mountains of Tajikistan, a dotted arc to
// Moscow and a small plane flying along it, again and again. Gold lines on the deep blue. Purely decorative
// (aria-hidden); the plane stands still for people who turned animations off.

const ARC = "M70 238 C 170 40, 330 10, 452 92";
const still = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function RouteArt({ className = "" }) {
  return (
    <svg viewBox="0 0 520 300" aria-hidden className={`route-art ${className}`}>
      <defs>
        <linearGradient id="route-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--c-gold))" stopOpacity="0" />
          <stop offset="1" stopColor="rgb(var(--c-gold))" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="route-line" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--c-gold))" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* far and near ridges of the Pamir, with snow caps */}
      <path d="M0 300 L0 236 L48 196 L82 222 L128 168 L170 214 L214 182 L262 232 L300 214 L352 262 L392 300 Z" fill="url(#route-sky)" />
      <path d="M0 300 L0 252 L36 224 L64 242 L104 196 L138 226 L176 204 L222 250 L262 238 L310 300 Z" fill="rgb(255 255 255 / 0.07)" />
      <path d="M128 168 L140 182 L132 180 L124 186 L118 178 Z" fill="rgb(255 255 255 / 0.55)" />
      <path d="M104 196 L114 207 L106 205 L99 210 L95 203 Z" fill="rgb(255 255 255 / 0.45)" />
      <path d="M214 182 L224 192 L216 191 L209 195 L206 189 Z" fill="rgb(255 255 255 / 0.4)" />

      {/* the route: a soft wide glow, then the dotted line that runs */}
      <path d={ARC} fill="none" stroke="rgb(var(--c-gold))" strokeOpacity="0.18" strokeWidth="10" strokeLinecap="round" />
      <path d={ARC} fill="none" stroke="url(#route-line)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 9" className="route-dash" />

      {/* Dushanbe */}
      <circle cx="70" cy="238" r="14" fill="rgb(var(--c-gold))" opacity="0.25" className="route-pulse" />
      <circle cx="70" cy="238" r="6" fill="rgb(var(--c-gold))" stroke="#fff" strokeWidth="2" />
      <text x="70" y="276" textAnchor="middle" className="route-label">{t("Душанбе")}</text>

      {/* Moscow */}
      <circle cx="452" cy="92" r="14" fill="#fff" opacity="0.18" className="route-pulse route-pulse-late" />
      <circle cx="452" cy="92" r="6" fill="#fff" stroke="rgb(var(--c-gold))" strokeWidth="2" />
      <text x="452" y="70" textAnchor="middle" className="route-label">{t("Маскав")}</text>

      {/* distance and time of the flight, on the arc */}
      <g transform="translate(262 52)">
        <rect x="-62" y="-15" width="124" height="28" rx="14" fill="rgb(0 0 0 / 0.25)" stroke="rgb(var(--c-gold))" strokeOpacity="0.5" />
        <text x="0" y="4" textAnchor="middle" className="route-chip">≈ 3000 км · 4,5 {t("соат")}</text>
      </g>

      {/* the plane, flying along the arc */}
      <g transform={still() ? "translate(268 64) rotate(-12)" : undefined}>
        <g fill="#fff" stroke="rgb(var(--c-banner))" strokeWidth="0.6">
          <path d="M12 0C12-1.2 10-1.7 8-1.7L-8-1.4-11-4.5h-1.6l1.6 4.5-1.6 4.5h1.6l3-3.1 16 .3c2 0 4-.5 4-1.7z" />
          <path d="M2-1.5-3-10.5H-.4l6.4 9z" />
          <path d="M2 1.5-3 10.5H-.4l6.4-9z" />
        </g>
        {!still() && <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path={ARC} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.25 1" />}
      </g>
    </svg>
  );
}
