import { useState } from "react";
import { BellRing, Send } from "lucide-react";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { isIOS, usePush } from "../pwa.js";

export default function PushToggle() {
  const push = usePush(api);
  const [tested, setTested] = useState(false);

  const hint = !push.supported
    ? isIOS()
      ? t("Дар iPhone аввал сайтро ба экрани асосӣ илова кунед (Share → «На экран Домой»), баъд аз он ҷо кушоед.")
      : t("Ин браузер огоҳиҳоро дастгирӣ намекунад.")
    : push.denied
      ? t("Иҷозат баста аст. Дар танзимоти браузер барои ин сайт «Уведомления»-ро иҷозат диҳед.")
      : push.enabled
        ? t("Кори нав ва мӯҳлати ҳуҷҷатҳо ҳатто вақте сайт баста аст меояд.")
        : t("Огоҳӣ ба ҳамин телефон ё компютер меояд, ҳатто вақте сайт баста аст.");

  const toggle = () => (push.enabled ? push.disable() : push.enable());
  const test = async () => {
    await push.test().catch(() => {});
    setTested(true);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-inset ring-outline-variant">
      <button
        type="button"
        role="switch"
        aria-checked={push.enabled}
        disabled={!push.supported || push.denied || push.busy}
        onClick={toggle}
        className="flex w-full items-center gap-4 text-left disabled:cursor-not-allowed"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
          <BellRing className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-label-lg">{t("Огоҳӣ дар телефон")}</span>
          <span className="text-body-sm text-on-surface-variant">{hint}</span>
        </span>
        {push.supported && !push.denied && (
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${push.enabled ? "bg-primary" : "bg-surface-container-highest"} ${push.busy ? "opacity-60" : ""}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${push.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        )}
      </button>
      {push.enabled && (
        <div className="mt-1 flex items-center gap-2 border-t border-outline-variant pt-3">
          <button type="button" onClick={test} className="inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-primary-fixed px-3 text-label-md text-on-primary-fixed transition-colors hover:bg-primary-fixed/70">
            <Send className="h-4 w-4" aria-hidden />
            {t("Санҷиш")}
          </button>
          {tested && <span role="status" className="text-body-sm text-on-surface-variant">{t("Фиристода шуд — бояд ҳозир ояд.")}</span>}
        </div>
      )}
    </div>
  );
}
