import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, Ban, Clock, ExternalLink, MapPin, Package, Pencil, Search, Store, Truck } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { shopCategory } from "../constants.js";
import { canEdit } from "../components/Layout.jsx";
import { ContactButtons, PROOF_KINDS, ProductCard, ProofThumb, ShopLogo, ShopStatus } from "../components/Shop.jsx";
import { StarPicker, Stars } from "../components/Stars.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import { BackLink, Button, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";

function Moderate({ shop, onDone }) {
  const { data: proofs } = useApi(`/market/shops/${shop.id}/proofs/`);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const send = async (status) => {
    setBusy(status);
    setError(null);
    try {
      await api(`/market/shops/${shop.id}/moderate/`, { method: "POST", body: { status, reason: reason.trim() } });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="card flex flex-col gap-3 border-l-[3px] border-warning-container p-5">
      <span className="text-[16px] font-semibold">{t("Санҷиши муҳаррир")}</span>
      <p className="text-body-sm text-on-surface-variant">{t("Аксҳоро кушоед ва бинед, ки мағоза воқеӣ аст. Агар шубҳа бошад, ба телефони соҳиб занг занед.")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {PROOF_KINDS.map((kind) => {
          const mine = (proofs || []).filter((p) => p.kind === kind.value);
          return (
            <div key={kind.value} className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
              <span className="text-label-md">{kind.label}</span>
              {mine.length ? (
                <div className="flex flex-wrap gap-2">{mine.map((p) => <ProofThumb key={p.id} shopId={shop.id} proof={p} />)}</div>
              ) : (
                <span className="text-body-sm text-on-surface-variant">{kind.required ? t("Нест — тасдиқ накунед") : t("Нест")}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
        <span className="text-label-md">{t("Ҷойгиршавии мағоза")}</span>
        {shop.lat != null ? (
          <LocationPicker value={{ lat: shop.lat, lon: shop.lon }} readOnly className="h-56" />
        ) : (
          <span className="text-body-sm text-on-surface-variant">{t("Нест — тасдиқ накунед")}</span>
        )}
      </div>
      <textarea className="input h-20 py-3" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder={t("Сабаби рад (агар рад кунед)")} />
      <ErrorBox error={error} />
      <div className="flex flex-wrap gap-2">
        <Button icon={BadgeCheck} loading={busy === "approved"} onClick={() => send("approved")} disabled={shop.status === "approved"}>{t("Тасдиқ кардан")}</Button>
        <Button variant="danger" icon={Ban} loading={busy === "rejected"} onClick={() => send("rejected")} disabled={!reason.trim()}>{t("Рад кардан")}</Button>
      </div>
    </div>
  );
}

function Reviews({ shop, onChange }) {
  const { user } = useAuth();
  const { data: reviews, reload } = useApi(`/market/shops/${shop.id}/reviews/?page_size=50`);
  const [rating, setRating] = useState(shop.my_review?.rating || 0);
  const [text, setText] = useState(shop.my_review?.text || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/market/shops/${shop.id}/reviews/mine/`, { method: "PUT", body: { rating, text: text.trim() } });
      reload();
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Stars value={shop.rating || 0} size="h-5 w-5" />
        <span className="text-[17px] font-semibold">{shop.rating ? `${shop.rating} · ${t("{0} шарҳ", shop.reviews_count)}` : t("Ҳоло баҳо нест")}</span>
      </div>
      {shop.status === "approved" && !shop.is_mine && (user ? (
        <div className="card flex flex-col gap-3 p-5">
          <span className="text-[16px] font-semibold">{shop.my_review ? t("Шарҳи шумо") : t("Баҳо диҳед")}</span>
          <StarPicker value={rating} onChange={setRating} />
          <textarea className="input h-24 py-3" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("Мол, нарх ва муомила чӣ хел буд? (ихтиёрӣ)")} />
          <ErrorBox error={error} />
          <Button onClick={save} loading={busy} disabled={!rating} className="self-start">{t("Сабт кардан")}</Button>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">{t("Барои баҳо додан ворид шавед.")}</p>
      ))}
      <div className="grid gap-3 md:grid-cols-2">
        {(reviews?.results || []).map((r) => (
          <div key={r.id} className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-4">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">{r.author_name}{r.is_mine && ` (${t("шумо")})`}</span>
              <span className="text-label-sm text-on-surface-variant">{ago(r.created_at)}</span>
            </span>
            <Stars value={r.rating} />
            {r.text && <p className="text-body-sm">{r.text}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Products({ shop }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data, loading } = useApi(`/market/shops/${shop.id}/products/?page_size=100${query ? `&search=${encodeURIComponent(query)}` : ""}`);
  const products = data?.results || [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <h2 className="text-[22px] font-semibold">{t("Молҳо ва нархҳо")}</h2>
        {(shop.products_count > 6 || query) && (
          <label className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-container-lowest px-3 ring-1 ring-outline-variant focus-within:ring-2 focus-within:ring-primary/40 md:w-72">
            <Search className="h-4 w-4 text-on-surface-variant" aria-hidden />
            <input type="search" className="w-full border-0 bg-transparent p-0 text-body-md focus:ring-0" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Ҷустуҷӯ дар мағоза")} />
          </label>
        )}
      </div>
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-60" />)}</div>
      ) : products.length === 0 ? (
        <EmptyState icon={Package} title={query ? t("Мол ёфт нашуд") : t("Ҳоло мол илова нашудааст")} text={t("Ба фурӯшанда занг занед ё нависед — мепурсед, чӣ ҳаст.")} />
      ) : (
        <Stagger key={query} className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <StaggerItem key={p.id} className="flex min-w-0">
              <ProductCard product={p} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}

export default function ShopPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: shop, error, reload } = useApi(`/market/shops/${id}/`);

  if (error) {
    return (
      <div className="flex flex-col gap-6 pt-6">
        <BackLink to="/shops">{t("Ҳамаи мағозаҳо")}</BackLink>
        <EmptyState icon={Store} title={t("Мағоза ёфт нашуд")} text={t("Шояд он ҳоло санҷида нашудааст ё нест карда шуд.")} />
      </div>
    );
  }
  if (!shop) return <Skeleton className="mt-8 h-80" />;

  const category = shopCategory(shop.category);
  const where = [shop.city, shop.address].filter(Boolean).join(", ");
  const map = shop.lat != null ? `https://yandex.ru/maps/?pt=${shop.lon},${shop.lat}&z=16&l=map` : `https://yandex.ru/maps/?text=${encodeURIComponent(where)}`;

  return (
    <div className="flex flex-col gap-8 pt-2 md:pt-6">
      <BackLink to="/shops">{t("Ҳамаи мағозаҳо")}</BackLink>

      <section className="card flex flex-col gap-5 p-5 md:flex-row md:items-start md:p-7">
        <ShopLogo shop={shop} className="h-20 w-20 md:h-28 md:w-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold leading-tight md:text-[32px]">{shop.name}</h1>
            {shop.status !== "approved" && <ShopStatus status={shop.status} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-label-sm text-primary">
              <category.icon className="h-3.5 w-3.5" aria-hidden />
              {category.label}
            </span>
            {shop.delivery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-label-sm text-on-tertiary-fixed">
                <Truck className="h-3.5 w-3.5" aria-hidden />
                {t("Расонидан ҳаст")}
              </span>
            )}
          </div>
          {shop.description && <p className="whitespace-pre-line text-body-md text-on-surface-variant">{shop.description}</p>}
          <div className="flex flex-col gap-2 text-body-md">
            {where && (
              <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 self-start hover:text-primary">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {where}
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-outline" aria-hidden />
              </a>
            )}
            {shop.opening_hours && (
              <span className="inline-flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {shop.opening_hours}
              </span>
            )}
          </div>
          <ContactButtons shop={shop} />
          {shop.is_mine && shop.status === "rejected" && shop.reject_reason && (
            <ErrorBox error={{ message: t("Сабаби рад: {0}", shop.reject_reason) }} />
          )}
        </div>
        {(shop.is_mine || canEdit(user)) && (
          <Link to={`/shops/my?shop=${shop.id}`} className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low">
            <Pencil className="h-4 w-4" aria-hidden />
            {t("Идора кардан")}
          </Link>
        )}
      </section>

      {canEdit(user) && (shop.status === "pending" || shop.status === "rejected") && <Moderate shop={shop} onDone={reload} />}

      <Products shop={shop} />
      <Reviews key={shop.my_review?.id || "new"} shop={shop} onChange={reload} />
      <p className="text-label-sm text-on-surface-variant">
        {t("Маълумотро соҳиби мағоза ({0}) илова кардааст. Пеш аз пардохт молро бинед.", shop.owner_name)}
      </p>
    </div>
  );
}
