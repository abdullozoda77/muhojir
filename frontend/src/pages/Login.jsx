import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { t } from "../i18n.js";
import { Button, ErrorBox } from "../components/ui.jsx";
import { Emblem } from "../components/Pattern.jsx";
import { LangSwitch, ThemeToggle } from "../components/Layout.jsx";
import SeasonFall, { season } from "../components/SeasonFall.jsx";
import SocialLogin from "../components/SocialLogin.jsx";

const RESEND_SECONDS = 60;

function PasswordInput({ value, onChange, autoComplete, label, hint }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input className="input pr-12" type={shown ? "text" : "password"} required minLength={8} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t("Паролро пинҳон кардан") : t("Паролро нишон додан")}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-on-surface-variant hover:text-primary"
        >
          {shown ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-body-sm text-on-surface-variant">{hint}</span>}
    </label>
  );
}

const ICONS = { login: LogIn, register: UserPlus, verify: ShieldCheck, forgot: KeyRound, reset: KeyRound };

function CodeBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const setAt = (i, d) => onChange(digits.map((x, j) => (j === i ? d : x)).join(""));

  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted) {
        e.preventDefault();
        onChange(pasted.padEnd(6, " "));
        refs.current[Math.min(pasted.length, 5)]?.focus();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d.trim()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("Рақами {0}", i + 1)}
          className="h-16 w-full max-w-[58px] rounded-2xl border-0 bg-surface-container-low text-center font-display text-[26px] font-semibold text-navy ring-1 ring-inset ring-outline-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary dark:text-on-surface"
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (typed.length > 2) {
              onChange(typed.slice(0, 6).padEnd(6, " "));
              refs.current[Math.min(typed.length, 6) - 1]?.focus();
              return;
            }
            const ch = typed.slice(-1);
            setAt(i, ch || " ");
            if (ch && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

const MAPLE = "M12 1 L13.32 5.4 L15.96 3.64 L15.3 7.6 L20.36 5.84 L18.82 9.36 L22.56 10.9 L18.16 13.32 L19.04 15.96 L14.86 14.64 L12.88 16.84 L12 16.4 L11.12 16.84 L9.14 14.64 L4.96 15.96 L5.84 13.32 L1.44 10.9 L5.18 9.36 L3.64 5.84 L8.7 7.6 L8.04 3.64 L10.68 5.4Z";

function Leaf({ className, color, deep }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d={MAPLE} fill={color} />
      <path d="M12 2.5 L12 22.5 M12 14 L5.5 6.5 M12 14 L18.5 6.5 M12 15 L4.5 11.5 M12 15 L19.5 11.5" stroke={deep} strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CardLeaves() {
  return (
    <div className="pointer-events-none absolute -top-4 left-6 right-6 flex justify-between" aria-hidden>
      <span className="flex items-end">
        <Leaf className="h-8 w-8 -rotate-[28deg] drop-shadow-[0_3px_3px_rgba(120,50,10,0.25)]" color="#e8762a" deep="#9e3f14" />
        <Leaf className="-ml-3 h-6 w-6 rotate-[35deg] drop-shadow-[0_3px_3px_rgba(120,50,10,0.25)]" color="#f4b23c" deep="#b9771a" />
      </span>
      <Leaf className="h-7 w-7 rotate-[18deg] drop-shadow-[0_3px_3px_rgba(120,50,10,0.25)]" color="#cf3f1e" deep="#8a2412" />
    </div>
  );
}

const SKIES = {
  autumn: "from-[#f3e6d4] via-[#f6ecdd] to-[#f1dcc2] dark:from-[#0b0d24] dark:via-[#1a1530] dark:to-[#2b1a22]",
  winter: "from-[#dfe7f3] via-[#eeebe4] to-[#f6f2ea] dark:from-[#030820] dark:via-[#07123a] dark:to-[#0d1d52]",
  none: "from-[#e4edf6] via-[#f2f0ea] to-[#f6f2ea] dark:from-[#050b24] dark:via-[#0a1638] dark:to-[#10204f]",
};

function SeasonScene() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
      <div className={`absolute inset-0 bg-gradient-to-b ${SKIES[season() || "none"]}`} />
      <SeasonFall className="absolute inset-0" />
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  if (user) return <Navigate to={location.state?.from || "/"} replace />;

  const go = (next) => {
    setMode(next);
    setError(null);
    setNote("");
    setCode("");
  };

  const run = (action) => async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
      if (err.status === 429) setWait(RESEND_SECONDS);
    } finally {
      setBusy(false);
    }
  };

  const enter = (data) => {
    login(data);
    navigate(location.state?.from || "/", { replace: true });
  };

  const codeSent = (next) => {
    setCode("");
    setWait(RESEND_SECONDS);
    go(next);
  };

  const signIn = run(async () => {
    try {
      enter(await api("/auth/login/", { method: "POST", body: { email, password } }));
    } catch (err) {
      if (err.status === 403 && err.data?.code === "not_verified") return codeSent("verify");
      throw err;
    }
  });

  const register = run(async () => {
    await api("/auth/register/", { method: "POST", body: { email, password, full_name: fullName.trim() } });
    codeSent("verify");
  });

  const verify = run(async () => {
    enter(await api("/auth/verify-email/", { method: "POST", body: { email, code: code.replace(/\s/g, "") } }));
  });

  const resend = run(async () => {
    await api("/auth/resend-code/", { method: "POST", body: { email } });
    setWait(RESEND_SECONDS);
    setNote(t("Рамзи нав фиристода шуд."));
  });

  const forgot = run(async () => {
    await api("/auth/password/forgot/", { method: "POST", body: { email } });
    setPassword("");
    codeSent("reset");
  });

  const reset = run(async () => {
    enter(await api("/auth/password/reset/", { method: "POST", body: { email, code: code.replace(/\s/g, ""), password } }));
  });

  const google = (credential) =>
    run(async () => {
      try {
        enter(await api("/auth/google/", { method: "POST", body: { credential } }));
      } catch (err) {
        throw err.status === 403 ? err : new Error(t("Бо Google ворид шудан нашуд. Боз кӯшиш кунед."));
      }
    })();

  const Icon = ICONS[mode];
  const codeReady = code.replace(/\s/g, "").length === 6;
  const emailInput = (
    <label className="block">
      <span className="label">{t("Почтаи электронӣ (email)")}</span>
      <input className="input" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ali@gmail.com" />
    </label>
  );
  const linkButton = "min-h-[44px] text-label-md text-primary hover:underline disabled:text-outline disabled:no-underline";

  return (
    <div className="relative isolate grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="flag-line fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 h-[3px]" aria-hidden />
      <SeasonScene />

      <aside className="relative z-10 hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <Link to="/" className="flex items-center gap-2.5 self-start">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm"><img src="/logo.png" alt="" className="h-full w-full" /></span>
          <span className="text-[18px] font-semibold tracking-tight text-navy dark:text-white">Muhojir</span>
        </Link>
        <div className="flex max-w-lg flex-col gap-8">
          <h1 className="text-[48px] font-semibold leading-[1.04] tracking-[-0.035em] text-navy dark:text-white">
            {t("Ҳуҷҷатҳо сари вақт.")}
            <br />
            <span className="bg-gradient-to-r from-primary to-[#5b8def] bg-clip-text text-transparent dark:from-[#9cc0ff] dark:to-[#e3ecff]">{t("Кори боэътимод.")}</span>
          </h1>
          <ul className="flex flex-col gap-3">
            {[t("Ёдраскунӣ пеш аз тамом шудани мӯҳлати ҳуҷҷатҳо"), t("Роҳнамои қадам ба қадам бо забони тоҷикӣ"), t("Ҷойҳои кори воқеӣ бо суроға")].map((line) => (
              <li key={line} className="flex items-center gap-3 text-body-md text-navy/80 dark:text-[#c9d6f2]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/60 ring-1 ring-white/80 backdrop-blur dark:bg-white/10 dark:ring-white/15">
                  <CheckCircle2 className="h-4 w-4 text-primary dark:text-[#9cc0ff]" aria-hidden />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 self-start rounded-full bg-white/50 px-3 py-1.5 text-body-sm text-navy/80 ring-1 ring-white/70 backdrop-blur dark:bg-white/5 dark:text-[#c9d6f2] dark:ring-white/10">
          <Emblem className="h-3 w-[18px]" />
          {t("Бепул. Почтаи шумо бо рамз тасдиқ карда мешавад.")}
        </p>
      </aside>

      <div className="relative z-10 flex flex-col justify-center px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-10">
        <div className="mx-auto w-full max-w-[540px]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-label-md text-navy/80 hover:text-navy dark:text-[#c9d6f2] dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("Ба саҳифаи асосӣ")}
            </Link>
            <div className="flex items-center gap-1.5 rounded-xl bg-white/50 p-1 ring-1 ring-white/70 backdrop-blur dark:bg-white/5 dark:ring-white/10">
              <LangSwitch />
              <ThemeToggle />
            </div>
          </div>
          <Link to="/" className="mb-4 flex items-center justify-center gap-2 lg:hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm"><img src="/logo.png" alt="" className="h-full w-full" /></span>
            <span className="text-[18px] font-semibold tracking-tight text-navy dark:text-white">Muhojir</span>
          </Link>
          <div className="relative rounded-3xl bg-white/75 p-6 shadow-[0_30px_80px_-30px_rgba(30,60,140,0.45)] ring-1 ring-white/80 backdrop-blur-xl sm:p-8 dark:bg-[#0b1533]/70 dark:shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)] dark:ring-white/10">
            {season() === "autumn" && <CardLeaves />}
          <div className="absolute right-6 top-6 sm:right-8 sm:top-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#5b8def] text-white shadow-lg shadow-primary/30">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          </div>

          {mode === "login" && (
            <form onSubmit={signIn} className="space-y-4">
              <div className="pr-14">
                <h2 className="text-[26px] font-semibold leading-tight tracking-tight">{t("Ворид шудан")}</h2>
                <p className="mt-1 text-body-md text-on-surface-variant">{t("Почтаи электронӣ ва пароли худро нависед.")}</p>
              </div>
              {emailInput}
              <PasswordInput label={t("Парол")} value={password} onChange={setPassword} autoComplete="current-password" />
              <ErrorBox error={error} />
              <Button type="submit" loading={busy} className="w-full">{t("Ворид шудан")}</Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => go("forgot")} className={linkButton}>{t("Паролро фаромӯш кардед?")}</button>
                <button type="button" onClick={() => go("register")} className={linkButton}>{t("Ҳисоб надоред? Сабти ном")}</button>
              </div>
              <SocialLogin onGoogle={google} />
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={register} className="space-y-4">
              <div className="pr-14">
                <h2 className="text-[26px] font-semibold leading-tight tracking-tight">{t("Сабти ном")}</h2>
                <p className="mt-1 text-body-md text-on-surface-variant">{t("Парол созед. Баъд ба почтаи шумо рамзи 6-рақама меояд, то онро тасдиқ кунед.")}</p>
              </div>
              <label className="block">
                <span className="label">{t("Ному насаб")}</span>
                <input className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("Масалан: Алӣ Каримов")} />
              </label>
              {emailInput}
              <PasswordInput label={t("Парол созед")} value={password} onChange={setPassword} autoComplete="new-password" hint={t("Ҳадди ақал 8 аломат: ҳарфҳо ва рақамҳо. Танҳо рақам ё пароли осон қабул намешавад.")} />
              <ErrorBox error={error} />
              <Button type="submit" loading={busy} className="w-full">{t("Сабти ном ва гирифтани рамз")}</Button>
              <button type="button" onClick={() => go("login")} className={linkButton}>{t("Ҳисоб доред? Ворид шавед")}</button>
              <SocialLogin onGoogle={google} />
            </form>
          )}

          {(mode === "verify" || mode === "reset") && (
            <form onSubmit={mode === "verify" ? verify : reset} className="space-y-4">
              <div className="pr-14">
                <h2 className="text-[26px] font-semibold leading-tight tracking-tight">{mode === "verify" ? t("Почтаро тасдиқ кунед") : t("Пароли нав")}</h2>
                <p className="mt-1 text-body-md text-on-surface-variant">
                  {t("Рамзро ба {0} фиристодем. Агар набошад, папкаи «Спам»-ро бинед.", email)}
                </p>
              </div>
              <CodeBoxes value={code} onChange={setCode} disabled={busy} />
              {mode === "reset" && (
                <PasswordInput label={t("Пароли нав")} value={password} onChange={setPassword} autoComplete="new-password" hint={t("Ҳадди ақал 8 аломат: ҳарфҳо ва рақамҳо. Танҳо рақам ё пароли осон қабул намешавад.")} />
              )}
              <ErrorBox error={error} />
              {note && <p role="status" className="rounded-2xl bg-tertiary-fixed p-3 text-label-md text-on-tertiary-fixed">{note}</p>}
              <Button type="submit" loading={busy} disabled={!codeReady || (mode === "reset" && password.length < 8)} className="w-full">
                {mode === "verify" ? t("Тасдиқ кардан") : t("Паролро иваз кардан")}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => go(mode === "verify" ? "register" : "forgot")} className="min-h-[44px] text-label-md text-on-surface-variant hover:text-primary">
                  {t("Email-ро иваз кардан")}
                </button>
                <button type="button" onClick={mode === "verify" ? resend : forgot} disabled={wait > 0 || busy} className={linkButton}>
                  {wait > 0 ? t("Рамзи нав баъд аз {0} сония", wait) : t("Рамзи нав фиристед")}
                </button>
              </div>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={forgot} className="space-y-4">
              <div className="pr-14">
                <h2 className="text-[26px] font-semibold leading-tight tracking-tight">{t("Барқарор кардани парол")}</h2>
                <p className="mt-1 text-body-md text-on-surface-variant">{t("Почтаи худро нависед. Мо рамз мефиристем ва шумо пароли нав мегузоред.")}</p>
              </div>
              {emailInput}
              <ErrorBox error={error} />
              <Button type="submit" loading={busy} disabled={wait > 0} className="w-full">
                {wait > 0 ? t("Баъд аз {0} сония", wait) : t("Рамз гирифтан")}
              </Button>
              <button type="button" onClick={() => go("login")} className={linkButton}>{t("Бозгашт ба воридшавӣ")}</button>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
