import { MessagesSquare } from "lucide-react";
import { t } from "../i18n.js";
import FeedbackBanner from "../components/Feedback.jsx";
import { PageHeader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

export default function FeedbackPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Muhojir")} title={t("Фикру мулоҳиза")} text={t("Ба мо гӯед, чӣ хуб аст ва чиро беҳтар кунем.")} icon={MessagesSquare} />
      <Reveal>
        <FeedbackBanner />
      </Reveal>
    </div>
  );
}
