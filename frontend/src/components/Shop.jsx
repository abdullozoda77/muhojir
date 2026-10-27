import { Link } from "react-router-dom";
import { Ban, BadgeCheck, Hourglass, MapPin, MessageCircle, Package, Phone, Send, Truck } from "lucide-react";
import { t } from "../i18n.js";
import { rub } from "../format.js";
import { shopCategory, shopOrigin, unitLabel } from "../constants.js";
import { Stars } from "./Stars.jsx";

export async function fitPhoto(file, side = 1200) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
}

export function ShopLogo({ shop, className = "h-14 w-14" }) {
  const Icon = shopCategory(shop.category).icon;
  if (shop.logo) return <img src={shop.logo} alt="" className={`${className} shrink-0 rounded-xl object-cover ring-1 ring-outline-variant`} />;
  return (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15`}>
      <Icon className="h-1/2 w-1/2" aria-hidden />
    </span>
  );
}

export function OriginBadge({ origin }) {
  const o = shopOrigin(origin);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 text-label-sm text-on-surface-variant">
      <span aria-hidden>{o.flag}</span>
      {o.label}
    </span>
  );
}

const STATUS = {
  pending: { icon: Hourglass, box: "bg-warning-fixed text-on-warning-fixed", label: () => t("Интизори санҷиш") },
  approved: { icon: BadgeCheck, box: "bg-tertiary-fixed text-on-tertiary-fixed", label: () => t("Тасдиқ шуд") },
  rejected: { icon: Ban, box: "bg-error-container text-on-error-container", label: () => t("Рад шуд") },
};

export function ShopStatus({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm ${s.box}`}>
      <s.icon className="h-3.5 w-3.5" aria-hidden />
      {s.label()}
    </span>
  );
}

export function contactLinks(shop) {
  const links = [];
  if (shop.phone) links.push({ key: "phone", href: `tel:${shop.phone}`, icon: Phone, label: shop.phone });
  if (shop.whatsapp) links.push({ key: "whatsapp", href: `https://wa.me/${shop.whatsapp.replace(/\D/g, "")}`, icon: MessageCircle, label: "WhatsApp" });
  if (shop.telegram) links.push({ key: "telegram", href: `https://t.me/${shop.telegram}`, icon: Send, label: "Telegram" });
  return links;
}

export function ContactButtons({ shop, size = "md" }) {
  const small = size === "sm";
  return (
    <div className="flex flex-wrap gap-2">
      {contactLinks(shop).map((c, i) => (
        <a
          key={c.key}
          href={c.href}
          target={c.key === "phone" ? undefined : "_blank"}
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-2 rounded-xl text-label-md transition-colors ${small ? "min-h-[36px] px-3" : "min-h-[44px] px-4"} ${i === 0 ? "bg-ink text-on-ink hover:bg-ink/90" : "ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low"}`}
        >
          <c.icon className="h-4 w-4" aria-hidden />
          {c.label}
        </a>
      ))}
    </div>
  );
}

export function ShopCard({ shop }) {
  const category = shopCategory(shop.category);
  return (
    <Link to={`/shops/${shop.id}`} className="card group flex h-full w-full flex-col gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:ring-outline/50">
      <div className="flex items-start gap-3.5">
        <ShopLogo shop={shop} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[17px] font-semibold leading-tight group-hover:text-primary">{shop.name}</span>
          <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <category.icon className="h-4 w-4 shrink-0" aria-hidden />
            {category.label}
          </span>
          {shop.rating ? (
            <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
              <Stars value={shop.rating} size="h-3.5 w-3.5" /> {shop.rating} ({shop.reviews_count})
            </span>
          ) : null}
        </div>
        {shop.status !== "approved" && <ShopStatus status={shop.status} />}
      </div>
      {shop.description && <p className="line-clamp-2 text-body-sm text-on-surface-variant">{shop.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <OriginBadge origin={shop.origin} />
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 text-label-sm text-on-surface-variant">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {shop.city}
        </span>
        {shop.delivery && (
          <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-label-sm text-on-tertiary-fixed">
            <Truck className="h-3.5 w-3.5" aria-hidden />
            {t("Расонидан")}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-label-sm tabular-nums text-on-surface-variant">
          <Package className="h-3.5 w-3.5" aria-hidden />
          {t("{0} мол", shop.products_count)}
        </span>
      </div>
    </Link>
  );
}

export function ProductPhoto({ product, className = "aspect-square" }) {
  if (product.photo) return <img src={product.photo} alt="" loading="lazy" className={`${className} w-full rounded-xl bg-surface-container object-cover`} />;
  return (
    <span className={`${className} flex w-full items-center justify-center rounded-xl bg-surface-container-low text-outline`}>
      <Package className="h-8 w-8" aria-hidden />
    </span>
  );
}

export function Price({ product, className = "" }) {
  return (
    <span className={`font-semibold tabular-nums ${className}`}>
      {rub(product.price)}
      <span className="font-normal text-on-surface-variant"> / {unitLabel(product.unit)}</span>
    </span>
  );
}

export function ProductCard({ product, showShop = false, children }) {
  const body = (
    <>
      <div className="relative">
        <ProductPhoto product={product} />
        {!product.in_stock && (
          <span className="absolute left-2 top-2 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-label-sm text-on-surface-variant ring-1 ring-outline-variant">{t("Ҳоло нест")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-body-md font-medium leading-snug">{product.name}</span>
        {product.description && <span className="line-clamp-2 text-body-sm text-on-surface-variant">{product.description}</span>}
        <Price product={product} className="mt-auto pt-1 text-[16px]" />
        {showShop && product.shop && (
          <span className="flex items-center gap-1.5 truncate text-label-sm text-on-surface-variant">
            <span aria-hidden>{shopOrigin(product.shop.origin).flag}</span>
            {product.shop.name} · {product.shop.city}
          </span>
        )}
      </div>
      {children}
    </>
  );
  const style = `card flex h-full w-full flex-col gap-3 p-3 ${product.in_stock ? "" : "opacity-70"}`;
  if (showShop) return <Link to={`/shops/${product.shop_id}`} className={`${style} transition-all duration-300 hover:-translate-y-0.5 hover:ring-outline/50`}>{body}</Link>;
  return <div className={style}>{body}</div>;
}
