import { useState } from "react";
import { useParams } from "react-router-dom";
import { BedDouble, DoorOpen, MapPin, Pencil, ShieldAlert, Train, Users } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { ContactButtons } from "../components/Shop.jsx";
import { FLAGS, HousingCover, HousingForm, HousingPrice, HousingStatus, kindOf } from "../components/Housing.jsx";
import { BackLink, Button, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";

function Gallery({ item }) {
  const [shown, setShown] = useState(0);
  if (!item.photos.length) return <HousingCover item={item} className="aspect-[16/9] rounded-2xl" />;
  return (
    <div className="flex flex-col gap-2">
      <img src={item.photos[shown]?.url} alt="" className="aspect-[16/9] w-full rounded-2xl bg-surface-container-low object-cover" />
      {item.photos.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {item.photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setShown(i)} aria-pressed={i === shown} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === shown ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100"}`}>
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Moderate({ item, onChange }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const send = async (status) => {
    setError(null);
    try {
      onChange(await api(`/housing/${item.id}/moderate/`, { method: "POST", body: { status, reason } }));
    } catch (err) {
      setError(err);
    }
  };
  return (
    <div className="card flex flex-col gap-3 border-l-[3px] border-warning-container p-5">
      <span className="text-[16px] font-semibold">{t("Санҷиши муҳаррир")}</span>
      <textarea className="input min-h-[72px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Сабаби рад (агар рад кунед)")} />
      <ErrorBox error={error} />
      <div className="flex gap-2">
        <Button onClick={() => send("approved")} className="flex-1">{t("Тасдиқ")}</Button>
        <Button variant="plain" onClick={() => send("rejected")} className="flex-1">{t("Рад")}</Button>
      </div>
    </div>
  );
}

export default function HousingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error } = useApi(`/housing/${id}/`);
  const [item, setItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const current = item?.id === Number(id) ? item : data;

  if (loading && !current) return <Skeleton className="h-96" />;
  if (error || !current) {
    return (
      <EmptyState icon={DoorOpen} title={t("Эълон ёфт нашуд")} text={t("Шояд он аллакай ишғол шуд ё нест карда шуд.")}>
        <BackLink to="/housing">{t("Ба ҳамаи эълонҳо")}</BackLink>
      </EmptyState>
    );
  }

  const kind = kindOf(current.kind);
  const facts = [
    [kind.icon, kind.label],
    current.rooms && [DoorOpen, t("{0} ҳуҷра", current.rooms)],
    current.places && [BedDouble, t("{0} ҷойи холӣ", current.places)],
    [Users, t(current.for_whom_label)],
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/housing">{t("Ба ҳамаи эълонҳо")}</BackLink>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery item={current} />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <HousingStatus item={current} />
              {current.status === "rejected" && current.reject_reason && <span className="text-body-sm text-error">{current.reject_reason}</span>}
            </div>
            <h1 className="font-display text-[26px] font-semibold leading-tight [overflow-wrap:anywhere] md:text-[34px]">{current.title}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{[current.city, current.address].filter(Boolean).join(", ")}</span>
              {current.metro && <span className="inline-flex items-center gap-1.5"><Train className="h-4 w-4" aria-hidden />{current.metro}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {facts.map(([Icon, text]) => (
              <span key={text} className="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-label-md">
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                {text}
              </span>
            ))}
          </div>
          {current.description && <p className="whitespace-pre-line text-body-lg [overflow-wrap:anywhere]">{current.description}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            {FLAGS.map((f) => (
              <div key={f.key} className={`flex items-start gap-3 rounded-xl p-3 ring-1 ring-inset ${current[f.key] ? "bg-tertiary-fixed/60 ring-tertiary-container/40" : "ring-outline-variant opacity-60"}`}>
                <f.icon className={`mt-0.5 h-5 w-5 shrink-0 ${current[f.key] ? "text-tertiary" : "text-outline"}`} aria-hidden />
                <span className="flex flex-col">
                  <span className="text-label-md">{current[f.key] ? f.label : t("Не: {0}", f.label.toLowerCase())}</span>
                  <span className="text-body-sm text-on-surface-variant">{f.text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="card flex flex-col gap-4 p-5">
            <HousingPrice item={current} className="text-[28px]" />
            <span className="text-body-sm text-on-surface-variant">{t("Соҳибхона: {0} · {1}", current.owner_name, date(current.created_at))}</span>
            <ContactButtons shop={current} />
            {current.is_mine && (
              <Button variant="plain" icon={Pencil} onClick={() => setEditing(true)}>{t("Таҳрир")}</Button>
            )}
          </div>
          {user?.role && (user.role === "editor" || user.role === "admin") && current.status !== "approved" && <Moderate item={current} onChange={setItem} />}
          <div className="card flex items-start gap-3 border-l-[3px] border-error p-5">
            <ShieldAlert className="h-5 w-5 shrink-0 text-error" aria-hidden />
            <p className="text-body-sm text-on-surface-variant">{t("То хонаро бо чашми худ надидаед, пул ва гарав надиҳед.")}</p>
          </div>
        </aside>
      </div>
      <HousingForm open={editing} item={current} onClose={() => setEditing(false)} onSaved={setItem} />
    </div>
  );
}
