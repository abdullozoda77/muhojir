import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, LogOut, Mail, PenSquare, Save, UserRound } from "lucide-react";
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
      <PageHeader title={t("Профил ва танзимот")} icon={UserRound} />
      {/* Who is signed in: the initial, name and email. */}
      <div className="card flex items-center gap-4 p-5 md:p-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[22px] font-semibold ring-1 ring-outline-variant">
          {(user.full_name || user.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {user.full_name && <span className="block truncate text-[19px] font-semibold leading-tight">{user.full_name}</span>}
          <span className="flex min-w-0 items-center gap-1.5 text-body-md text-on-surface-variant">
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{user.email}</span>
          </span>
          <span className="mt-0.5 block text-[12px] text-on-surface-variant/80">{t("Почтаи электронӣ (барои воридшавӣ)")}</span>
        </div>
        {user.role !== "migrant" && (
          <span className="shrink-0 rounded-md bg-surface-container-high px-2 py-1 text-label-sm">{ROLE_NAMES[user.role]?.() || user.role}</span>
        )}
      </div>
      <form onSubmit={submit} className="card flex flex-col gap-4 p-6 md:p-8">
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
        <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl p-4 ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
          <input type="checkbox" className="h-5 w-5 rounded text-primary focus:ring-primary" checked={form.email_reminders} onChange={(e) => set("email_reminders", e.target.checked)} />
          <span>
            <span className="block text-label-lg">{t("Ёдраскунӣ ба почтаи электронӣ")}</span>
            <span className="text-body-sm text-on-surface-variant">{t("Пеш аз тамом шудани мӯҳлати ҳуҷҷатҳо")}</span>
          </span>
        </label>
        <ErrorBox error={error} />
        {saved && <p role="status" className="rounded-xl bg-tertiary-fixed p-4 text-label-md text-on-tertiary-fixed">{t("Сабт шуд")}</p>}
        <Button type="submit" icon={Save} loading={busy}>{t("Сабт кардан")}</Button>
      </form>
      {(user.role === "editor" || user.role === "admin") && (
        <a href="/admin/" className="card group flex items-center gap-4 p-5 transition-colors hover:ring-outline/50 md:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
            <PenSquare className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[17px] font-semibold">{t("Идораи мундариҷа")}</span>
            <span className="text-body-sm text-on-surface-variant">
              {user.role === "editor" ? t("Хабарҳо, роҳнамоҳо, саволҳои имтиҳон, сайтҳои ёрӣ, марказҳо ва нархҳои патент.") : t("Ҳамаи қисмҳои сайт, корбарон ва нақшҳо.")}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1" aria-hidden />
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
