import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import qrcode from "qrcode-generator";
import { BadgeCheck, Copy, Download, Eye, Printer, ShieldAlert } from "lucide-react";
import { t } from "../i18n.js";
import { useApi } from "../hooks.js";
import { BackLink, Button, ErrorBox, Skeleton } from "../components/ui.jsx";

const GOLD = "#d9b765";
const GOLD_DEEP = "#b8913e";
const LIGHT = "#eef2fb";
const MUTED = "#a8b6d8";
const NAVY = "#0b1a3d";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap";

const SAMPLE = {
  code: "sample",
  number: "MJ-RU-2026-00000",
  full_name: "Фарҳод Раҳимов",
  levels: 7,
  lessons: 70,
  percent: 94,
  issued_at: new Date().toISOString(),
  is_revoked: false,
};

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
      <rect x="-2" y="-2" width={path.size + 4} height={path.size + 4} rx="2" fill="#fff" />
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
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.8 0.92" /></feComponentTransfer>
        </filter>
      </defs>
      <g filter={`url(#ink-${id})`} fill="none" stroke={GOLD}>
        <circle cx="60" cy="60" r="56" strokeWidth="3" />
        <circle cx="60" cy="60" r="51" strokeWidth="1" />
        <circle cx="60" cy="60" r="32" strokeWidth="1.4" />
        <text fill={GOLD} stroke="none" fontSize="9.4" fontWeight="700" letterSpacing="1.1" fontFamily="Onest, sans-serif">
          <textPath href={`#ring-${id}`}>MUHOJIR • МАКТАБИ ЗАБОНИ РУСӢ • KING.TJ •</textPath>
        </text>
        <path d="M60 36 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1z" fill={GOLD} stroke="none" />
        <text x="60" y="70" textAnchor="middle" fill={GOLD} stroke="none" fontSize="10.5" fontWeight="800" letterSpacing="1.5" fontFamily="Onest, sans-serif">ТАСДИҚ</text>
        <text x="60" y="81" textAnchor="middle" fill={GOLD} stroke="none" fontSize="8" fontWeight="700" fontFamily="Onest, sans-serif">{year}</text>
      </g>
    </svg>
  );
}

function Seal({ levels, className = "" }) {
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
      <polygon points={points} fill={GOLD_DEEP} />
      <circle cx="50" cy="50" r="38" fill="#e0bd68" stroke="#fff3cf" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="#8a6416" strokeWidth="0.8" strokeDasharray="1.5 2" />
      <text x="50" y="40" textAnchor="middle" fill="#5b3f06" fontSize="8" fontWeight="700" letterSpacing="1" fontFamily="Onest, sans-serif">САТҲҲО</text>
      <text x="50" y="64" textAnchor="middle" fill="#3f2b03" fontSize="22" fontWeight="800" fontFamily="Onest, sans-serif">{levels}/{levels}</text>
    </svg>
  );
}

function Signature({ className = "" }) {
  return (
    <svg viewBox="0 0 200 70" className={className} aria-hidden>
      <path
        d="M12 48 C 22 20, 36 14, 38 30 S 30 58, 46 46 S 62 18, 70 34 S 72 54, 86 40 C 94 32, 98 26, 104 36 S 110 52, 122 38 C 130 28, 138 30, 136 42 S 150 50, 160 34 C 166 26, 176 24, 188 30"
        fill="none" stroke={LIGHT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M40 56 C 80 50, 130 52, 176 46" fill="none" stroke={LIGHT} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const nameSize = (name) => (name.length > 34 ? 2.4 : name.length > 26 ? 3 : name.length > 20 ? 3.5 : 4);

function Flag({ className }) {
  return (
    <div className={`absolute inset-x-0 flex h-[1.2cqw] flex-col ${className}`}>
      <span className="flex-1 bg-[#c4232b]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#1e7a3e]" />
    </div>
  );
}

function Paper({ certificate, url, sample, paperRef }) {
  const issued = new Date(certificate.issued_at);
  const date = issued.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div
      ref={paperRef}
      className="relative w-full overflow-hidden shadow-[0_30px_80px_-30px_rgb(5_12_35/0.9)] [aspect-ratio:297/210] [container-type:inline-size] print:shadow-none"
      style={{
        fontFamily: "Onest, system-ui, sans-serif",
        color: LIGHT,
        background: "radial-gradient(120% 90% at 50% 0%, #1a3a7a 0%, #10285a 45%, #0b1a3d 100%)",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <Flag className="top-0" />
      <Flag className="bottom-0" />
      <div className="absolute inset-[2.6cqw] border-[0.25cqw]" style={{ borderColor: GOLD }} />
      <div className="absolute inset-[3.3cqw] border-[0.1cqw]" style={{ borderColor: `${GOLD}99` }} />
      <div
        className="absolute inset-[3.3cqw] opacity-[0.07]"
        style={{ backgroundImage: "repeating-radial-gradient(circle at 50% 45%, #ffffff 0 0.5px, transparent 0.5px 9px)" }}
      />
      {["left-[3.3cqw] top-[3.3cqw]", "right-[3.3cqw] top-[3.3cqw] rotate-90", "right-[3.3cqw] bottom-[3.3cqw] rotate-180", "left-[3.3cqw] bottom-[3.3cqw] -rotate-90"].map((place) => (
        <svg key={place} viewBox="0 0 40 40" className={`absolute h-[5cqw] w-[5cqw] ${place}`} aria-hidden>
          <path d="M2 2 H30 M2 2 V30 M8 8 H22 M8 8 V22" stroke={GOLD} strokeWidth="1.6" fill="none" />
          <circle cx="8" cy="8" r="2.4" fill={GOLD} />
        </svg>
      ))}

      <div className="absolute inset-[5.5cqw] flex flex-col items-center text-center">
        <div className="flex items-center gap-[1cqw]">
          <img src="/logo.png" alt="" className="h-[4.2cqw] w-[4.2cqw]" />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[2.2cqw] font-bold tracking-[0.04em]">Muhojir</span>
            <span className="whitespace-nowrap text-[1.05cqw]" style={{ color: MUTED }}>Курси онлайни забони русӣ · Онлайн-курс русского языка</span>
          </div>
        </div>

        <h1 className="mt-[1.6cqw] text-[5.4cqw] font-extrabold leading-none tracking-[0.18em]" style={{ color: LIGHT }}>СЕРТИФИКАТ</h1>
        <p className="mt-[0.7cqw] whitespace-nowrap text-[1.3cqw] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>дар бораи хатми курс · об окончании курса</p>

        <p className="mt-[2.2cqw] text-[1.45cqw]" style={{ color: MUTED }}>Ин сертификат тасдиқ мекунад, ки · Настоящим подтверждается, что</p>
        <p
          className="mt-[0.8cqw] max-w-[80cqw] overflow-hidden whitespace-nowrap border-b-[0.12cqw] px-[3cqw] pb-[0.4cqw] font-bold leading-tight"
          style={{ fontSize: `${nameSize(certificate.full_name)}cqw`, color: "#f3d68e", borderColor: GOLD }}
        >
          {certificate.full_name}
        </p>

        <p className="mt-[1.6cqw] max-w-[74cqw] text-[1.55cqw] leading-snug">
          курси пурраи забони русии Muhojir — <b>{certificate.levels} сатҳ</b> ва <b>{certificate.lessons} дарс</b>, аз алифбо то гуфтугӯи озод — бомуваффақият хатм карда, ҳамаи имтиҳонҳоро бо натиҷаи миёнаи <b style={{ color: GOLD }}>{certificate.percent}%</b> супоридааст.
        </p>
        <p className="mt-[0.6cqw] max-w-[74cqw] text-[1.35cqw] leading-snug" style={{ color: MUTED }}>
          успешно прошёл(-ла) полный курс русского языка Muhojir — {certificate.levels} уровней и {certificate.lessons} уроков, от алфавита до свободного разговора — и сдал(а) все экзамены со средним результатом {certificate.percent}%.
        </p>

        <div className="mt-auto grid w-full grid-cols-[1fr_auto_1fr_auto] items-end gap-[2cqw] text-left">
          <div className="flex flex-col gap-[0.5cqw] text-[1.2cqw]">
            <span><span style={{ color: MUTED }}>Сана · Дата:</span> <b>{date}</b></span>
            <span className="whitespace-nowrap"><span style={{ color: MUTED }}>Рақам · Номер:</span> <b>{certificate.number}</b></span>
          </div>
          <Seal levels={certificate.levels} className="mb-[-0.6cqw] h-[11cqw] w-[8.6cqw]" />
          <div className="relative flex flex-col items-center">
            <Signature className="h-[5cqw] w-[15cqw]" />
            <Stamp year={issued.getFullYear()} className="absolute bottom-[3.4cqw] left-[56%] h-[9.5cqw] w-[9.5cqw] -rotate-[14deg]" />
            <span className="w-[24cqw] whitespace-nowrap border-t-[0.1cqw] pt-[0.4cqw] text-center text-[1.1cqw]" style={{ borderColor: LIGHT, color: MUTED }}>Роҳбари лоиҳа · Руководитель проекта</span>
          </div>
          <div className="flex flex-col items-center gap-[0.3cqw]">
            <Qr text={url} className="h-[8.5cqw] w-[8.5cqw]" />
            <span className="whitespace-nowrap text-[0.85cqw]" style={{ color: MUTED }}>Санҷиш · Проверка</span>
          </div>
        </div>
        <p className="mt-[1.2cqw] text-[0.85cqw]" style={{ color: "#8797bf" }}>
          {url.replace(/^https?:\/\//, "")} · Ҳуҷҷати давлатӣ нест ва имтиҳони давлатиро барои патент иваз намекунад · Не является государственным документом
        </p>
      </div>

      {sample && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[18deg] whitespace-nowrap text-[6.5cqw] font-extrabold tracking-[0.15em]" style={{ color: "rgb(255 255 255 / 0.07)" }}>НАМУНА · ОБРАЗЕЦ</span>
        </div>
      )}
      {certificate.is_revoked && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1a3d]/50">
          <span className="-rotate-12 rounded-[1cqw] border-[0.5cqw] border-[#ff5a63] px-[3cqw] py-[1cqw] text-[5cqw] font-extrabold tracking-[0.1em] text-[#ff5a63]">БЕКОР ШУД · АННУЛИРОВАН</span>
        </div>
      )}
    </div>
  );
}

async function inlineFonts() {
  let css = await (await fetch(FONT_CSS)).text();
  for (const match of css.matchAll(/url\((https:[^)]+)\)/g)) {
    const blob = await (await fetch(match[1])).blob();
    const data = await new Promise((done) => {
      const reader = new FileReader();
      reader.onload = () => done(reader.result);
      reader.readAsDataURL(blob);
    });
    css = css.replace(match[1], data);
  }
  return css;
}

async function savePdf(node, number) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const fontEmbedCSS = await inlineFonts().catch(() => undefined);
  const image = await toJpeg(node, { pixelRatio: 3, quality: 0.95, fontEmbedCSS });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addImage(image, "JPEG", 0, 0, 297, 210);
  pdf.save(`Muhojir-${number}.pdf`);
}

export default function Certificate({ sample = false }) {
  const { code } = useParams();
  const { data: loaded, error } = useApi(sample ? null : `/course/certificates/${code}/`);
  const data = sample ? SAMPLE : loaded;
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const paperRef = useRef(null);
  const url = `${window.location.origin}/certificates/${sample ? "sample" : code}`;

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

  const download = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await savePdf(paperRef.current, data.number);
    } catch {
      setSaveError(new Error(t("PDF сохта нашуд. «Чоп»-ро пахш кунед ва «Сохранить как PDF»-ро интихоб кунед.")));
    } finally {
      setSaving(false);
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
          <div className={`flex flex-col gap-3 rounded-xl p-4 ring-1 lg:flex-row lg:items-center ${
            sample ? "bg-primary-fixed text-on-primary-fixed ring-primary/20"
              : data.is_revoked ? "bg-error-container text-on-error-container ring-error/30"
              : "bg-tertiary-fixed text-on-tertiary-fixed ring-tertiary/30"}`}
          >
            {sample ? <Eye className="h-6 w-6 shrink-0" aria-hidden /> : data.is_revoked ? <ShieldAlert className="h-6 w-6 shrink-0" aria-hidden /> : <BadgeCheck className="h-6 w-6 shrink-0" aria-hidden />}
            <p className="flex-1 text-body-md">
              {sample
                ? t("Ин намуна аст. Сертификати ҳақиқӣ бо номи шумо пас аз хатми ҳамаи 7 сатҳ ва супоридани имтиҳони ниҳоӣ дода мешавад.")
                : data.is_revoked
                  ? t("Ин сертификат бекор карда шудааст ва эътибор надорад.")
                  : t("Сертификати ҳақиқӣ: № {0} ба {1} барои хатми пурраи курс дода шудааст.", data.number, data.full_name)}
            </p>
            <div className="flex flex-wrap gap-2">
              {sample ? (
                <Link to="/course" className="inline-flex min-h-[44px] items-center rounded-xl bg-ink px-5 text-label-lg text-on-ink hover:bg-ink/90">{t("Оғози курс")}</Link>
              ) : (
                <>
                  <Button variant="plain" icon={Copy} onClick={copy}>{copied ? t("Нусха шуд") : t("Нусхаи пайванд")}</Button>
                  <Button variant="plain" icon={Printer} onClick={() => window.print()}>{t("Чоп")}</Button>
                  <Button icon={Download} loading={saving} onClick={download}>{t("Боргирии PDF")}</Button>
                </>
              )}
            </div>
          </div>
          <ErrorBox error={saveError} />
          <div className="overflow-x-auto">
            <div id="print-area" className="min-w-[640px]">
              <Paper certificate={data} url={url} sample={sample} paperRef={paperRef} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
