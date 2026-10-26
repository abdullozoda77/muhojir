import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { t, useLang } from "../i18n.js";
import { useIsDark } from "../theme.js";

let setup = null;
let handler = () => {};

function loadGoogle() {
  setup ??= Promise.all([
    api("/auth/google/").then((data) => data.client_id),
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }),
  ]).then(([clientId]) => {
    if (clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => handler(response.credential),
        ux_mode: "popup",
      });
    }
    return clientId;
  });
  setup.catch(() => {
    setup = null;
  });
  return setup;
}

export default function GoogleButton({ onCredential, text = "continue_with" }) {
  const box = useRef(null);
  const [shown, setShown] = useState(false);
  const lang = useLang();
  const dark = useIsDark();

  useEffect(() => {
    handler = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let alive = true;
    loadGoogle()
      .then((clientId) => {
        if (!alive || !clientId || !box.current) return;
        box.current.replaceChildren();
        window.google.accounts.id.renderButton(box.current, {
          theme: dark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          locale: "ru",
          width: Math.min(box.current.offsetWidth || 320, 400),
        });
        setShown(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text, dark, lang]);

  return (
    <div className={shown ? "" : "invisible h-0 overflow-hidden"}>
      <div className="flex items-center gap-3 pb-4 text-body-sm text-on-surface-variant">
        <span className="h-px flex-1 bg-outline-variant" />
        {t("ё")}
        <span className="h-px flex-1 bg-outline-variant" />
      </div>
      <div className="flex min-h-[44px] justify-center" ref={box} />
    </div>
  );
}
