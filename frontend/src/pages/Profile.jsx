import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Mail, PenSquare, Save } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { lang, setLang, t } from "../i18n.js";
import PhoneApp from "../components/PhoneApp.jsx";
import { Button, ErrorBox, Field, PageHeader } from "../components/ui.jsx";

const ROLE_NAMES = { editor: () => t("Муҳаррир"), admin: () => t("Админ") };

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ full_name: user.full_name || "", phone: user.phone || "", city: user.city || "", language: user.language, email_reminders: user.email_reminders });
  }, [user]);

  if (!form) return null;
  const set = (key, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const data = await api("/auth/profile/", { method: "PATCH", body: { ...form, phone: form.phone.trim() || null } });
      setUser(data);
      setSaved(true);
      if (data.language !== lang) setLang(data.language);
    } catch (err) {
      if (err.status === 400 && err.data && !err.data.detail) setErrors(err.data);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("Профил ва танзимот")} />
      <form onSubmit={submit} className="card flex flex-col gap-4 p-4 md:p-8">
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-4">
          <Mail className="h-5 w-5 text-primary" aria-hidden />
          <div className="flex-1">
            <span className="block text-body-sm text-on-surface-variant">{t("Почтаи электронӣ (барои воридшавӣ)")}</span>
            <span className="text-label-lg">{user.email}</span>
          </div>
          {user.role !== "migrant" && (
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-md text-on-primary-fixed">{ROLE_NAMES[user.role]?.() || user.role}</span>
          )}
        </div>
        <Field label={t("Ному насаб")} error={errors.full_name}>
          <input className="input" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Телефон (ихтиёрӣ)")} error={errors.phone} hint={t("Ба касе нишон дода намешавад")}>
            <input className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 999 123-45-67" autoComplete="tel" />
          </Field>
          <Field label={t("Шаҳр дар Русия")} error={errors.city}>
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Масалан: Москва")} />
          </Field>
        </div>
        <Field label={t("Забон")} error={errors.language}>
          <select className="input" value={form.language} onChange={(e) => set("language", e.target.value)}>
            <option value="tg">Тоҷикӣ</option>
            <option value="ru">Русский</option>
          </select>
        </Field>
        <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl bg-surface-container-low p-4">
          <input type="checkbox" className="h-5 w-5 rounded text-primary focus:ring-primary" checked={form.email_reminders} onChange={(e) => set("email_reminders", e.target.checked)} />
          <span>
            <span className="block text-label-lg">{t("Ёдраскунӣ ба почтаи электронӣ")}</span>
            <span className="text-body-sm text-on-surface-variant">{t("Пеш аз тамом шудани мӯҳлати ҳуҷҷатҳо")}</span>
          </span>
        </label>
        <ErrorBox error={error} />
        {saved && <p role="status" className="rounded-xl bg-tertiary-fixed p-3 text-label-md text-on-tertiary-fixed">{t("Сабт шуд")}</p>}
        <Button type="submit" icon={Save} loading={busy}>{t("Сабт кардан")}</Button>
      </form>
      {(user.role === "editor" || user.role === "admin") && (
        <a href="/admin/" className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-md md:p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <PenSquare className="h-6 w-6" aria-hidden />
          </span>
          <span>
            <span className="block text-label-lg">{t("Идораи мундариҷа")}</span>
            <span className="text-body-sm text-on-surface-variant">
              {user.role === "editor" ? t("Хабарҳо, роҳнамоҳо, саволҳои имтиҳон, сайтҳои ёрӣ, марказҳо ва нархҳои патент.") : t("Ҳамаи қисмҳои сайт, корбарон ва нақшҳо.")}
            </span>
          </span>
        </a>
      )}
      <PhoneApp />
      <Button
        variant="plain"
        icon={LogOut}
        onClick={async () => {
          await logout();
          navigate("/");
        }}
        className="text-error"
      >
        {t("Баромадан")}
      </Button>
    </div>
  );
}
