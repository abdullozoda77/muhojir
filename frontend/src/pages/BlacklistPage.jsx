import { useState } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { BlacklistCompany } from "../components/Blacklist.jsx";
import { BackLink, Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

export default function BlacklistPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(20);
  const { data, error, loading, reload } = useApi(`/jobs/blacklist/?page_size=${size}&reports=20${query ? `&search=${encodeURIComponent(query)}` : ""}`);

  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/jobs">{t("Ҷойи кор")}</BackLink>
      <PageHeader icon={ShieldAlert} eyebrow={t("Барои ҳама кушода")} title={t("Рӯйхати сиёҳи корфармоён")} text={t("Корфармоёне, ки коргарон аз онҳо шикоят кардаанд, бо сабабҳояшон. Пеш аз сафар ширкатро дар ин ҷо санҷед.")} />

      <form onSubmit={(e) => (e.preventDefault(), setQuery(search.trim()))} className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <input className="input pl-12" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Номи ширкат ё ИНН")} aria-label={t("Номи ширкат ё ИНН")} />
        </label>
        <Button type="submit">{t("Ҷустуҷӯ")}</Button>
      </form>

      <ErrorBox error={error} />
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : data?.results?.length ? (
        <>
          <p className="text-body-sm text-on-surface-variant">{t("Ҳамагӣ: {0}", data.count)}</p>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {data.results.map((e) => <BlacklistCompany key={e.id} e={e} onChange={reload} />)}
          </div>
          {data.next && (
            <Button variant="plain" onClick={() => setSize(size + 20)} loading={loading} className="self-center">
              {t("Боз нишон додан")}
            </Button>
          )}
        </>
      ) : (
        <EmptyState icon={ShieldAlert} title={query ? t("Ёфт нашуд") : t("Ҳоло дар рӯйхати сиёҳ ширкат нест.")} />
      )}
    </div>
  );
}
