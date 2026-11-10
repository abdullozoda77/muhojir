import { useCallback, useEffect, useRef, useState } from "react";
import { Unlink } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { t } from "../i18n.js";
import { Button } from "./ui.jsx";

const WAIT_MS = 3000;
const WAIT_TRIES = 60;

export function TelegramLogo({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.94 4.3 18.9 18.62c-.23 1.01-.83 1.26-1.68.79l-4.63-3.41-2.23 2.15c-.25.25-.45.45-.93.45l.33-4.71 8.58-7.75c.37-.33-.08-.52-.58-.19L7.16 12.62l-4.57-1.43c-.99-.31-1.01-.99.21-1.47L20.65 2.84c.83-.31 1.55.19 1.29 1.46Z" />
    </svg>
  );
}

async function openTelegram(user) {
  const tab = window.open("", "_blank");
  try {
    let url;
    if (user) {
      const state = await api("/telegram/");
      url = state.connected ? `https://t.me/${state.bot}` : (await api("/telegram/link/", { method: "POST" })).url;
    } else {
      url = (await api("/telegram/bot/")).url;
    }
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch {
    tab?.close();
  }
}

export function TelegramHeaderButton() {
  const { user } = useAuth();
  const [bot, setBot] = useState(null);

  useEffect(() => {
    api("/telegram/bot/").then(setBot).catch(() => setBot(null));
  }, []);

  if (!bot?.configured) return null;
  const label = user ? t("Ёдраскунӣ дар Telegram") : "Telegram";
  return (
    <button
      type="button"
      onClick={() => openTelegram(user)}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#229ED9] transition-colors hover:bg-[#229ED9]/15"
    >
      <TelegramLogo />
    </button>
  );
}

export default function TelegramConnect() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const load = useCallback(() => api("/telegram/").then((data) => {
    setState(data);
    return data;
  }), []);

  useEffect(() => {
    load().catch(() => setState(null));
    return () => clearInterval(timer.current);
  }, [load]);

  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && load().catch(() => {});
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [load]);

  if (!state?.configured) return null;

  const connect = async () => {
    setBusy(true);
    setError("");
    const tab = window.open("", "_blank");
    try {
      const { url } = await api("/telegram/link/", { method: "POST" });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setWaiting(true);
      let tries = 0;
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        tries += 1;
        const data = await load().catch(() => null);
        if (data?.connected || tries >= WAIT_TRIES) {
          clearInterval(timer.current);
          setWaiting(false);
        }
      }, WAIT_MS);
    } catch {
      tab?.close();
      setError(t("Пайваст кардан нашуд. Баъдтар боз кӯшиш кунед."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setState(await api("/telegram/", { method: "PATCH", body: { enabled: !state.enabled } }));
  };

  const disconnect = async () => {
    await api("/telegram/", { method: "DELETE" });
    await load();
  };

  const icon = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]">
      <TelegramLogo />
    </span>
  );

  if (!state.connected) {
    return (
      <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-inset ring-outline-variant">
        <div className="flex items-center gap-4">
          {icon}
          <span className="min-w-0 flex-1">
            <span className="block text-label-lg">{t("Ёдраскунӣ дар Telegram")}</span>
            <span className="text-body-sm text-on-surface-variant">
              {waiting ? t("Дар Telegram «Start»-ро пахш кунед — баъд ин ҷо худаш нав мешавад.") : t("Хабарҳо ва мӯҳлати ҳуҷҷатҳо ба Telegram-и шумо меоянд.")}
            </span>
          </span>
        </div>
        {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
        <Button variant="telegram" icon={TelegramLogo} loading={busy || waiting} onClick={connect} className="self-start">
          {waiting ? t("Интизори Telegram…") : t("Пайваст кардани Telegram")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-inset ring-outline-variant">
      <button type="button" role="switch" aria-checked={state.enabled} onClick={toggle} className="flex w-full items-center gap-4 text-left">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-label-lg">{t("Ёдраскунӣ дар Telegram")}</span>
          <span className="text-body-sm text-on-surface-variant">
            {state.username ? t("Пайваст: @{0}", state.username) : t("Пайваст аст")}
          </span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${state.enabled ? "bg-primary" : "bg-surface-container-highest"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${state.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </span>
      </button>
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3">
        <a
          href={`https://t.me/${state.bot}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-[#229ED9]/10 px-3 text-label-md text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
        >
          <TelegramLogo className="h-4 w-4" />
          {t("Кушодани бот")}
        </a>
        <button
          type="button"
          onClick={disconnect}
          className="ml-auto inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-label-md text-error ring-1 ring-inset ring-error/40 transition-colors hover:bg-error hover:text-on-error hover:ring-error"
        >
          <Unlink className="h-4 w-4" aria-hidden />
          {t("Ҷудо кардан")}
        </button>
      </div>
    </div>
  );
}
