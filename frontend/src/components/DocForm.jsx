import { useEffect, useState } from "react";
import { Camera, Eye, FilePlus2, Save, Trash2 } from "lucide-react";
import { api, fileProblem, openPrivateFile } from "../api.js";
import { t } from "../i18n.js";
import { Button, Drawer, ErrorBox, Field } from "./ui.jsx";

const EMPTY = { document_type: "", region: "", number: "", issued_at: "", expires_at: "", note: "", remind_days_before: 7 };
const REMIND_OPTIONS = [30, 14, 7, 3, 1];

// Pure date math in UTC: local midnight in Moscow (UTC+3) would turn into the previous day in toISOString().
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Add or edit one of the user's documents. doc = null: closed, {}: new, a document: edit it.
export default function DocForm({ doc, types, regions, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null); // a newly chosen file, uploaded on save
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(doc?.id);

  useEffect(() => {
    if (!doc) return;
    setForm(doc.id ? { ...EMPTY, ...doc, region: doc.region ?? "", issued_at: doc.issued_at ?? "" } : { ...EMPTY, ...doc });
    setPhoto(null);
    setErrors({});
    setError(null);
  }, [doc]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // A new registration is usually 90 days and so on: suggest the end date from the issue date when it is empty.
  const type = types.find((x) => String(x.id) === String(form.document_type));
  const suggest = type?.default_validity_days && form.issued_at && !form.expires_at ? addDays(form.issued_at, type.default_validity_days) : null;

  const choosePhoto = (e) => {
    const file = e.target.files[0] || null;
    const problem = fileProblem(file);
    setErrors((x) => ({ ...x, photo: problem }));
    setPhoto(problem ? null : file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    const body = {
      document_type: Number(form.document_type),
      region: form.region ? Number(form.region) : null,
      number: form.number.trim(),
      issued_at: form.issued_at || null,
      expires_at: form.expires_at,
      note: form.note.trim(),
      remind_days_before: Number(form.remind_days_before),
    };
    try {
      const saved = await api(editing ? `/documents/my-documents/${doc.id}/` : "/documents/my-documents/", { method: editing ? "PATCH" : "POST", body });
      if (photo) {
        const data = new FormData();
        data.append("photo", photo);
        await api(`/documents/my-documents/${saved.id}/photo/`, { method: "POST", body: data });
      }
      onSaved();
    } catch (err) {
      if (err.status === 400 && err.data && !err.data.detail) setErrors(err.data);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("Ин ҳуҷҷатро нест кунем?"))) return;
    setBusy(true);
    try {
      await api(`/documents/my-documents/${doc.id}/`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!window.confirm(t("Сурати ҳуҷҷатро нест кунем?"))) return;
    try {
      await api(`/documents/my-documents/${doc.id}/photo/`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Drawer
      open={Boolean(doc)}
      onClose={onClose}
      icon={FilePlus2}
      title={editing ? t("Таҳрири ҳуҷҷат") : t("Ҳуҷҷати нав илова кардан")}
      subtitle={t("Маълумотро аз рӯи худи ҳуҷҷат нависед")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("Намуди ҳуҷҷат")} required error={errors.document_type}>
          <select className="input" required value={form.document_type} onChange={set("document_type")}>
            <option value="">{t("— интихоб кунед —")}</option>
            {types.map((x) => (
              <option key={x.id} value={x.id}>{t(x.title)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("Минтақа (дар куҷо дода шудааст)")} error={errors.region}>
          <select className="input" value={form.region} onChange={set("region")}>
            <option value="">{t("— нишон надодан —")}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("Серия ва рақами ҳуҷҷат")} error={errors.number}>
          <input className="input font-mono" value={form.number} onChange={set("number")} placeholder={t("Масалан: 77 № 1234567")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Санаи додан")} error={errors.issued_at}>
            <input className="input" type="date" value={form.issued_at} onChange={set("issued_at")} />
          </Field>
          <Field label={t("Санаи анҷом")} required error={errors.expires_at}>
            <input className="input" type="date" required value={form.expires_at} onChange={set("expires_at")} />
          </Field>
        </div>
        {suggest && (
          <button type="button" onClick={() => setForm((f) => ({ ...f, expires_at: suggest }))} className="self-start rounded-lg bg-primary/[0.07] px-3 py-1.5 text-label-md text-primary transition-colors hover:bg-primary/[0.12]">
            {t("Одатан {0} рӯз: санаи анҷомро {1} гузорем?", type.default_validity_days, suggest.split("-").reverse().join("."))}
          </button>
        )}

        <div role="radiogroup" aria-label={t("Кай ёдрас кунем?")}>
          <span className="label">{t("Кай ёдрас кунем?")}</span>
          <div className="grid grid-cols-5 gap-2">
            {REMIND_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                role="radio"
                aria-checked={Number(form.remind_days_before) === days}
                onClick={() => setForm((f) => ({ ...f, remind_days_before: days }))}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl text-center text-label-md ${Number(form.remind_days_before) === days ? "bg-ink text-on-ink" : "ring-1 ring-inset ring-outline-variant hover:bg-surface-container"}`}
              >
                <span className="text-label-lg">{days}</span>
                <span className="text-label-sm font-normal">{t("рӯз қабл")}</span>
              </button>
            ))}
          </div>
          <span className="mt-1 block text-body-sm text-on-surface-variant">{t("Ва як бори дигар як рӯз пеш аз анҷом.")}</span>
        </div>

        <div>
          <span className="label">{t("Сурати ҳуҷҷат (нусхаи эҳтиётӣ)")}</span>
          {editing && doc.has_photo && !photo && (
            <div className="mb-2 flex flex-wrap gap-2">
              <Button variant="soft" icon={Eye} onClick={() => openPrivateFile(`/documents/my-documents/${doc.id}/photo/`).catch(setError)}>{t("Дидани сурат")}</Button>
              <Button variant="ghost" icon={Trash2} onClick={removePhoto}>{t("Нест кардан")}</Button>
            </div>
          )}
          <label className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline/50 p-4 text-center transition-colors hover:border-outline hover:bg-surface-container-low">
            <Camera className="mb-1 h-7 w-7 text-primary" aria-hidden />
            <span className="text-label-md">{photo ? photo.name : editing && doc.has_photo ? t("Сурати навро интихоб кунед") : t("Сурати ҳуҷҷатро интихоб кунед")}</span>
            <span className="text-body-sm text-on-surface-variant">{t("JPG, PNG ё PDF, то 10 МБ. Сурат пӯшида нигоҳ дошта мешавад — танҳо шумо мебинед.")}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={choosePhoto} />
          </label>
          {errors.photo && <span className="mt-1 block text-body-sm text-error">{[].concat(errors.photo).join(" ")}</span>}
        </div>

        <Field label={t("Ёддошти шахсӣ")} error={errors.note}>
          <textarea className="input h-auto py-3" rows={3} maxLength={255} value={form.note} onChange={set("note")} placeholder={t("Масалан: чек дар папкаи кабуд")} />
        </Field>
        <ErrorBox error={error} />

        <div className="sticky bottom-0 flex gap-2 bg-background pb-1 pt-3">
          {editing ? (
            <Button variant="danger" icon={Trash2} onClick={remove} disabled={busy} aria-label={t("Нест кардан")} className="px-4" />
          ) : (
            <Button variant="plain" onClick={onClose} className="w-1/3">{t("Бекор кардан")}</Button>
          )}
          <Button type="submit" icon={Save} loading={busy} className="flex-1">{t("Сабт кардан")}</Button>
        </div>
      </form>
    </Drawer>
  );
}
