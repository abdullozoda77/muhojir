import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Camera, ExternalLink, ImagePlus, Package, PackageOpen, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { api, apiAll } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { CITIES, SHOP_CATEGORIES, SHOP_ORIGINS, UNITS } from "../constants.js";
import { Price, ProductPhoto, ShopLogo, ShopStatus, fitPhoto } from "../components/Shop.jsx";
import { BackLink, Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";

const EMPTY_SHOP = {
  name: "", category: "grocery", origin: "tj", description: "", city: "Москва", address: "", phone: "", whatsapp: "", telegram: "",
  opening_hours: "", delivery: false,
};

const EMPTY_PRODUCT = { name: "", description: "", price: "", unit: "dona", in_stock: true };

async function upload(path, field, file) {
  const blob = (await fitPhoto(file).catch(() => null)) || file;
  const body = new FormData();
  body.append(field, blob, `${field}.webp`);
  return api(path, { method: "POST", body });
}

function ShopForm({ open, shop, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_SHOP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(shop ? Object.fromEntries(Object.keys(EMPTY_SHOP).map((k) => [k, shop[k] ?? EMPTY_SHOP[k]])) : EMPTY_SHOP);
  }, [open, shop]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const fieldError = (key) => error?.data?.[key];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await api(shop ? `/market/shops/${shop.id}/` : "/market/shops/", { method: shop ? "PATCH" : "POST", body: form });
      onSaved(saved, !shop);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={shop ? t("Тағйир додани мағоза") : t("Мағозаи нав")} subtitle={shop ? shop.name : t("Пас аз санҷиши муҳаррир ба ҳама нишон дода мешавад")} icon={Store}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label={t("Номи мағоза")} required error={fieldError("name")}>
          <input className="input" value={form.name} onChange={set("name")} required minLength={2} maxLength={120} placeholder={t("Масалан: Дӯкони Хуҷанд")} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("Намуд")} required>
            <select className="input" value={form.category} onChange={set("category")}>
              {SHOP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={t("Молҳо аз куҷо")} required>
            <select className="input" value={form.origin} onChange={set("origin")}>
              {SHOP_ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.flag} {o.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("Тавсиф")} error={fieldError("description")} hint={t("Чӣ мефурӯшед, чӣ махсус аст.")}>
          <textarea className="input h-24 py-3" value={form.description} onChange={set("description")} maxLength={2000} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("Шаҳр")} required error={fieldError("city")}>
            <input className="input" value={form.city} onChange={set("city")} required minLength={2} list="my-shop-cities" />
            <datalist id="my-shop-cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label={t("Вақти корӣ")}>
            <input className="input" value={form.opening_hours} onChange={set("opening_hours")} maxLength={120} placeholder="Пн–Вс 08:00–22:00" />
          </Field>
        </div>
        <Field label={t("Суроға")} error={fieldError("address")} hint={t("Кӯча, хона ё номи бозор ва ҷойи раста.")}>
          <input className="input" value={form.address} onChange={set("address")} maxLength={255} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("Телефон")} error={fieldError("phone")}>
            <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 999 123-45-67" />
          </Field>
          <Field label="WhatsApp" error={fieldError("whatsapp")}>
            <input className="input" type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+7 999 123-45-67" />
          </Field>
        </div>
        <Field label="Telegram" error={fieldError("telegram")}>
          <input className="input" value={form.telegram} onChange={set("telegram")} placeholder="@dukoni_mo" />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl px-1">
          <input type="checkbox" className="h-5 w-5 rounded" checked={form.delivery} onChange={set("delivery")} />
          <span className="text-body-md">{t("Ба хона мерасонем")}</span>
        </label>
        <ErrorBox error={error} />
        <Button type="submit" loading={busy} icon={shop ? Pencil : Plus}>{shop ? t("Сабт кардан") : t("Мағоза кушодан")}</Button>
      </form>
    </Drawer>
  );
}

function ProductForm({ open, shopId, product, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setPreview(null);
    setForm(product ? { name: product.name, description: product.description, price: String(product.price), unit: product.unit, in_stock: product.in_stock } : EMPTY_PRODUCT);
  }, [open, product]);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, price: Number(form.price) };
      let saved = await api(product ? `/market/products/${product.id}/` : `/market/shops/${shopId}/products/`, { method: product ? "PATCH" : "POST", body });
      if (file) saved = await upload(`/market/products/${saved.id}/photo/`, "photo", file);
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const shown = preview || product?.photo;
  return (
    <Drawer open={open} onClose={onClose} title={product ? t("Тағйир додани мол") : t("Моли нав")} icon={Package}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <button type="button" onClick={() => input.current?.click()} className="group relative mx-auto w-40 overflow-hidden rounded-xl ring-1 ring-outline-variant">
          {shown ? <img src={shown} alt="" className="aspect-square w-full object-cover" /> : <ProductPhoto product={{}} />}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/55 py-1.5 text-label-sm text-white">
            <Camera className="h-4 w-4" aria-hidden />
            {shown ? t("Иваз кардани акс") : t("Илова кардани акс")}
          </span>
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Field label={t("Номи мол")} required error={error?.data?.name}>
          <input className="input" value={form.name} onChange={set("name")} required minLength={2} maxLength={120} placeholder={t("Масалан: Курагаи Исфара")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("Нарх, ₽")} required error={error?.data?.price}>
            <input className="input" type="number" inputMode="numeric" min="0" value={form.price} onChange={set("price")} required />
          </Field>
          <Field label={t("Барои")} required>
            <select className="input" value={form.unit} onChange={set("unit")}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("Тавсиф")}>
          <textarea className="input h-20 py-3" value={form.description} onChange={set("description")} maxLength={1000} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl px-1">
          <input type="checkbox" className="h-5 w-5 rounded" checked={form.in_stock} onChange={set("in_stock")} />
          <span className="text-body-md">{t("Ҳозир ҳаст")}</span>
        </label>
        <ErrorBox error={error?.data?.photo ? { message: error.data.photo[0] } : error} />
        <Button type="submit" loading={busy} icon={product ? Pencil : Plus}>{product ? t("Сабт кардан") : t("Илова кардан")}</Button>
      </form>
    </Drawer>
  );
}

function ShopManager({ shop, onEdit, onChanged, onDeleted }) {
  const { data, reload } = useApi(`/market/shops/${shop.id}/products/?page_size=100`);
  const [productForm, setProductForm] = useState({ open: false, product: null });
  const [error, setError] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInput = useRef(null);
  const products = data?.results || [];

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    }
  };

  const changeLogo = async (file) => {
    if (!file) return;
    setLogoBusy(true);
    await act(async () => onChanged(await upload(`/market/shops/${shop.id}/logo/`, "logo", file)));
    setLogoBusy(false);
    if (logoInput.current) logoInput.current.value = "";
  };

  const removeShop = () => {
    if (!window.confirm(t("Мағоза ва ҳамаи молҳояш нест карда шаванд?"))) return;
    act(async () => {
      await api(`/market/shops/${shop.id}/`, { method: "DELETE" });
      onDeleted(shop.id);
    });
  };

  const toggleStock = (p) => act(async () => {
    await api(`/market/products/${p.id}/`, { method: "PATCH", body: { in_stock: !p.in_stock } });
    reload();
  });

  const removeProduct = (p) => {
    if (!window.confirm(t("«{0}» нест карда шавад?", p.name))) return;
    act(async () => {
      await api(`/market/products/${p.id}/`, { method: "DELETE" });
      reload();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5 md:flex-row md:items-start">
        <button type="button" onClick={() => logoInput.current?.click()} disabled={logoBusy} className="group relative self-start overflow-hidden rounded-xl" aria-label={t("Иваз кардани логотип")}>
          <ShopLogo shop={shop} className="h-24 w-24" />
          <span className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity ${logoBusy ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <ImagePlus className="h-6 w-6" aria-hidden />
          </span>
        </button>
        <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => changeLogo(e.target.files?.[0])} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-semibold leading-tight">{shop.name}</h2>
            <ShopStatus status={shop.status} />
          </div>
          <p className="text-body-sm text-on-surface-variant">{[shop.city, shop.address].filter(Boolean).join(", ")}</p>
          {shop.status === "pending" && <p className="text-body-sm text-on-surface-variant">{t("Муҳаррир мағозаро месанҷад. Баъд аз тасдиқ ба шумо хабар медиҳем. Ҳоло молҳоро илова кунед.")}</p>}
          {shop.status === "rejected" && <ErrorBox error={{ message: t("Сабаби рад: {0}", shop.reject_reason || "—") }} />}
          {shop.status === "rejected" && <p className="text-body-sm text-on-surface-variant">{t("Маълумотро ислоҳ кунед — пас аз сабт мағоза боз ба санҷиш меравад.")}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            <Button variant="plain" icon={Pencil} onClick={onEdit}>{t("Тағйир додан")}</Button>
            <Link to={`/shops/${shop.id}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-lg ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low">
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t("Саҳифаи мағоза")}
            </Link>
            <Button variant="ghost" icon={Trash2} onClick={removeShop} className="text-error">{t("Нест кардан")}</Button>
          </div>
        </div>
      </section>

      <ErrorBox error={error} />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[19px] font-semibold">{t("Молҳо")} <span className="tabular-nums text-on-surface-variant">({products.length})</span></h3>
          <Button icon={Plus} onClick={() => setProductForm({ open: true, product: null })}>{t("Моли нав")}</Button>
        </div>
        {!data ? (
          <Skeleton className="h-40" />
        ) : products.length === 0 ? (
          <EmptyState icon={PackageOpen} title={t("Ҳоло мол нест")} text={t("Молҳоро бо нарх ва акс илова кунед — харидорон онҳоро дар ҷустуҷӯ меёбанд.")} />
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant overflow-hidden rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <ProductPhoto product={p} className="aspect-square !w-14 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-md font-medium">{p.name}</span>
                  <Price product={p} className="text-body-sm" />
                </div>
                <button type="button" onClick={() => toggleStock(p)} className={`min-h-[36px] shrink-0 rounded-lg px-3 text-label-sm transition-colors ${p.in_stock ? "bg-tertiary-fixed text-on-tertiary-fixed" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant"}`}>
                  {p.in_stock ? t("Ҳаст") : t("Нест")}
                </button>
                <button type="button" onClick={() => setProductForm({ open: true, product: p })} aria-label={t("Тағйир додан")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeProduct(p)} aria-label={t("Нест кардан")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-error-container hover:text-error">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ProductForm
        open={productForm.open}
        shopId={shop.id}
        product={productForm.product}
        onClose={() => setProductForm({ open: false, product: null })}
        onSaved={() => {
          setProductForm({ open: false, product: null });
          reload();
        }}
      />
    </div>
  );
}

export default function MyShops() {
  const [params, setParams] = useSearchParams();
  const [shops, setShops] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ open: false, shop: null });
  const selectedId = Number(params.get("shop")) || null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mine = await apiAll("/market/shops/?mine=true");
        if (selectedId && !mine.some((s) => s.id === selectedId)) {
          const other = await api(`/market/shops/${selectedId}/`).catch(() => null);
          if (other) mine.push(other);
        }
        if (alive) setShops(mine);
      } catch (err) {
        if (alive) setError(err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const select = (id) => setParams(id ? { shop: String(id) } : {}, { replace: true });
  const selected = shops?.find((s) => s.id === selectedId) || shops?.[0];
  const replace = (shop) => setShops((list) => list.map((s) => (s.id === shop.id ? { ...s, ...shop } : s)));

  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/shops">{t("Ҳамаи мағозаҳо")}</BackLink>
      <PageHeader title={t("Мағозаҳои ман")} text={t("Мағоза кушоед, молҳо ва нархҳоро илова кунед. Харидорон бо телефон, WhatsApp ё Telegram ба шумо менависанд.")} icon={Store}>
        <Button icon={Plus} onClick={() => setForm({ open: true, shop: null })}>{t("Мағозаи нав")}</Button>
      </PageHeader>
      <ErrorBox error={error} />
      {!shops ? (
        <Skeleton className="h-60" />
      ) : shops.length === 0 ? (
        <EmptyState icon={Store} title={t("Шумо ҳоло мағоза надоред")} text={t("Илова кардан ройгон аст. Муҳаррир маълумотро месанҷад ва мағоза ба ҳама намоён мешавад.")}>
          <Button icon={Plus} onClick={() => setForm({ open: true, shop: null })}>{t("Мағоза кушодан")}</Button>
        </EmptyState>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {shops.map((s) => (
              <button key={s.id} type="button" onClick={() => select(s.id)} aria-pressed={selected?.id === s.id} className={`flex min-w-[220px] items-center gap-3 rounded-xl p-2.5 text-left transition-colors lg:min-w-0 ${selected?.id === s.id ? "bg-surface-container-lowest shadow-sm ring-2 ring-primary/40" : "ring-1 ring-outline-variant hover:bg-surface-container-low"}`}>
                <ShopLogo shop={s} className="h-10 w-10" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-body-md font-medium">{s.name}</span>
                  <ShopStatus status={s.status} />
                </span>
              </button>
            ))}
          </nav>
          {selected && (
            <ShopManager
              key={selected.id}
              shop={selected}
              onEdit={() => setForm({ open: true, shop: selected })}
              onChanged={replace}
              onDeleted={(id) => {
                setShops((list) => list.filter((s) => s.id !== id));
                select(null);
              }}
            />
          )}
        </div>
      )}
      <ShopForm
        open={form.open}
        shop={form.shop}
        onClose={() => setForm({ open: false, shop: null })}
        onSaved={(shop, created) => {
          setForm({ open: false, shop: null });
          if (created) {
            setShops((list) => [shop, ...(list || [])]);
            select(shop.id);
          } else {
            replace(shop);
          }
        }}
      />
    </div>
  );
}
