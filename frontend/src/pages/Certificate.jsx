import { useEffect, useId, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import qrcode from "qrcode-generator";
import { BadgeCheck, Copy, Printer, ShieldAlert } from "lucide-react";
import { t } from "../i18n.js";
import { useApi } from "../hooks.js";
import { BackLink, Button, ErrorBox, Skeleton } from "../components/ui.jsx";

const INK = "#1f3a93";
const GOLD = "#b8892b";
const NAVY = "#0f1f4b";

function Qr({ text, className = "" }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, size };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${path.size + 4} ${path.size + 4}`} className={className} shapeRendering="crispEdges" aria-hidden>
      <rect x="-2" y="-2" width={path.size + 4} height={path.size + 4} fill="#fff" />
      <path d={path.d} fill={NAVY} />
    </svg>
  );
}

function Stamp({ year, className = "" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <path id={`ring-${id}`} d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0" />
        <filter id={`ink-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.85 0.95" /></feComponentTransfer>
        </filter>
      </defs>
      <g filter={`url(#ink-${id})`} fill="none" stroke={INK}>
        <circle cx="60" cy="60" r="56" strokeWidth="3" />
        <circle cx="60" cy="60" r="51" strokeWidth="1" />
        <circle cx="60" cy="60" r="32" strokeWidth="1.4" />
        <text fill={INK} stroke="none" fontSize="9.4" fontWeight="700" letterSpacing="1.1" fontFamily="Onest, sans-serif">
          <textPath href={`#ring-${id}`}>MUHOJIR • МАКТАБИ ЗАБОНИ РУСӢ • KING.TJ •</textPath>
        </text>
        <path d="M60 36 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1z" fill={INK} stroke="none" />
        <text x="60" y="70" textAnchor="middle" fill={INK} stroke="none" fontSize="10.5" fontWeight="800" letterSpacing="1.5" fontFamily="Onest, sans-serif">ТАСДИҚ</text>
        <text x="60" y="81" textAnchor="middle" fill={INK} stroke="none" fontSize="8" fontWeight="700" fontFamily="Onest, sans-serif">{year}</text>
      </g>
    </svg>
  );
}

function Seal({ level, className = "" }) {
  const points = useMemo(() => {
    const out = [];
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      const radius = i % 2 ? 44 : 48;
      out.push(`${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`);
    }
    return out.join(" ");
  }, []);
  return (
    <svg viewBox="0 0 100 128" className={className} aria-hidden>
      <path d="M30 80 L18 126 L33 116 L42 127 L48 86z" fill="#c4232b" />
      <path d="M70 80 L82 126 L67 116 L58 127 L52 86z" fill="#1e7a3e" />
      <polygon points={points} fill={GOLD} />
      <circle cx="50" cy="50" r="38" fill="#d9ab48" stroke="#fff6dc" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="#8a6416" strokeWidth="0.8" strokeDasharray="1.5 2" />
      <text x="50" y="44" textAnchor="middle" fill="#5b3f06" fontSize="9" fontWeight="700" letterSpacing="1" fontFamily="Onest, sans-serif">САТҲИ</text>
      <text x="50" y="68" textAnchor="middle" fill="#3f2b03" fontSize="26" fontWeight="800" fontFamily="Onest, sans-serif">{level}</text>
    </svg>
  );
}

function Signature({ className = "" }) {
  return (
    <svg viewBox="0 0 200 70" className={className} aria-hidden>
      <path
        d="M12 48 C 22 20, 36 14, 38 30 S 30 58, 46 46 S 62 18, 70 34 S 72 54, 86 40 C 94 32, 98 26, 104 36 S 110 52, 122 38 C 130 28, 138 30, 136 42 S 150 50, 160 34 C 166 26, 176 24, 188 30"
        fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M40 56 C 80 50, 130 52, 176 46" fill="none" stroke={NAVY} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Paper({ certificate, url }) {
  const issued = new Date(certificate.issued_at);
  const date = issued.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="relative w-full overflow-hidden bg-[#fffdf6] text-[#0f1f4b] shadow-[0_30px_80px_-40px_rgb(16_36_84/0.6)] [aspect-ratio:297/210] [container-type:inline-size] print:shadow-none" style={{ fontFamily: "Onest, system-ui, sans-serif" }}>
      <div className="absolute inset-x-0 top-0 flex h-[1.4cqw] flex-col"><span className="flex-1 bg-[#c4232b]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#1e7a3e]" /></div>
      <div className="absolute inset-x-0 bottom-0 flex h-[1.4cqw] flex-col"><span className="flex-1 bg-[#c4232b]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#1e7a3e]" /></div>
      <div className="absolute inset-[2.6cqw] border-[0.25cqw] border-[#0f1f4b]" />
      <div className="absolute inset-[3.3cqw] border-[0.1cqw] border-[#b8892b]" />
      <div
        className="absolute inset-[3.3cqw] opacity-[0.06]"
        style={{ backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #1f3a93 0 0.5px, transparent 0.5px 9px)" }}
      />
      {["left-[3.3cqw] top-[3.3cqw]", "right-[3.3cqw] top-[3.3cqw] rotate-90", "right-[3.3cqw] bottom-[3.3cqw] rotate-180", "left-[3.3cqw] bottom-[3.3cqw] -rotate-90"].map((place) => (
        <svg key={place} viewBox="0 0 40 40" className={`absolute h-[5cqw] w-[5cqw] ${place}`} aria-hidden>
          <path d="M2 2 H30 M2 2 V30 M8 8 H22 M8 8 V22" stroke={GOLD} strokeWidth="1.6" fill="none" />
          <circle cx="8" cy="8" r="2.4" fill={GOLD} />
        </svg>
      ))}

      <div className="absolute inset-[5.5cqw] flex flex-col items-center text-center">
        <div className="flex items-center gap-[1cqw]">
          <img src="/logo.png" alt="" className="h-[4.2cqw] w-[4.2cqw] rounded-full bg-white p-[0.2cqw] ring-[0.1cqw] ring-[#b8892b]" />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[2.2cqw] font-bold tracking-[0.04em]">Muhojir</span>
            <span className="text-[1.05cqw] text-[#4a5a85]">Курси онлайни забони русӣ · Онлайн-курс русского языка</span>
          </div>
        </div>

        <h1 className="mt-[1.6cqw] text-[5.4cqw] font-extrabold leading-none tracking-[0.18em] text-[#0f1f4b]">СЕРТИФИКАТ</h1>
        <p className="mt-[0.7cqw] text-[1.3cqw] font-semibold uppercase tracking-[0.3em] text-[#b8892b]">дар бораи хатми сатҳ · об окончании уровня</p>

        <p className="mt-[2.2cqw] text-[1.45cqw] text-[#4a5a85]">Ин сертификат тасдиқ мекунад, ки · Настоящим подтверждается, что</p>
        <p className="mt-[0.8cqw] border-b-[0.12cqw] border-[#b8892b] px-[3cqw] pb-[0.4cqw] text-[4cqw] font-bold leading-tight text-[#1f3a93]">{certificate.full_name}</p>

        <p className="mt-[1.6cqw] max-w-[72cqw] text-[1.55cqw] leading-snug">
          сатҳи <b>{certificate.level}</b> — «<b>{certificate.level_title}</b>»-и курси забони русиро хатм карда, имтиҳони ниҳоиро бо натиҷаи <b>{certificate.percent}%</b> супоридааст.
        </p>
        <p className="mt-[0.6cqw] max-w-[72cqw] text-[1.35cqw] leading-snug text-[#4a5a85]">
          успешно завершил(а) уровень {certificate.level} «{certificate.level_title_ru}» курса русского языка и сдал(а) итоговый экзамен с результатом {certificate.percent}%.
        </p>

        <div className="mt-auto grid w-full grid-cols-[1fr_auto_1fr_auto] items-end gap-[2cqw] text-left">
          <div className="flex flex-col gap-[0.5cqw] text-[1.2cqw]">
            <span><span className="text-[#4a5a85]">Сана · Дата:</span> <b>{date}</b></span>
            <span><span className="text-[#4a5a85]">Рақам · Номер:</span> <b>{certificate.number}</b></span>
          </div>
          <Seal level={certificate.level} className="mb-[-0.6cqw] h-[11cqw] w-[8.6cqw]" />
          <div className="relative flex flex-col items-center">
            <Signature className="h-[5cqw] w-[15cqw]" />
            <Stamp year={issued.getFullYear()} className="absolute bottom-[3.4cqw] left-[56%] h-[9.5cqw] w-[9.5cqw] -rotate-[14deg] mix-blend-multiply" />
            <span className="w-[24cqw] whitespace-nowrap border-t-[0.1cqw] border-[#0f1f4b] pt-[0.4cqw] text-center text-[1.1cqw] text-[#4a5a85]">Роҳбари лоиҳа · Руководитель проекта</span>
          </div>
          <div className="flex flex-col items-center gap-[0.3cqw]">
            <Qr text={url} className="h-[8.5cqw] w-[8.5cqw]" />
            <span className="text-[0.85cqw] text-[#4a5a85]">Санҷиш · Проверка</span>
          </div>
        </div>
        <p className="mt-[1.2cqw] text-[0.85cqw] text-[#6b7799]">
          {url.replace(/^https?:\/\//, "")} · Ҳуҷҷати давлатӣ нест ва имтиҳони давлатиро барои патент иваз намекунад · Не является государственным документом
        </p>
      </div>

      {certificate.is_revoked && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40">
          <span className="-rotate-12 rounded-[1cqw] border-[0.5cqw] border-[#c4232b] px-[3cqw] py-[1cqw] text-[5cqw] font-extrabold tracking-[0.1em] text-[#c4232b]">БЕКОР ШУД · АННУЛИРОВАН</span>
        </div>
      )}
    </div>
  );
}

export default function Certificate() {
  const { code } = useParams();
  const { data, error } = useApi(`/course/certificates/${code}/`);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/certificates/${code}`;

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@page { size: A4 landscape; margin: 0; } @media print { #print-area { width: 297mm; } }";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pt-2 md:pt-6">
      <BackLink to="/course">{t("Курси забони русӣ")}</BackLink>
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Skeleton className="aspect-[297/210] w-full" />
      ) : (
        <>
          <div className={`flex flex-col gap-3 rounded-xl p-4 ring-1 sm:flex-row sm:items-center ${data.is_revoked ? "bg-error-container text-on-error-container ring-error/30" : "bg-tertiary-fixed text-on-tertiary-fixed ring-tertiary/30"}`}>
            {data.is_revoked ? <ShieldAlert className="h-6 w-6 shrink-0" aria-hidden /> : <BadgeCheck className="h-6 w-6 shrink-0" aria-hidden />}
            <p className="flex-1 text-body-md">
              {data.is_revoked
                ? t("Ин сертификат бекор карда шудааст ва эътибор надорад.")
                : t("Сертификати ҳақиқӣ: № {0} ба {1} барои сатҳи {2} дода шудааст.", data.number, data.full_name, data.level)}
            </p>
            <div className="flex gap-2">
              <Button variant="plain" icon={Copy} onClick={copy}>{copied ? t("Нусха шуд") : t("Нусхаи пайванд")}</Button>
              <Button icon={Printer} onClick={() => window.print()}>{t("Чоп / PDF")}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div id="print-area" className="min-w-[640px]">
              <Paper certificate={data} url={url} />
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant">{t("Барои PDF: «Чоп / PDF»-ро пахш кунед ва «Сохранить как PDF»-ро интихоб кунед.")}</p>
        </>
      )}
    </div>
  );
}
