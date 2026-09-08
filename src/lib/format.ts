/** Converts Arabic-Indic / Persian digits to plain Latin digits. */
export function toLatinDigits(input: string) {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function formatIQD(value: number, lang: "ar" | "en" = "ar") {
  // Always render Latin (English) digits, even in Arabic UI.
  const n = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `${n} ${lang === "ar" ? "د.ع" : "IQD"}`;
}

export const ORDER_STATUSES = ["review", "preparing", "shipped", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";

export function statusLabel(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    review: { ar: "جديد", en: "New" },
    preparing: { ar: "قيد التجهيز", en: "Preparing" },
    shipped: { ar: "عند مندوب التوصيل", en: "With courier" },
    completed: { ar: "منجز", en: "Completed" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
  };
  return map[status]?.[lang] ?? status;
}

/** Plural section titles used in the admin orders tabs. */
export function statusGroupLabel(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    review: { ar: "طلبات جديدة", en: "New orders" },
    preparing: { ar: "طلبات قيد التجهيز", en: "Preparing" },
    shipped: { ar: "طلبات عند مندوب التوصيل", en: "With courier" },
    completed: { ar: "طلبات منجزة", en: "Completed orders" },
    cancelled: { ar: "طلبات ملغية", en: "Cancelled orders" },
  };
  return map[status]?.[lang] ?? status;
}

/** Rounding step used for discount prices. */
export const PRICE_STEP = 250;

/** Turns a discount percentage into a price, rounded to the nearest 250 IQD. */
export function discountPriceFromPercent(base: number, percent: number): number | null {
  const b = Number(base) || 0;
  const p = Number(percent) || 0;
  if (b <= 0 || p <= 0) return null;
  const raw = b * (1 - Math.min(p, 99) / 100);
  const rounded = Math.round(raw / PRICE_STEP) * PRICE_STEP;
  return Math.min(b, Math.max(PRICE_STEP, rounded));
}

export function effectivePrice(p: { price: number; discount_price: number | null }) {
  return p.discount_price != null && p.discount_price > 0 && p.discount_price < p.price
    ? p.discount_price
    : p.price;
}


export function discountPercent(p: { price: number; discount_price: number | null }) {
  if (!p.discount_price || p.discount_price >= p.price || p.price <= 0) return 0;
  return Math.round(((p.price - p.discount_price) / p.price) * 100);
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
