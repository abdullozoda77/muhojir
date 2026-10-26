import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { t } from "../i18n.js";

let setup = null;
let handler = () => {};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function setupGoogle() {
  setup ??= api("/auth/google/").then(async ({ client_id }) => {
    if (!client_id) return false;
    await loadScript("https://accounts.google.com/gsi/client");
    window.google.accounts.id.initialize({ client_id, callback: (response) => handler(response.credential), ux_mode: "popup" });
    return true;
  });
  setup.catch(() => {
    setup = null;
  });
  return setup;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function SocialLogin({ onGoogle }) {
  const wrap = useRef(null);
  const overlay = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    handler = onGoogle;
  }, [onGoogle]);

  useEffect(() => {
    let alive = true;
    setupGoogle()
      .then((enabled) => {
        if (!alive || !enabled || !overlay.current) return;
        setShown(true);
        overlay.current.replaceChildren();
        window.google.accounts.id.renderButton(overlay.current, {
          type: "standard",
          size: "large",
          width: Math.min(wrap.current?.offsetWidth || 360, 400),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={shown ? "space-y-3" : "invisible h-0 overflow-hidden"}>
      <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-outline-variant" />
        {t("ё")}
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-outline-variant" />
      </div>
      <div ref={wrap} className="group relative">
        <div className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-surface-container-lowest px-5 text-label-lg text-on-surface ring-1 ring-inset ring-outline-variant transition-all duration-200 group-hover:-translate-y-px group-hover:shadow-[0_10px_24px_-14px_rgba(15,30,80,0.55)] group-hover:ring-outline/60 group-focus-within:ring-2 group-focus-within:ring-primary">
          <GoogleLogo />
          {t("Бо Google идома диҳед")}
        </div>
        <div ref={overlay} className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.01]" title={t("Бо Google идома диҳед")} />
      </div>
    </div>
  );
}
