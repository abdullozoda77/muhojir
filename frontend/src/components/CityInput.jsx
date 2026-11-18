import { useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { CITIES } from "../constants.js";

export default function CityInput({ icon: Icon, value, onChange, options = CITIES, className = "", wrapperClassName = "", onFocus, onBlur, ...props }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);

  const matches = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    const all = [...new Set(options.filter(Boolean))];
    if (!q) return all;
    const starts = all.filter((c) => c.toLowerCase().startsWith(q));
    const contains = all.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [value, options]);

  const visible = open && matches.length > 0 && !(matches.length === 1 && matches[0] === value);

  const pick = (city) => {
    onChange({ target: { value: city } });
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (!visible) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? Math.min(active + 1, matches.length - 1) : Math.max(active - 1, 0);
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <span className={`relative block ${wrapperClassName}`}>
      {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant" aria-hidden />}
      <input
        {...props}
        className={className}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
        onKeyDown={onKeyDown}
      />
      {visible && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 min-w-[12rem] overflow-y-auto rounded-xl bg-surface-container-lowest p-1 text-left shadow-xl ring-1 ring-outline-variant"
        >
          {matches.map((city, i) => (
            <li
              key={city}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(city);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-body-md text-on-surface transition-colors hover:bg-surface-container-high ${i === active ? "bg-surface-container-high" : ""}`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
              {city}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
