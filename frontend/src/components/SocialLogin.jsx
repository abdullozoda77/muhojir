import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { t } from "../i18n.js";

const scripts = {};
let googleSetup = null;
let appleSetup = null;
let googleHandler = () => {};

function loadScript(src) {
  scripts[src] ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      delete scripts[src];
      reject(new Error(src));
    };
    document.head.appendChild(script);
  });
  return scripts[src];
}

function setupGoogle() {
  googleSetup ??= api("/auth/google/").then(async ({ client_id }) => {
    if (!client_id) return false;
    await loadScript("https://accounts.google.com/gsi/client");
    window.google.accounts.id.initialize({ client_id, callback: (response) => googleHandler(response.credential), ux_mode: "popup" });
    return true;
  });
  googleSetup.catch(() => {
    googleSetup = null;
  });
  return googleSetup;
}

function setupApple() {
  appleSetup ??= api("/auth/apple/").then(async ({ client_id }) => {
    if (!client_id) return false;
    await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
    window.AppleID.auth.init({ clientId: client_id, scope: "name email", redirectURI: `${window.location.origin}/login`, usePopup: true });
    return true;
  });
  appleSetup.catch(() => {
    appleSetup = null;
  });
  return appleSetup;
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

function AppleLogo() {
  return (
    <svg viewBox="0 0 384 512" className="h-5 w-5 shrink-0 fill-current" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

const BASE =
  "flex h-12 w-full items-center justify-center gap-3 rounded-xl px-5 text-label-lg transition-all duration-200 group-hover:-translate-y-px group-hover:shadow-[0_10px_24px_-14px_rgba(15,30,80,0.55)] group-active:translate-y-0 group-focus-within:ring-2 group-focus-within:ring-primary";

function GoogleChoice({ onCredential, short }) {
  const wrap = useRef(null);
  const overlay = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    googleHandler = onCredential;
  }, [onCredential]);

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
  }, [short]);

  return (
    <div ref={wrap} className={shown ? "group relative" : "hidden"}>
      <div className={`${BASE} bg-surface-container-lowest text-on-surface ring-1 ring-inset ring-outline-variant group-hover:ring-outline/60`}>
        <GoogleLogo />
        {short ? "Google" : t("Бо Google идома диҳед")}
      </div>
      <div ref={overlay} className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.01]" title={t("Бо Google идома диҳед")} />
    </div>
  );
}

function AppleChoice({ onSignIn, short }) {
  const signIn = async () => {
    try {
      const { authorization, user } = await window.AppleID.auth.signIn();
      const name = [user?.name?.firstName, user?.name?.lastName].filter(Boolean).join(" ");
      onSignIn({ id_token: authorization.id_token, full_name: name });
    } catch (error) {
      if (error?.error !== "popup_closed_by_user" && error?.error !== "user_cancelled_authorize") onSignIn(null);
    }
  };

  return (
    <button type="button" onClick={signIn} className="group block w-full rounded-xl focus:outline-none">
      <span className={`${BASE} bg-black text-white dark:bg-white dark:text-black`}>
        <AppleLogo />
        {short ? "Apple" : t("Бо Apple идома диҳед")}
      </span>
    </button>
  );
}

export default function SocialLogin({ onGoogle, onApple }) {
  const [google, setGoogle] = useState(false);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    let alive = true;
    setupGoogle()
      .then((enabled) => alive && setGoogle(enabled))
      .catch(() => {});
    setupApple()
      .then((enabled) => alive && setApple(enabled))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const both = google && apple;
  return (
    <div className={google || apple ? "space-y-3" : "hidden"}>
      <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-outline-variant" />
        {t("ё")}
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-outline-variant" />
      </div>
      <div className={both ? "grid grid-cols-2 gap-3" : ""}>
        <GoogleChoice onCredential={onGoogle} short={both} />
        {apple && <AppleChoice onSignIn={onApple} short={both} />}
      </div>
    </div>
  );
}
