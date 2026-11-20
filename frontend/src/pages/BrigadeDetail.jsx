import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays, Check, CheckCircle2, Crown, EyeOff, Handshake, LogOut, MapPin, Pencil, Send, ShieldAlert, Trash2, UserPlus, UserRound,
  UsersRound, Wallet, X,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import CityInput from "../components/CityInput.jsx";
import { Stars } from "../components/Stars.jsx";
import { BackLink, Button, Drawer, EmptyState, ErrorBox, Field, Skeleton, Switch } from "../components/ui.jsx";
import { canEdit } from "../components/Layout.jsx";
import { BrigadeForm, Contacts, FreeBadge, today, tradeOf } from "./Brigades.jsx";

function HireForm({ open, brigade, onClose, onSent }) {
  const empty = { description: "", city: "", start_date: "", workers: "", budget: "", phone: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({ ...empty, city: brigade.city });
      setError(null);
    }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const digits = (key, n) => (e) => set(key)(e.target.value.replace(/\D/g, "").slice(0, n));
  const err = (key) => error?.data?.[key];

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form, start_date: form.start_date || null,
        workers: form.workers === "" ? null : Number(form.workers), budget: form.budget === "" ? null : Number(form.budget),
      };
      await api(`/brigades/${brigade.id}/orders/`, { method: "POST", body });
      onSent();
    } catch (er) {
      setError(er);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Drawer open={open} onClose={onClose} title={t("Ба кор даъват кардан")} subtitle={t("Сардори гурӯҳ «{0}» фармоишро мебинад ва бо шумо тамос мегирад.", brigade.name)} icon={Handshake}>
      <form onSubmit={send} className="flex flex-col gap-4">
        <Field label={t("Чӣ кор кардан лозим")} required error={err("description")}>
          <textarea className="input min-h-[110px] resize-y" rows={4} maxLength={2000} value={form.description} onChange={set("description")} placeholder={t("Масалан: Таъмири пурраи хонаи 2-ҳуҷрагӣ, 54 м². Кафел, шпаклёвка, ранг.")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Шаҳр")} error={err("city")}>
            <CityInput className="input" value={form.city} onChange={set("city")} placeholder="Москва" />
          </Field>
          <Field label={t("Кай сар кунем")} error={err("start_date")}>
            <input className="input" type="date" min={today()} value={form.start_date} onChange={set("start_date")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Чанд нафар лозим")} error={err("workers")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.workers} onChange={digits("workers", 3)} placeholder="3" />
          </Field>
          <Field label={t("Буҷет, ₽")} error={err("budget")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.budget} onChange={digits("budget", 9)} placeholder="100000" />
          </Field>
        </div>
        <Field label={t("Телефони шумо")} required error={err("phone")} hint={t("Рақамро танҳо сардори гурӯҳ мебинад.")}>
          <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 999 123-45-67" />
        </Field>
        <ErrorBox error={error && !Object.keys(empty).some((k) => error.data?.[k]) ? error : null} />
        <Button type="submit" loading={busy} icon={Send} disabled={form.description.trim().length < 10 || !form.phone.trim()}>{t("Фиристодан")}</Button>
      </form>
    </Drawer>,
    document.body,
  );
}

function JoinForm({ open, brigade, onClose, onSent }) {
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/brigades/${brigade.id}/join/`, { method: "POST", body: { skill } });
      onSent();
    } catch (er) {
      setError(er);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Drawer open={open} onClose={onClose} title={t("Ба гурӯҳ ҳамроҳ шудан")} subtitle={t("Сардори гурӯҳ дархости шуморо мебинад ва қабул мекунад.")} icon={UserPlus}>
      <form onSubmit={send} className="flex flex-col gap-4">
        <Field label={t("Касби шумо")} hint={t("Масалан: кафелгузор, электрик, ёрдамчӣ")}>
          <input className="input" maxLength={80} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder={t("Кафелгузор")} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={busy} icon={Send}>{t("Дархост фиристодан")}</Button>
      </form>
    </Drawer>,
    document.body,
  );
}

function TeamList({ b, onChange }) {
  const [busy, setBusy] = useState(null);
  const leader = b.my_status === "leader";
  const act = async (m, method) => {
    if (method === "DELETE" && !window.confirm(t("{0}-ро аз гурӯҳ хориҷ кунем?", m.name))) return;
    setBusy(m.id);
    try {
      await api(`/brigades/${b.id}/members/${m.id}/`, { method, body: method === "PATCH" ? { status: "accepted" } : undefined });
      onChange();
    } finally {
      setBusy(null);
    }
  };
  return (
    <ul className="flex flex-col divide-y divide-outline-variant">
      {b.team.map((m) => (
        <li key={m.id ?? "leader"} className="flex flex-wrap items-center gap-3 py-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.status === "leader" ? "bg-warning-container text-on-warning-container" : "bg-surface-container-high"}`}>
            {m.status === "leader" ? <Crown className="h-5 w-5" aria-hidden /> : <UserRound className="h-5 w-5" aria-hidden />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-md font-medium">{m.name}</span>
            <span className="text-body-sm text-on-surface-variant">
              {m.status === "leader" ? t("Сардори гурӯҳ") : m.skill || t("Уста")}
              {m.status === "pending" && ` · ${t("дархост фиристод")}`}
            </span>
          </span>
          {leader && m.status === "pending" && (
            <span className="flex gap-2">
              <Button icon={Check} loading={busy === m.id} onClick={() => act(m, "PATCH")}>{t("Қабул")}</Button>
              <button type="button" disabled={busy === m.id} onClick={() => act(m, "DELETE")} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-label-md ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low" aria-label={t("Рад кардан")}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </span>
          )}
          {leader && m.status === "accepted" && (
            <button type="button" disabled={busy === m.id} onClick={() => act(m, "DELETE")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md text-error hover:bg-error-container/50">
              <X className="h-4 w-4" aria-hidden />
              {t("Хориҷ кардан")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function BrigadeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editor = Boolean(canEdit(user));
  const { data: b, error, loading, reload } = useApi(`/brigades/${id}/`);
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  if (loading && !b) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!b) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/groups" />
        <ErrorBox error={error} />
      </div>
    );
  }

  const trade = tradeOf(b.trade);
  const leader = b.my_status === "leader";

  const patch = async (kind, body) => {
    setBusy(kind);
    try {
      await api(`/brigades/${b.id}/`, { method: "PATCH", body });
      reload();
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (!window.confirm(t("Гурӯҳро нест кунем? Ҳамаи фармоишҳо ва баҳоҳо низ нест мешаванд."))) return;
    await api(`/brigades/${b.id}/`, { method: "DELETE" });
    navigate("/groups?tab=mine", { replace: true });
  };
  const leave = async () => {
    if (!window.confirm(b.my_status === "pending" ? t("Дархостро бекор кунем?") : t("Аз гурӯҳ бароем?"))) return;
    setBusy("leave");
    try {
      await api(`/brigades/${b.id}/join/`, { method: "DELETE" });
      reload();
    } finally {
      setBusy("");
    }
  };
  const done = (text) => {
    setDrawer(null);
    setNotice(text);
    reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/groups">{t("Ҳамаи гурӯҳҳо")}</BackLink>

      <section className={`card flex flex-col gap-5 p-5 md:p-7 ${b.is_hidden ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-label-sm text-primary">
            <trade.icon className="h-3.5 w-3.5" aria-hidden />
            {trade.label()}
          </span>
          <FreeBadge free={b.is_free} />
          {b.is_hidden && <span className="rounded-full bg-error-container px-2.5 py-1 text-label-sm text-on-error-container">{t("Пинҳон")}</span>}
        </div>
        <h1 className="text-headline-md font-semibold [overflow-wrap:anywhere] md:text-headline-lg">{b.name}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [MapPin, t("Шаҳр"), b.city],
            [UsersRound, t("Ҳайат"), t("{0} нафар", b.size)],
            [CalendarDays, t("Таҷриба"), b.experience_years != null ? t("{0} сол", b.experience_years) : "—"],
            [CheckCircle2, t("Корҳои иҷрошуда"), b.jobs_done],
          ].map(([Icon, label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-2xl bg-surface-container-low p-3.5">
              <span className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant"><Icon className="h-4 w-4" aria-hidden />{label}</span>
              <span className="text-body-lg font-semibold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
        {b.price_note && <span className="inline-flex items-center gap-2 text-body-lg font-medium"><Wallet className="h-5 w-5 text-primary" aria-hidden />{b.price_note}</span>}
        <span className="inline-flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
          {b.rating != null ? <><Stars value={b.rating} />{t("{0} аз 5 · {1} баҳо", b.rating, b.reviews)}</> : t("Ҳоло баҳо нест")}
        </span>
        {b.description && <p className="whitespace-pre-line text-body-md [overflow-wrap:anywhere]">{b.description}</p>}
        <div className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface-variant">{t("Тамос бо сардор: {0}", b.leader)}</span>
          <Contacts p={b} />
        </div>

        {notice && (
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3.5 text-body-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            {notice}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!leader && <Button icon={Handshake} onClick={() => setDrawer("hire")}>{t("Ба кор даъват кардан")}</Button>}
          {!leader && !b.my_status && <Button variant="plain" icon={UserPlus} onClick={() => setDrawer("join")}>{t("Ҳамроҳ шудан")}</Button>}
          {(b.my_status === "pending" || b.my_status === "accepted") && (
            <Button variant="plain" icon={LogOut} loading={busy === "leave"} onClick={leave}>{b.my_status === "pending" ? t("Бекор кардани дархост") : t("Баромадан аз гурӯҳ")}</Button>
          )}
          {b.can_edit && <Button variant="plain" icon={Pencil} onClick={() => setDrawer("edit")}>{t("Тағйир додан")}</Button>}
          {editor && (
            <Button variant="plain" icon={EyeOff} loading={busy === "hide"} onClick={() => patch("hide", { is_hidden: !b.is_hidden })}>{b.is_hidden ? t("Нишон додан") : t("Пинҳон кардан")}</Button>
          )}
          {b.can_edit && (
            <button type="button" onClick={remove} className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-4 text-label-md text-error hover:bg-error-container/50">
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Нест кардан")}
            </button>
          )}
        </div>
        {leader && (
          <Switch checked={b.is_free} onChange={(v) => patch("free", { is_free: v })} icon={CheckCircle2} title={t("Ҳоло озод ҳастем")} text={b.is_free ? t("Фармоишгарон мебинанд, ки шумо кор қабул мекунед.") : t("Дар рӯйхат «Банд» навишта мешавад.")} />
        )}
      </section>

      <section className="card flex flex-col gap-2 p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold">
          <UsersRound className="h-5 w-5 text-primary" aria-hidden />
          {t("Аъзоён дар сайт")}
          <span className="text-label-md font-normal text-on-surface-variant tabular-nums">{b.members}</span>
        </h2>
        <TeamList b={b} onChange={reload} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[18px] font-semibold">{t("Баҳоҳои фармоишгарон")}</h2>
        {b.review_list.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {b.review_list.map((r) => (
              <article key={r.id} className="card flex flex-col gap-2 p-5">
                <span className="flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
                  <Stars value={r.rating} />
                  <span className="font-medium text-on-surface">{r.name}</span>
                  <span>· {ago(r.created_at)}</span>
                </span>
                {r.text && <p className="whitespace-pre-line text-body-md [overflow-wrap:anywhere]">{r.text}</p>}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={Handshake} title={t("Ҳоло баҳо нест")} text={t("Баҳоро танҳо фармоишгаре медиҳад, ки гурӯҳро тавассути сайт киро карда, корро анҷом додааст.")} />
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold">
          <ShieldAlert className="h-5 w-5 text-error" aria-hidden />
          {t("Пеш аз кор")}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm text-on-surface-variant">
          <li>{t("Нарх, мӯҳлат ва ҳаҷми корро пешакӣ ба таври хаттӣ (дар WhatsApp ё шартнома) муайян кунед.")}</li>
          <li>{t("Пулро қисм-қисм, баъди тамом шудани ҳар марҳила диҳед — пешпардохти калон надиҳед.")}</li>
          <li>{t("Ба устоҳо: пеш аз кор суроға ва номи фармоишгарро нависед, корро сурат гиред.")}</li>
        </ul>
      </section>

      <BrigadeForm open={drawer === "edit"} brigade={b} onClose={() => setDrawer(null)} onSaved={() => done(t("Тағйирот нигоҳ дошта шуд."))} />
      <HireForm open={drawer === "hire"} brigade={b} onClose={() => setDrawer(null)} onSent={() => done(t("Фармоиш фиристода шуд. Ҷавобро дар «Кори гурӯҳӣ → Фармоишҳо» ва дар огоҳиҳо мебинед."))} />
      <JoinForm open={drawer === "join"} brigade={b} onClose={() => setDrawer(null)} onSent={() => done(t("Дархост фиристода шуд. Вақте сардор қабул кунад, ба шумо хабар медиҳем."))} />
    </div>
  );
}
