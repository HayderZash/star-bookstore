import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartOption = {
  variant_id: string;
  group_ar: string;
  group_en: string;
  value_ar: string;
  value_en: string;
};

export type CartItem = {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  /** Price before the product discount (equals price when there is no discount). */
  original_price?: number | null;
  image_url: string | null;
  quantity: number;
  /** Selected product options (colors, sizes, ...) — empty when the product has none. */
  options?: CartOption[];
};

/** Unique line identity: same product with different options = different lines. */
export function cartKey(item: { id: string; options?: CartOption[] }) {
  const opts = (item.options ?? []).map((o) => o.variant_id).sort().join(",");
  return opts ? `${item.id}::${opts}` : item.id;
}

type Ctx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore corrupt cart */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<Ctx>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.quantity * i.price, 0),
      add: (item, qty = 1) =>
        setItems((prev) => {
          const k = cartKey(item);
          const found = prev.find((p) => cartKey(p) === k);
          if (found)
            return prev.map((p) =>
              cartKey(p) === k ? { ...p, quantity: p.quantity + qty } : p,
            );
          return [...prev, { ...item, quantity: qty }];
        }),
      setQty: (key, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((p) => cartKey(p) !== key)
            : prev.map((p) => (cartKey(p) === key ? { ...p, quantity: qty } : p)),
        ),
      remove: (key) => setItems((prev) => prev.filter((p) => cartKey(p) !== key)),
      clear: () => setItems([]),
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
