import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { BellRing, X } from "lucide-react";
import { t } from "../i18n.js";

// A new notification that just arrived over the WebSocket: slides in at the corner, goes away by itself.
const SHOW_SECONDS = 7;

export default function LiveToast({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(onClose, SHOW_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [notification, onClose]);

  return (
    <div className="pointer-events-none fixed bottom-24 left-4 right-4 z-[70] flex justify-end lg:bottom-6 lg:left-auto lg:right-6" aria-live="polite">
      <AnimatePresence>
        {notification && (
          <m.div
            key={notification.id}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-2xl ring-1 ring-outline-variant/40"
            role="status"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
              <BellRing className="h-5 w-5" aria-hidden />
            </span>
            <Link to="/notifications" onClick={onClose} className="min-w-0 flex-1">
              <span className="block text-label-lg">{notification.title}</span>
              <span className="line-clamp-2 text-body-sm text-on-surface-variant">{notification.message}</span>
            </Link>
            <button type="button" onClick={onClose} aria-label={t("Пӯшидан")} className="-m-1 rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
