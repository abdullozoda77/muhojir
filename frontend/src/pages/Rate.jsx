import { Banknote } from "lucide-react";
import { t } from "../i18n.js";
import RubleRate from "../components/RubleRate.jsx";
import { PageHeader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

export default function Rate() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Пул")} title={t("Қурби расмӣ")} text={t("Қурби рубл ба сомонӣ аз Бонки миллии Тоҷикистон ва Банки марказии Русия.")} icon={Banknote} />
      <Reveal>
        <RubleRate />
      </Reveal>
    </div>
  );
}
