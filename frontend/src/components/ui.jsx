import { useEffect } from "react";
import { AnimatePresence, m } from "motion/react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, X, XCircle } from "lucide-react";
import { t } from "../i18n.js";
import { daysText } from "../format.js";
import { Emblem } from "./Pattern.jsx";

const BUTTON = {
  primary: "bg-navy text-white hover:brightness-125 shadow-[0_10px_22px_-10px_rgb(16_38_92/0.8)] dark:bg-primary dark:text-on-primary",
  soft: "bg-primary-fixed text-on-primary-fixed hover:brightness-95",
  plain: "bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant hover:bg-surface-container-low",
  danger: "bg-error text-on-error hover:opacity-90",
  // For the blue patterned banners: red main action, white secondary one.
  accent: "bg-secondary text-on-secondary hover:bg-secondary-container shadow-[0_8px_20px_-8px_rgb(var(--c-secondary)/0.8)]",
  light: "bg-surface-container-lowest text-navy ring-1 ring-outline-variant hover:bg-surface-container-low dark:text-on-surface",
  ghost: "text-on-surface-variant hover:bg-surface-container-low",
};

export function Button({ variant = "primary", icon: Icon, loading, className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-2.5 text-label-lg transition-all hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

// Document status: always color + icon + text, never color alone.
export const STATUS = {
  expired: { box: "bg-error-container text-on-error-container", bar: "bg-error", icon: XCircle, accent: "text-error" },
  expiring: { box: "bg-warning-fixed text-on-warning-fixed", bar: "bg-warning-container", icon: Clock, accent: "text-warning" },
  valid: { box: "bg-tertiary-fixed text-on-tertiary-fixed", bar: "bg-tertiary-container", icon: CheckCircle2, accent: "text-tertiary" },
};

export function statusText(doc) {
  if (doc.status === "expired") return t("Мӯҳлат гузашт");
  if (doc.status === "expiring") return daysText(doc.days_left);
  return t("Эътибор дорад ({0} рӯз)", doc.days_left);
}

export function StatusBadge({ doc, className = "" }) {
  const s = STATUS[doc.status] || STATUS.valid;
  const Icon = s.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md ${s.box} ${className}`}>
      <Icon className="h-4 w-4" aria-hidden />
      {statusText(doc)}
    </span>
  );
}

export function Chip({ icon: Icon, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 text-label-md text-on-surface-variant ${className}`}>
      {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden />}
      {children}
    </span>
  );
}

export function ErrorBox({ error, className = "" }) {
  if (!error) return null;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-xl bg-error-container p-3 text-body-sm text-on-error-container ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
      <span>{error.message || String(error)}</span>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-container ${className}`} />;
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-navy text-white shadow-[0_12px_28px_-12px_rgb(16_38_92/0.7)] dark:bg-primary dark:text-on-primary">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
      )}
      <h3 className="text-headline-sm">{title}</h3>
      {text && <p className="max-w-md text-body-md text-on-surface-variant">{text}</p>}
      {children}
    </div>
  );
}

export function Field({ label, required, error, children, hint }) {
  return (
    <label className="block">
      <span className="label">
        {label} {required && <span className="text-error">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-body-sm text-on-surface-variant">{hint}</span>}
      {error && <span className="mt-1 block text-body-sm text-error">{[].concat(error).join(" ")}</span>}
    </label>
  );
}

// Side panel on desktop, full-height sheet on phones. Closes on Escape and on the dark backdrop.
export function Drawer({ open, onClose, title, subtitle, icon: Icon, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // The panel slides in from the right while the dark backdrop fades in; both animate out on close.
  return (
    <AnimatePresence>
      {open && (
        <m.div key="drawer" className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title} exit={{ opacity: 1 }}>
          <m.div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <m.div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-background shadow-2xl md:my-3 md:mr-3 md:h-[calc(100%-24px)] md:rounded-[36px]" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 overflow-hidden bg-navy p-5 text-white md:p-6">
              <div className="flag-line absolute inset-x-0 bottom-0 h-[4px]" />
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                )}
                <div>
                  <h2 className="font-display text-[20px] font-extrabold leading-tight">{title}</h2>
                  {subtitle && <p className="text-body-sm text-white/70">{subtitle}</p>}
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label={t("Пӯшидан")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 p-4 md:p-6">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

// The top of every page: a small flag label, a big headline, one line of text, and the page's main actions on the
// right. Light, on the milky paper; a soft glow of the flag's colors behind it. children: buttons (any variant).
export function PageHeader({ eyebrow, title, text, children, icon: Icon }) {
  return (
    <section className="relative isolate mb-2 pt-2 md:pt-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-64 w-[60%] rounded-full bg-gradient-to-l from-primary/10 via-gold/10 to-transparent blur-3xl" />
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="flex max-w-3xl flex-col gap-3">
          {eyebrow && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-container-lowest py-1.5 pl-1.5 pr-3.5 text-label-md text-on-surface-variant ring-1 ring-outline-variant/70">
              <Emblem className="h-4 w-6" />
              {eyebrow}
            </span>
          )}
          <h1 className="flex items-center gap-3 font-display text-[34px] font-extrabold leading-[1.08] tracking-tight text-navy dark:text-on-surface md:text-[52px]">
            {Icon && (
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-navy text-white shadow-[0_10px_24px_-10px_rgb(16_38_92/0.7)] md:flex">
                <Icon className="h-7 w-7" aria-hidden />
              </span>
            )}
            {title}
          </h1>
          {text && <p className="max-w-2xl text-body-lg text-on-surface-variant md:text-[18px] md:leading-7">{text}</p>}
        </div>
        {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
      </div>
      <div className="mt-6 h-px bg-gradient-to-r from-outline-variant via-outline-variant/60 to-transparent" />
    </section>
  );
}
