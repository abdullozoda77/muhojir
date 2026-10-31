import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { t } from "../i18n.js";
import { Button, Drawer } from "./ui.jsx";

export function chipClass(on) {
  return `flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-label-md transition-colors ${on ? "bg-ink text-on-ink" : "bg-surface-container-lowest text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`;
}

export function ChipRow({ children }) {
  return (
    <div className="relative -mx-4 md:mx-0">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 md:flex-wrap md:overflow-visible md:px-0">{children}</div>
    </div>
  );
}

export function FilterBar({ count, onOpen, sort, children }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-label-lg transition-colors ${count ? "bg-primary-fixed text-on-primary-fixed ring-1 ring-inset ring-primary/30" : "bg-surface-container-lowest text-on-surface ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low"}`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {t("Филтрҳо")}
        {count > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-on-primary">{count}</span>}
      </button>
      {children}
      {sort && <div className="ml-auto min-w-0">{sort}</div>}
    </div>
  );
}

export function SortSelect({ value, options, onChange }) {
  return (
    <label className="relative flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl bg-surface-container-lowest pl-3.5 pr-9 text-label-md text-on-surface ring-1 ring-inset ring-outline-variant transition-colors focus-within:ring-2 focus-within:ring-primary/40 hover:bg-surface-container-low">
      <ArrowUpDown className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
      <select aria-label={t("Тартиб")} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 cursor-pointer appearance-none truncate border-0 bg-transparent p-0 pr-1 text-label-md text-on-surface focus:ring-0">
        {options.map(([v, label]) => <option key={v || "default"} value={v}>{label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-on-surface-variant" aria-hidden />
    </label>
  );
}

export function ActiveFilters({ items, onReset }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <button key={item.key} type="button" onClick={item.onRemove} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-primary-fixed pl-3 pr-2 text-label-sm text-on-primary-fixed ring-1 ring-inset ring-primary/20 transition-colors hover:bg-primary-fixed/70">
          {item.label}
          <X className="h-3.5 w-3.5" aria-label={t("Тоза кардан")} />
        </button>
      ))}
      {items.length > 1 && (
        <button type="button" onClick={onReset} className="min-h-[32px] rounded-full px-2.5 text-label-sm text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline">
          {t("Ҳамаро тоза кардан")}
        </button>
      )}
    </div>
  );
}

export function FilterGroup({ title, children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-label-md uppercase tracking-wide text-on-surface-variant">{title}</h3>
      {children}
    </section>
  );
}

export function OptionGrid({ value, options, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(([v, label]) => (
        <button key={v || "all"} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className={`min-h-[44px] rounded-xl px-3 text-label-md transition-colors ${value === v ? "bg-ink text-on-ink" : "bg-surface-container-lowest text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function FilterSheet({ open, onClose, onReset, count, total, loading, children }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("Филтрҳо")}
      icon={SlidersHorizontal}
      footer={
        <div className="flex gap-2">
          <Button variant="plain" onClick={onReset} disabled={!count} className="flex-1">
            {t("Тоза кардан")}
          </Button>
          <Button onClick={onClose} className="flex-[2] tabular-nums">
            {loading ? "…" : t("Нишон додан ({0})", total)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">{children}</div>
    </Drawer>
  );
}
