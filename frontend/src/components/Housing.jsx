import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Ban, BedDouble, BedSingle, Building2, Camera, DoorOpen, FileCheck2, Hourglass, ImagePlus, MapPin, PiggyBank, Receipt, Save, Train, Trash2, Users, X,
} from "lucide-react";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { num } from "../format.js";
import { CITIES } from "../constants.js";
import { fitPhoto } from "./Shop.jsx";
import { Button, Drawer, ErrorBox, Field, Switch } from "./ui.jsx";

export const HOUSING_KINDS = [
  { value: "bed", icon: BedDouble, get label() { return t("Ҷойи хоб"); } },
  { value: "room", icon: DoorOpen, get label() { return t("Ҳуҷра"); } },
  { value: "flat", icon: Building2, get label() { return t("Хонаи пурра"); } },
  { value: "hostel", icon: BedSingle, get label() { return t("Хостел"); } },
];

export const FOR_WHOM = [
  { value: "any", get label() { return t("Ба ҳама"); } },
  { value: "men", get label() { return t("Танҳо мардон"); } },
  { value: "women", get label() { return t("Танҳо занон"); } },
  { value: "family", get label() { return t("Барои оила"); } },
];

export const FLAGS = [
  { key: "registration", icon: FileCheck2, get label() { return t("Бо бақайдгирӣ"); }, get text() { return t("Соҳибхона барои муҳоҷир бақайдгирӣ (регистрация) мекунад."); } },
  { key: "utilities_included", icon: Receipt, get label() { return t("Коммуналӣ дохил"); }, get text() { return t("Пули об, барқ ва газ дар нарх ҳаст."); } },
  { key: "no_deposit", icon: PiggyBank, get label() { return t("Бе гарав"); }, get text() { return t("Пули гарав (залог) лозим нест."); } },
];

export const kindOf = (value) => HOUSING_KINDS.find((k) => k.value === value) || HOUSING_KINDS[0];

export function HousingPrice({ item, className = "" }) {
  return (
    <span className={`tabular-nums ${className}`}>
      <span className="font-semibold">{num(item.price)} ₽</span>
      <span className="text-on-surface-variant"> / {item.period === "day" ? t("шабонарӯз") : t("моҳ")}</span>
    </span>
  );
}

export function HousingStatus({ item }) {
  if (!item.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface-variant">
        <Ban className="h-3.5 w-3.5" aria-hidden />
        {t("Ишғол шуд")}
      </span>
    );
  }
  if (item.status === "approved") return null;
  const rejected = item.status === "rejected";
  const Icon = rejected ? Ban : Hourglass;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm ${rejected ? "bg-error-container text-on-error-container" : "bg-warning-fixed text-on-warning-fixed"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {rejected ? t("Рад шуд") : t("Дар санҷиш")}
    </span>
  );
}

export function HousingCover({ item, className = "aspect-[4/3]" }) {
  const Kind = kindOf(item.kind).icon;
  if (item.photos?.length) return <img src={item.photos[0].url} alt="" loading="lazy" className={`${className} w-full object-cover`} />;
  return (
    <span className={`${className} flex w-full items-center justify-center bg-surface-container-low text-outline`}>
      <Kind className="h-10 w-10" aria-hidden />
    </span>
  );
}

export function HousingCard({ item, children }) {
  const kind = kindOf(item.kind);
  return (
    <div className="card group flex w-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)]">
      <Link to={`/housing/${item.id}`} className="flex flex-1 flex-col">
        <span className="relative block overflow-hidden">
          <HousingCover item={item} />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-label-sm text-on-surface backdrop-blur">
            <kind.icon className="h-3.5 w-3.5" aria-hidden />
            {kind.label}
          </span>
          {item.photos?.length > 1 && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-label-sm text-white">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              {item.photos.length}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-2 p-4">
          <span className="flex items-start justify-between gap-2">
            <HousingPrice item={item} className="text-[18px]" />
            <HousingStatus item={item} />
          </span>
          <span className="line-clamp-2 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{item.title}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{item.city}</span>
            {item.metro && <span className="inline-flex items-center gap-1"><Train className="h-3.5 w-3.5" aria-hidden />{item.metro}</span>}
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{t(item.for_whom_label)}</span>
          </span>
          <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {FLAGS.filter((f) => item[f.key]).map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 rounded-md bg-tertiary-fixed px-2 py-0.5 text-label-sm text-on-tertiary-fixed">
                <f.icon className="h-3.5 w-3.5" aria-hidden />
                {f.label}
              </span>
            ))}
          </span>
        </span>
      </Link>
      {children}
    </div>
  );
}

const EMPTY = {
  kind: "bed", title: "", description: "", city: "", address: "", metro: "", price: "", period: "month", rooms: "", places: "",
  for_whom: "any", registration: false, utilities_included: false, no_deposit: false, phone: "", whatsapp: "", telegram: "",
};

function Photos({ item, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const add = async (files) => {
    setBusy(true);
    setError(null);
    try {
      let last = item;
      for (const file of [...files].slice(0, 8 - item.photos.length)) {
        const body = new FormData();
        body.append("photo", (await fitPhoto(file, 1600).catch(() => null)) || file, "photo.webp");
        last = await api(`/housing/${item.id}/photos/`, { method: "POST", body });
      }
      onChange(last);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo) => {
    try {
      onChange(await api(`/housing/${item.id}/photos/${photo.id}/`, { method: "DELETE" }));
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="label">{t("Аксҳо ({0} аз 8)", item.photos.length)}</span>
      <div className="grid grid-cols-3 gap-2">
        {item.photos.map((p) => (
          <span key={p.id} className="relative">
            <img src={p.url} alt="" className="aspect-square w-full rounded-xl object-cover ring-1 ring-outline-variant" />
            <button type="button" onClick={() => remove(p)} aria-label={t("Нест кардан")} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </span>
        ))}
        {item.photos.length < 8 && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-outline/50 text-label-sm text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface disabled:opacity-50">
            <ImagePlus className="h-6 w-6" aria-hidden />
            {busy ? "…" : t("Илова кардан")}
          </button>
        )}
      </div>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { add(e.target.files || []); e.target.value = ""; }} />
      <ErrorBox error={error} />
    </div>
  );
}

export function HousingForm({ open, item, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSaved(item || null);
    setError(null);
    setForm(item ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, item[k] ?? ""])) : EMPTY);
  }, [open, item]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const err = (key) => error?.data?.[key];

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { ...form, price: Number(form.price) || 0, rooms: form.rooms ? Number(form.rooms) : null, places: form.places ? Number(form.places) : null };
    try {
      const data = saved
        ? await api(`/housing/${saved.id}/`, { method: "PATCH", body })
        : await api("/housing/", { method: "POST", body });
      setSaved(data);
      onSaved(data);
    } catch (e2) {
      setError(e2);
    } finally {
      setSaving(false);
    }
  };

  const updatePhotos = (data) => {
    setSaved(data);
    onSaved(data);
  };

  return createPortal(
    <Drawer open={open} onClose={onClose} title={saved ? t("Эълони манзил") : t("Эълони нав")} subtitle={t("Пас аз санҷиши муҳаррир ба ҳама намоён мешавад.")} icon={Building2}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {HOUSING_KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => set("kind")(k.value)} aria-pressed={form.kind === k.value} className={`flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-label-md ring-1 ring-inset transition-colors ${form.kind === k.value ? "bg-ink text-on-ink ring-ink" : "ring-outline-variant hover:bg-surface-container-low"}`}>
              <k.icon className="h-4 w-4 shrink-0" aria-hidden />
              {k.label}
            </button>
          ))}
        </div>
        <Field label={t("Сарлавҳа")} required error={err("title")}>
          <input className="input" maxLength={120} value={form.title} onChange={set("title")} placeholder={t("Масалан: Ҷойи хоб дар ҳуҷраи 3-нафара, назди метро")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Нарх, ₽")} required error={err("price")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.price} onChange={(e) => set("price")(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="9000" />
          </Field>
          <Field label={t("Барои")} error={err("period")}>
            <select className="input" value={form.period} onChange={set("period")}>
              <option value="month">{t("моҳ")}</option>
              <option value="day">{t("шабонарӯз")}</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Шаҳр")} required error={err("city")}>
            <input className="input" value={form.city} onChange={set("city")} list="housing-form-cities" placeholder="Москва" />
            <datalist id="housing-form-cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label={t("Метро")} error={err("metro")}>
            <input className="input" maxLength={100} value={form.metro} onChange={set("metro")} placeholder="Люблино" />
          </Field>
        </div>
        <Field label={t("Суроға")} error={err("address")} hint={t("Кӯча ва ноҳия кифоя аст, рақами хонаро ҳатман нанависед.")}>
          <input className="input" maxLength={255} value={form.address} onChange={set("address")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("Ҳуҷраҳо")} error={err("rooms")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.rooms ?? ""} onChange={(e) => set("rooms")(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
          <Field label={t("Ҷойҳои холӣ")} error={err("places")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.places ?? ""} onChange={(e) => set("places")(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
          <Field label={t("Барои кӣ")} error={err("for_whom")}>
            <select className="input" value={form.for_whom} onChange={set("for_whom")}>
              {FOR_WHOM.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          {FLAGS.map((f) => (
            <Switch key={f.key} checked={!!form[f.key]} onChange={set(f.key)} icon={f.icon} title={f.label} text={f.text} />
          ))}
        </div>
        <Field label={t("Тавсиф")} error={err("description")}>
          <textarea className="input min-h-[120px] resize-y" rows={4} maxLength={3000} value={form.description} onChange={set("description")} placeholder={t("Чӣ ҳаст: Wi-Fi, мошини ҷомашӯӣ, ошхона. Чанд нафар зиндагӣ мекунанд. Шартҳо.")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("Телефон")} error={err("phone")}>
            <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 999 123-45-67" />
          </Field>
          <Field label="WhatsApp" error={err("whatsapp")}>
            <input className="input" type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+7 999 123-45-67" />
          </Field>
          <Field label="Telegram" error={err("telegram")}>
            <input className="input" value={form.telegram} onChange={set("telegram")} placeholder="@username" />
          </Field>
        </div>
        <ErrorBox error={error && !["title", "price", "city", "phone", "whatsapp", "telegram", "metro", "address", "rooms", "places", "description"].some((k) => error.data?.[k]) ? error : null} />
        <Button type="submit" loading={saving} icon={Save} disabled={!form.title.trim() || !form.city.trim() || form.price === ""}>
          {saved ? t("Нигоҳ доштан") : t("Фиристодан ба санҷиш")}
        </Button>
      </form>
      {saved && (
        <div className="mt-6 border-t border-outline-variant pt-6">
          <Photos item={saved} onChange={updatePhotos} />
        </div>
      )}
    </Drawer>,
    document.body,
  );
}

export function DeleteHousing({ item, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!window.confirm(t("Эълонро нест кунем?"))) return;
    setBusy(true);
    try {
      await api(`/housing/${item.id}/`, { method: "DELETE" });
      onDeleted(item);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={remove} disabled={busy} aria-label={t("Нест кардан")} title={t("Нест кардан")} className="flex h-9 w-9 items-center justify-center rounded-lg text-error ring-1 ring-inset ring-outline-variant hover:bg-error-container disabled:opacity-50">
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
