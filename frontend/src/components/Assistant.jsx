import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { Bot, Loader2, Mic, MicOff, Send, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { lang, t } from "../i18n.js";

// The AI assistant: a chat in the corner. It answers about migration and the site, and when you ask it
// to open something ("кори курьер дар Маскав нишон деҳ") the server says which page, and we open it.
// The conversation stays while the tab is open (sessionStorage), so it continues after changing pages.
const STORE = "muhojir-assistant";
const SUGGESTIONS = [
  () => t("Нархи патент дар Маскав чанд аст?"),
  () => t("Кори курьерро дар Маскав нишон деҳ"),
  () => t("Чиптаи Душанбе – Маскавро нишон деҳ"),
  () => t("Масҷидҳоро дар Маскав нишон деҳ"),
];

const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE)) || [];
  } catch {
    return [];
  }
}

// **bold** and "- " lists from the model, drawn safely (no HTML from the answer is used).
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

export default function Assistant() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [messages, setMessages] = useState(load);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);
  const recognition = useRef(null);

  useEffect(() => {
    if (!open || enabled !== null) return;
    api("/assistant/").then((d) => setEnabled(d.enabled)).catch(() => setEnabled(false));
  }, [open, enabled]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30)));
    } catch {
      // private mode: the chat is simply not kept between pages
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

  const listen = () => {
    if (!Recognition) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Recognition();
    rec.lang = "ru-RU"; // browsers do not recognise Tajik speech; Russian works everywhere
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("Пӯшидани ёрдамчӣ") : t("Ёрдамчии AI")}
        className="fixed bottom-24 right-4 z-[65] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <Sparkles className="h-6 w-6" aria-hidden />}
      </button>

      <AnimatePresence>
        {open && (
          <m.section
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="fixed bottom-40 left-4 right-4 z-[65] flex max-h-[min(70vh,620px)] flex-col overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl ring-1 ring-outline-variant/40 sm:left-auto sm:w-[400px] lg:bottom-24 lg:right-6"
            aria-label={t("Ёрдамчии AI")}
          >
            <header className="flex items-center gap-3 bg-banner px-4 py-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Bot className="h-5 w-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-label-lg">{t("Ёрдамчии Muhojir")}</span>
                <span className="text-body-sm text-on-navy">{t("Мепурсад, ҷавоб медиҳад ва саҳифаҳоро мекушояд")}</span>
              </span>
              {messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} aria-label={t("Тоза кардани гуфтугӯ")} className="rounded-full p-2 hover:bg-white/10">
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
                    <button key={s()} type="button" onClick={() => send(s())} className="rounded-xl bg-surface-container-low px-3 py-2 text-left text-body-md text-primary hover:bg-surface-container">
                      {s()}
                    </button>
                  ))}
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body-md ${msg.role === "user" ? "self-end bg-primary text-on-primary" : "self-start bg-surface-container-low"}`}>
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
                placeholder={listening ? t("Гӯш мекунам…") : t("Саволи худро нависед…")}
                disabled={enabled === false}
                lang={lang === "ru" ? "ru" : "tg"}
              />
              {Recognition && (
                <button type="button" onClick={listen} disabled={enabled === false || busy} aria-label={listening ? t("Бас кардан") : t("Бо овоз гуфтан")} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${listening ? "bg-secondary text-on-secondary" : "bg-surface-container-low text-primary"} disabled:opacity-50`}>
                  {listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
                </button>
              )}
              <button type="submit" disabled={!text.trim() || busy || enabled === false} aria-label={t("Фиристодан")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary disabled:opacity-50">
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </form>
          </m.section>
        )}
      </AnimatePresence>
    </>
  );
}
