import { t } from "../i18n.js";

const RED = "#d8232a";
const BLUE = "#1460aa";
const YELLOW = "#f6c400";

const NAMES = {
  "1.8": "Светофорное регулирование",
  "1.33": "Прочие опасности",
  "2.1": "Главная дорога",
  "2.2": "Конец главной дороги",
  "2.3.1": "Пересечение со второстепенной дорогой",
  "2.4": "Уступите дорогу",
  "2.5": "Движение без остановки запрещено",
  "3.1": "Въезд запрещён",
  "3.2": "Движение запрещено",
  "3.20": "Обгон запрещён",
  "3.24": "Ограничение максимальной скорости",
  "3.27": "Остановка запрещена",
  "3.28": "Стоянка запрещена",
  "4.1.1": "Движение прямо",
  "5.19.1": "Пешеходный переход",
  "6.4": "Парковка",
  "warning-triangle": "Знак аварийной остановки",
};

const triangle = (inner) => (
  <>
    <path d="M50 8 L94 86 H6 Z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />
    {inner}
  </>
);

const circle = (fill, inner) => (
  <>
    <circle cx="50" cy="50" r="44" fill={fill} stroke={RED} strokeWidth="9" />
    {inner}
  </>
);

const car = (x, fill) => (
  <g fill={fill}>
    <rect x={x} y="44" width="18" height="14" rx="3" />
    <rect x={x + 3} y="37" width="12" height="9" rx="2" />
    <circle cx={x + 4} cy="59" r="3" />
    <circle cx={x + 14} cy="59" r="3" />
  </g>
);

const SIGNS = {
  "1.8": triangle(
    <g>
      <rect x="42" y="38" width="16" height="40" rx="3" fill="#222" />
      <circle cx="50" cy="46" r="4" fill={RED} />
      <circle cx="50" cy="58" r="4" fill={YELLOW} />
      <circle cx="50" cy="70" r="4" fill="#22a04b" />
    </g>,
  ),
  "1.33": triangle(<g fill="#222"><rect x="45.5" y="38" width="9" height="28" rx="3" /><circle cx="50" cy="75" r="5" /></g>),
  "2.1": (
    <g transform="rotate(45 50 50)">
      <rect x="18" y="18" width="64" height="64" fill="#fff" stroke="#999" strokeWidth="1.5" />
      <rect x="28" y="28" width="44" height="44" fill={YELLOW} />
    </g>
  ),
  "2.2": (
    <g>
      <g transform="rotate(45 50 50)">
        <rect x="18" y="18" width="64" height="64" fill="#fff" stroke="#999" strokeWidth="1.5" />
        <rect x="28" y="28" width="44" height="44" fill={YELLOW} />
      </g>
      <clipPath id="sign-2-2">
        <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
      </clipPath>
      <g stroke="#222" strokeWidth="4" clipPath="url(#sign-2-2)">
        <path d="M30 76 L76 30" />
        <path d="M24 70 L70 24" />
        <path d="M36 82 L82 36" />
      </g>
    </g>
  ),
  "2.3.1": triangle(<g fill="#222"><rect x="45" y="34" width="10" height="46" /><rect x="26" y="58" width="48" height="5" /></g>),
  "2.4": <path d="M8 14 H92 L50 90 Z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />,
  "2.5": (
    <g>
      <path d="M33 5 H67 L95 33 V67 L67 95 H33 L5 67 V33 Z" fill={RED} stroke="#fff" strokeWidth="3" />
      <text x="50" y="59" textAnchor="middle" fill="#fff" fontSize="25" fontWeight="800" fontFamily="Arial, sans-serif">STOP</text>
    </g>
  ),
  "3.1": (
    <g>
      <circle cx="50" cy="50" r="45" fill={RED} />
      <rect x="18" y="42" width="64" height="16" fill="#fff" />
    </g>
  ),
  "3.2": circle("#fff"),
  "3.20": circle("#fff", <>{car(24, RED)}{car(54, "#222")}</>),
  "3.24": circle("#fff", <text x="50" y="62" textAnchor="middle" fill="#222" fontSize="36" fontWeight="800" fontFamily="Arial, sans-serif">40</text>),
  "3.27": circle(BLUE, <g stroke={RED} strokeWidth="8"><path d="M20 20 L80 80" /><path d="M80 20 L20 80" /></g>),
  "3.28": circle(BLUE, <path d="M20 20 L80 80" stroke={RED} strokeWidth="8" />),
  "4.1.1": (
    <g>
      <circle cx="50" cy="50" r="45" fill={BLUE} />
      <path d="M50 18 L70 42 H57 V82 H43 V42 H30 Z" fill="#fff" />
    </g>
  ),
  "5.19.1": (
    <g>
      <rect x="6" y="6" width="88" height="88" rx="6" fill={BLUE} />
      <path d="M50 14 L88 84 H12 Z" fill="#fff" />
      <g fill="#222">
        <circle cx="52" cy="38" r="5" />
        <path d="M49 45 L56 45 L60 60 L66 76 L60 78 L54 63 L50 70 L44 78 L39 75 L46 63 Z" />
      </g>
      <g fill="#222">
        <rect x="24" y="78" width="7" height="4" />
        <rect x="36" y="78" width="7" height="4" />
        <rect x="68" y="78" width="7" height="4" />
      </g>
    </g>
  ),
  "6.4": (
    <g>
      <rect x="6" y="6" width="88" height="88" rx="6" fill={BLUE} />
      <text x="50" y="74" textAnchor="middle" fill="#fff" fontSize="64" fontWeight="800" fontFamily="Arial, sans-serif">P</text>
    </g>
  ),
  "warning-triangle": (
    <g>
      <path d="M50 10 L92 84 H8 Z" fill="none" stroke={RED} strokeWidth="11" strokeLinejoin="round" />
      <path d="M50 30 L76 76 H24 Z" fill="none" stroke="#f5a3a6" strokeWidth="3" />
    </g>
  ),
};

const LIGHTS = {
  green: ["", "", "green"],
  yellow: ["", "yellow", ""],
  red: ["red", "", ""],
  "red-yellow": ["red", "yellow", ""],
  "yellow-blink": ["", "yellow-blink", ""],
};

const LIGHT_NAMES = {
  green: "Зелёный сигнал",
  yellow: "Жёлтый сигнал",
  red: "Красный сигнал",
  "red-yellow": "Красный и жёлтый",
  "yellow-blink": "Мигающий жёлтый",
};

const COLORS = { red: RED, yellow: YELLOW, green: "#22a04b" };

function TrafficLight({ mode }) {
  const lamps = LIGHTS[mode] || ["", "", ""];
  return (
    <svg viewBox="0 0 44 100" className="h-full w-auto" role="img" aria-label={LIGHT_NAMES[mode] || mode}>
      <rect x="4" y="2" width="36" height="96" rx="9" fill="#1d2433" />
      {["red", "yellow", "green"].map((color, i) => {
        const on = lamps[i];
        return (
          <circle
            key={color}
            cx="22"
            cy={20 + i * 30}
            r="11"
            fill={on ? COLORS[color] : "#3a4256"}
            className={on.endsWith("blink") ? "animate-pulse" : ""}
            style={on ? { filter: `drop-shadow(0 0 5px ${COLORS[color]})` } : undefined}
          />
        );
      })}
    </svg>
  );
}

export function signName(code) {
  return code.startsWith("light:") ? LIGHT_NAMES[code.slice(6)] : NAMES[code];
}

export default function RoadSign({ code, size = "h-24", caption = false }) {
  const light = code.startsWith("light:");
  if (!light && !SIGNS[code]) return null;
  const name = signName(code);
  return (
    <figure className="flex w-fit flex-col items-center gap-1.5">
      <span className={`flex items-center justify-center ${size}`}>
        {light ? (
          <TrafficLight mode={code.slice(6)} />
        ) : (
          <svg viewBox="0 0 100 100" className="h-full w-auto drop-shadow-sm" role="img" aria-label={name}>
            {SIGNS[code]}
          </svg>
        )}
      </span>
      {caption && (
        <figcaption lang="ru" className="max-w-[9rem] text-center text-body-sm leading-tight text-on-surface-variant">
          {!light && code !== "warning-triangle" && <span className="font-semibold tabular-nums text-on-surface">{code} </span>}
          {name}
        </figcaption>
      )}
    </figure>
  );
}

export function SignRow({ codes }) {
  if (!codes?.length) return null;
  return (
    <div className="flex flex-wrap items-end gap-5 rounded-xl bg-surface-container-low p-4 ring-1 ring-outline-variant" aria-label={t("Аломатҳо")}>
      {codes.map((code) => <RoadSign key={code} code={code} caption />)}
    </div>
  );
}
