import { Star } from "lucide-react";
import { t } from "../i18n.js";

export function average(reviews) {
  if (!reviews?.length) return null;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function Stars({ value, size = "h-4 w-4" }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={t("Баҳо: {0} аз 5", value?.toFixed(1) ?? "—")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${value >= n - 0.25 ? "fill-warning-container text-warning-container" : "text-outline-variant"}`} aria-hidden />
      ))}
    </span>
  );
}

// Big stars to pick a rating in the review form.
export function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t("Баҳо")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t("{0} ситора", n)} onClick={() => onChange(n)} className="flex h-12 w-12 items-center justify-center rounded-lg hover:bg-surface-container-low">
          <Star className={`h-8 w-8 ${value >= n ? "fill-warning-container text-warning-container" : "text-outline-variant"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}
