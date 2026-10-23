import { useEffect } from "react";
import { AnimatePresence, m } from "motion/react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, X, XCircle } from "lucide-react";
import { t } from "../i18n.js";
import { daysText } from "../format.js";
import { Emblem } from "./Pattern.jsx";
import { Intro, IntroItem, startShown } from "./motion.jsx";

const BUTTON = {
  primary: "bg-ink text-on-ink hover:bg-ink/90",
  soft: "bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed/70",
  plain: "bg-surface-container-lowest text-on-surface ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low",
  danger: "bg-error text-on-error hover:opacity-90",
  // The one blue action of a page.
  accent: "bg-primary text-on-primary hover:bg-primary/90",
  light: "bg-surface-container-lowest text-on-surface ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low",
  ghost: "text-on-surface-variant hover:bg-surface-container-low",
};

export function Button({ variant = "primary", icon: Icon, loading, className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-label-lg transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[variant]} ${className}`}
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
          <Icon className="h-6 w-6" aria-hidden />
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
          <m.div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <m.div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-background shadow-2xl ring-1 ring-outline-variant md:my-3 md:mr-3 md:h-[calc(100%-24px)] md:rounded-2xl" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-outline-variant bg-background/90 p-5 backdrop-blur md:px-6">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                )}
                <div>
                  <h2 className="text-[18px] font-semibold leading-tight">{title}</h2>
                  {subtitle && <p className="text-body-sm text-on-surface-variant">{subtitle}</p>}
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label={t("Пӯшидан")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
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

// The top of every page: a small label, a headline, one line of text, and the page's main actions on the right.
// Plain, on the page, with a hairline under it. children: buttons (any variant).
export function PageHeader({ eyebrow, title, text, children, icon: Icon }) {
  return (
    <section className="mb-2 pt-2 md:pt-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <Intro className="flex max-w-3xl flex-col gap-3">
          {eyebrow && (
            <IntroItem as="span" className="inline-flex w-fit items-center gap-2 text-label-md text-on-surface-variant">
              <Emblem className="h-3 w-[18px]" />
              {eyebrow}
            </IntroItem>
          )}
          <IntroItem as="h1" className="flex items-center gap-3 font-display text-[30px] font-semibold leading-[1.1] text-on-surface md:text-[40px]">
            {Icon && (
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15 md:flex">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            )}
            {title}
          </IntroItem>
          {text && <IntroItem as="p" className="max-w-2xl text-body-lg text-on-surface-variant">{text}</IntroItem>}
        </Intro>
        {children && (
          <Intro className="flex shrink-0 flex-wrap gap-2">
            <IntroItem className="flex flex-wrap gap-2">{children}</IntroItem>
          </Intro>
        )}
      </div>
      {/* The hairline under the header draws itself from the left. */}
      <m.div className="mt-8 h-px origin-left bg-outline-variant" initial={startShown() ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
    </section>
  );
}

// "← Back" above a detail page: a quiet text link.
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="group inline-flex min-h-[40px] items-center gap-1.5 self-start text-label-md text-on-surface-variant transition-colors hover:text-on-surface">
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      {children}
    </Link>
  );
}
