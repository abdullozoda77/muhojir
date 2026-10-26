import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { Loader2, Send, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { lang, t } from "../i18n.js";

const STORE = "muhojir-assistant";
const SUGGESTIONS = [
  () => t("Нархи патент дар Маскав чанд аст?"),
  () => t("Кори курьерро дар Маскав нишон деҳ"),
  () => t("Чиптаи Душанбе – Маскавро нишон деҳ"),
  () => t("Масҷидҳоро дар Маскав нишон деҳ"),
];

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE)) || [];
  } catch {
    return [];
  }
}

function Message({ text }) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
    );
    return line.trim().startsWith("- ") ? (
      <span key={i} className="block pl-3">• {parts.map((p) => (typeof p === "string" ? p.replace(/^\s*-\s/, "") : p))}</span>
    ) : (
      <span key={i} className="block min-h-[0.5em]">{parts}</span>
    );
  });
}

function AssistantMark({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 3.2c4.97 0 9 3.36 9 7.5s-4.03 7.5-9 7.5c-.86 0-1.69-.1-2.48-.29L5.2 20.4c-.5.27-1.08-.2-.92-.74l.98-3.27C3.85 15.08 3 13.2 3 10.7c0-4.14 4.03-7.5 9-7.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 6.6c.33 1.86 1.04 2.57 2.9 2.9-1.86.33-2.57 1.04-2.9 2.9-.33-1.86-1.04-2.57-2.9-2.9 1.86-.33 2.57-1.04 2.9-2.9Z" fill="currentColor" />
      <circle cx="16.2" cy="13.3" r="1" fill="currentColor" opacity=".75" />
    </svg>
  );
}

export default function Assistant() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [messages, setMessages] = useState(load);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || enabled !== null) return;
    api("/assistant/").then((d) => setEnabled(d.enabled)).catch(() => setEnabled(false));
  }, [open, enabled]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30)));
    } catch {
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (question) => {
    const content = (question ?? text).trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setText("");
    setError("");
    setBusy(true);
    try {
      const data = await api("/assistant/", { method: "POST", body: { messages: history, page: pathname + search } });
      const reply = data.reply || (data.refused ? t("Бубахшед, ба ин савол ҷавоб дода наметавонам.") : t("Ҷавоб нашуд. Боз пурсед."));
      setMessages([...history, { role: "assistant", content: reply }]);
      if (data.navigate) navigate(data.navigate);
    } catch (err) {
      setError(err.status === 429 ? t("Саволҳо зиёд шуданд. Баъд аз чанд дақиқа боз пурсед.") : err.message);
      setMessages(history.slice(0, -1));
      setText(content);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("Пӯшидани ёрдамчӣ") : t("Ёрдамчии AI")}
        aria-expanded={open}
        className="group fixed bottom-24 right-4 z-[65] overflow-hidden rounded-full p-[2px] shadow-[0_14px_34px_-12px_rgb(29_78_216/0.75)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.97] lg:bottom-6 lg:right-6"
      >
        <span aria-hidden className="assistant-edge absolute inset-[-150%] bg-[conic-gradient(from_0deg,#cc1a22_0deg,#cc1a22_100deg,#ffffff_120deg,#ffffff_220deg,#167a32_240deg,#167a32_340deg,#cc1a22_360deg)]" />
        <span className="relative flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#172f73] to-[#1d4ed8] text-white sm:px-4">
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={open ? "close" : "open"}
              initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              {open ? <X className="h-5 w-5" aria-hidden /> : <AssistantMark className="h-6 w-6 transition-transform duration-500 group-hover:scale-110" />}
            </m.span>
          </AnimatePresence>
          <span className="hidden text-label-md sm:inline">{open ? t("Пӯшидан") : t("Ёрдамчии AI")}</span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <m.section
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="fixed bottom-40 left-4 right-4 z-[65] flex max-h-[min(70vh,620px)] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl ring-1 ring-outline-variant sm:left-auto sm:w-[400px] lg:bottom-24 lg:right-6"
            aria-label={t("Ёрдамчии AI")}
          >
            <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#172f73] to-[#1d4ed8] text-white">
                <AssistantMark className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-label-lg">{t("Ёрдамчии Muhojir")}</span>
                <span className="text-body-sm text-on-surface-variant">{t("Мепурсад, ҷавоб медиҳад ва саҳифаҳоро мекушояд")}</span>
              </span>
              {messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} aria-label={t("Тоза кардани гуфтугӯ")} className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </header>

            <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
              {enabled === false ? (
                <p className="rounded-2xl bg-surface-container-low p-3 text-body-md text-on-surface-variant">{t("Ёрдамчии AI ҳоло танзим нашудааст.")}</p>
              ) : messages.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body-md text-on-surface-variant">{t("Салом! Ман дар бораи ҳуҷҷатҳо, патент ва кор ёрӣ медиҳам ва саҳифаи лозимиро мекушоям. Масалан:")}</p>
                  {SUGGESTIONS.map((s) => (
                    <button key={s()} type="button" onClick={() => send(s())} className="rounded-xl px-3 py-2 text-left text-body-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
                      {s()}
                    </button>
                  ))}
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body-md ${msg.role === "user" ? "self-end bg-ink text-on-ink" : "self-start bg-surface-container-low"}`}>
                    {msg.role === "user" ? msg.content : <Message text={msg.content} />}
                  </div>
                ))
              )}
              {busy && (
                <span className="flex items-center gap-2 self-start text-body-sm text-on-surface-variant">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("Фикр мекунам…")}
                </span>
              )}
              {error && <p role="alert" className="rounded-xl bg-error-container p-3 text-body-sm text-on-error-container">{error}</p>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-surface-container p-3"
            >
              <input
                className="input flex-1"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                placeholder={t("Саволи худро нависед…")}
                disabled={enabled === false}
                lang={lang === "ru" ? "ru" : "tg"}
              />
              <button type="submit" disabled={!text.trim() || busy || enabled === false} aria-label={t("Фиристодан")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink transition-colors hover:bg-ink/90 disabled:opacity-40">
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </form>
          </m.section>
        )}
      </AnimatePresence>
    </>
  );
}
