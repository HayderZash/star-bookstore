import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Printer, Search, Trash2, RotateCcw, ScanBarcode, Usb, Vault, Unplug } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/NumberField";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD } from "@/lib/format";
import storeLogo from "@/lib/store-logo";
import { productsQuery, settingsQuery, type Product } from "@/lib/queries";
import {
  connectDevice,
  deviceLabel,
  disconnectDevice,
  hasSerial,
  hasUsb,
  listenForScans,
  onHardwareChange,
  openDrawer,
  printThermal,
  restoreDevices,
  type ReceiptData,
} from "@/lib/pos-hardware";

type Line = { id: string; name: string; price: number; qty: number; stock: number };

const money = (n: number) => formatIQD(Number(n) || 0, "ar");

const sellPrice = (p: Product) =>
  p.discount_price != null && p.discount_price > 0 && p.discount_price < p.price
    ? Number(p.discount_price)
    : Number(p.price);

type Receipt = {
  sale_number: number;
  created_at: string;
  customer_name: string;
  phone: string;
  lines: Line[];
  subtotal: number;
  discount: number;
  total: number;
};

/** 80mm thermal receipt. */
function miniHtml(r: Receipt, settings: Record<string, string>) {
  const name = settings["store_name_ar"] || "مكتبة النجم";
  const phone = settings["store_phone"] || settings["support_whatsapp"] || "";
  const rows = r.lines
    .map(
      (l) =>
        `<tr><td class="n">${l.name}</td><td>${l.qty}</td><td>${money(l.price * l.qty)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <title>وصل #${r.sale_number}</title><style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: Tahoma, Arial, sans-serif; width: 74mm; margin:0; color:#000; font-size:12px; }
  h1 { font-size:15px; margin:2px 0; text-align:center; }
  .c { text-align:center; font-size:11px; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  th, td { padding:2px 0; text-align:center; font-size:11px; }
  td.n, th.n { text-align:right; }
  thead th { border-bottom:1px dashed #000; }
  .tot { border-top:1px dashed #000; margin-top:6px; padding-top:4px; font-size:12px; }
  .tot div { display:flex; justify-content:space-between; }
  .grand { font-weight:700; font-size:14px; }
  footer { margin-top:8px; text-align:center; font-size:10px; }
  </style></head><body>
  <h1>${name}</h1>
  <div class="c">${phone}</div>
  <div class="c">وصل #${r.sale_number} — ${new Date(r.created_at).toLocaleString("ar-IQ-u-nu-latn")}</div>
  ${r.customer_name ? `<div class="c">الزبون: ${r.customer_name}</div>` : ""}
  <table><thead><tr><th class="n">المادة</th><th>عدد</th><th>المبلغ</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="tot">
    <div><span>المجموع</span><span>${money(r.subtotal)}</span></div>
    ${r.discount ? `<div><span>الخصم</span><span>- ${money(r.discount)}</span></div>` : ""}
    <div class="grand"><span>الإجمالي</span><span>${money(r.total)}</span></div>
  </div>
  <footer>شكراً لتسوقكم 🌟</footer></body></html>`;
}

/** A4 invoice. */
function fullHtml(r: Receipt, settings: Record<string, string>) {
  const name = settings["store_name_ar"] || "مكتبة النجم";
  const logo = settings["logo_url"] || storeLogo.url;
  const phone = settings["store_phone"] || settings["support_whatsapp"] || "";
  const address = settings["store_address"] || "";
  const rows = r.lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td class="name">${l.name}</td><td>${l.qty}</td><td>${money(l.price)}</td><td>${money(l.price * l.qty)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <title>فاتورة #${r.sale_number}</title><style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color:#171426; margin:0; }
  .head { display:flex; align-items:center; justify-content:space-between; gap:16px;
    border-bottom:3px solid #4b2e83; padding-bottom:12px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand img { width:70px; height:70px; object-fit:contain; }
  .brand h1 { margin:0; font-size:22px; color:#4b2e83; }
  .brand p { margin:2px 0 0; font-size:12px; color:#5b5570; }
  .meta { text-align:left; font-size:12px; line-height:1.8; }
  table { width:100%; border-collapse:collapse; margin-top:14px; font-size:13px; }
  th, td { border:1px solid #ded7ef; padding:7px 8px; text-align:center; }
  th { background:#4b2e83; color:#fff; }
  td.name { text-align:right; }
  .totals { margin-top:12px; margin-inline-start:auto; width:280px; }
  .totals td { border:none; text-align:start; }
  .totals tr.grand td { border-top:2px solid #4b2e83; font-size:16px; font-weight:700; color:#4b2e83; }
  footer { margin-top:26px; text-align:center; font-size:11px; color:#6b6580;
    border-top:1px solid #ded7ef; padding-top:10px; }
  </style></head><body>
  <div class="head"><div class="brand"><img src="${logo}" alt="${name}" />
    <div><h1>${name}</h1><p>${address}</p><p>${phone}</p></div></div>
    <div class="meta"><div><b>فاتورة رقم:</b> #${r.sale_number}</div>
    <div><b>التاريخ:</b> ${new Date(r.created_at).toLocaleString("ar-IQ-u-nu-latn")}</div>
    ${r.customer_name ? `<div><b>الزبون:</b> ${r.customer_name}</div>` : ""}
    ${r.phone ? `<div><b>الهاتف:</b> ${r.phone}</div>` : ""}</div></div>
  <table><thead><tr><th style="width:36px">#</th><th>المادة</th><th style="width:60px">العدد</th>
    <th style="width:110px">سعر القطعة</th><th style="width:120px">السعر الكلي</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <table class="totals">
    <tr><td>المجموع الفرعي</td><td>${money(r.subtotal)}</td></tr>
    ${r.discount ? `<tr><td>الخصم</td><td>- ${money(r.discount)}</td></tr>` : ""}
    <tr class="grand"><td>الإجمالي</td><td>${money(r.total)}</td></tr>
  </table>
  <footer>شكراً لتسوقكم من ${name}</footer></body></html>`;
}

function thermalData(r: Receipt, settings: Record<string, string>): ReceiptData {
  const phone = settings["store_phone"] || settings["support_whatsapp"] || "";
  return {
    title: settings["store_name_ar"] || "مكتبة النجم",
    subtitle: [
      phone,
      `وصل #${r.sale_number} — ${new Date(r.created_at).toLocaleString("ar-IQ-u-nu-latn")}`,
      r.customer_name ? `الزبون: ${r.customer_name}` : "",
    ].filter(Boolean),
    lines: r.lines.map((l) => ({ name: l.name, qty: l.qty, amount: money(l.price * l.qty) })),
    totals: [
      { label: "المجموع", value: money(r.subtotal) },
      ...(r.discount ? [{ label: "الخصم", value: `- ${money(r.discount)}` }] : []),
      { label: "الإجمالي", value: money(r.total), bold: true },
    ],
    footer: "شكراً لتسوقكم",
  };
}

/** Admin cashier: build a sale, deduct stock, print a mini or A4 invoice. */
export function CashierPanel() {
  const qc = useQueryClient();
  const products = useQuery(productsQuery);
  const settings = useQuery(settingsQuery);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [mode, setMode] = useState<"mini" | "full">("mini");
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [autoDrawer, setAutoDrawer] = useState(true);
  const [, setHwTick] = useState(0);

  useEffect(() => {
    const off = onHardwareChange(() => setHwTick((n) => n + 1));
    void restoreDevices();
    setAutoDrawer(localStorage.getItem("pos-auto-drawer") !== "0");
    return off;
  }, []);

  const byCode = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products.data ?? []) {
      if (p.sku) m.set(p.sku.trim().toLowerCase(), p);
      if (p.barcode) m.set(p.barcode.trim().toLowerCase(), p);
    }
    return m;
  }, [products.data]);

  const addRef = useRef<(p: Product) => void>(() => {});
  const byCodeRef = useRef(byCode);
  byCodeRef.current = byCode;
  const handleScan = (code: string) => {
    const p = byCodeRef.current.get(code.trim().toLowerCase());
    if (!p) {
      toast.error(`لا توجد مادة بالباركود ${code}`);
      return false;
    }
    if ((Number(p.stock_qty) || 0) <= 0) toast.warning(`«${p.name_ar}» غير متوفرة في المخزون`);
    addRef.current(p);
    toast.success(`أضيفت: ${p.name_ar || p.name_en}`);
    return true;
  };
  useEffect(() => listenForScans((c) => void handleScan(c)), []);

  const runDrawer = async () => {
    try {
      if (!(await openDrawer())) toast.error("اربط الطابعة الحرارية أو جهاز الجرار أولاً");
    } catch (e) {
      toast.error(`تعذر فتح الجرار: ${(e as Error).message}`);
    }
  };

  /** Thermal printer if connected (drawer opens via it), else browser print. */
  const printReceipt = async (r: Receipt) => {
    const st0 = settings.data ?? {};
    try {
      if (await printThermal(thermalData(r, st0), autoDrawer)) {
        toast.success("تمت الطباعة على الطابعة الحرارية");
        return;
      }
    } catch (e) {
      toast.error(`خطأ في الطابعة الحرارية: ${(e as Error).message}`);
    }
    const win = frameRef.current?.contentWindow;
    if (!win) {
      toast.error("تعذر فتح الطباعة");
      return;
    }
    win.focus();
    win.print();
    if (autoDrawer) await openDrawer().catch(() => false);
  };

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return (products.data ?? [])
      .filter((p) => [p.name_ar, p.name_en, p.sku].join(" ").toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, products.data]);

  const add = (p: Product) => {
    setLines((cur) => {
      const found = cur.find((l) => l.id === p.id);
      if (found)
        return cur.map((l) =>
          l.id === p.id ? { ...l, qty: Math.min(l.stock || 999, l.qty + 1) } : l,
        );
      return [
        ...cur,
        {
          id: p.id,
          name: p.name_ar || p.name_en,
          price: sellPrice(p),
          qty: 1,
          stock: Number(p.stock_qty) || 0,
        },
      ];
    });
    setQ("");
  };
  addRef.current = add;

  const setQty = (id: string, qty: number) =>
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)));

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const disc = Math.min(Math.max(0, discount), subtotal);
  const total = subtotal - disc;

  const checkout = async () => {
    if (!lines.length) {
      toast.error("السلة فارغة");
      return;
    }
    const over = lines.find((l) => l.qty > l.stock);
    if (over) {
      toast.error(`الكمية غير كافية للمادة «${over.name}» (المتوفر ${over.stock})`);
      return;
    }
    setBusy(true);
    try {
      const { data: saleId, error } = await supabase.rpc("pos_checkout", {
        _items: lines.map((l) => ({ product_id: l.id, quantity: l.qty })),
        _customer_name: customer,
        _phone: phone,
        _discount: disc,
        _note: "",
      });
      if (error) throw error;
      const { data: sale } = await supabase
        .from("pos_sales")
        .select("sale_number, created_at, customer_name, phone, subtotal, discount_amount, total_amount")
        .eq("id", String(saleId))
        .maybeSingle();
      const r: Receipt = {
        sale_number: Number(sale?.sale_number ?? 0),
        created_at: String(sale?.created_at ?? new Date().toISOString()),
        customer_name: customer,
        phone,
        lines,
        subtotal,
        discount: disc,
        total,
      };
      setReceipt(r);
      setLines([]);
      setCustomer("");
      setPhone("");
      setDiscount(0);
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["pos-sales"] });
      toast.success("تم تسجيل البيع وتحديث المخزون");
      // Wait for the receipt frame to render before printing.
      setTimeout(() => void printReceipt(r), 400);
    } catch (e) {
      toast.error((e as Error).message || "تعذر إتمام البيع");
    } finally {
      setBusy(false);
    }
  };

  const st = settings.data ?? {};

  return (
    <div className="space-y-4">
      <HardwareBar
        autoDrawer={autoDrawer}
        onAutoDrawer={(v) => {
          setAutoDrawer(v);
          localStorage.setItem("pos-auto-drawer", v ? "1" : "0");
        }}
        onDrawer={() => void runDrawer()}
      />
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-scan-target=""
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !q.trim()) return;
              e.preventDefault();
              if (byCode.has(q.trim().toLowerCase())) handleScan(q);
              else if (results[0]) add(results[0]);
            }}
            placeholder="امسح الباركود أو ابحث بالاسم أو الرمز..."
            className="h-11 rounded-full ps-9"
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-muted"
                >
                  <span className="truncate">{p.name_ar || p.name_en}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {money(sellPrice(p))} · المخزون {p.stock_qty}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            السلة فارغة — ابحث عن مادة وأضفها.
          </p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</span>
                <span className="text-xs text-muted-foreground">{money(l.price)}</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="size-8" onClick={() => setQty(l.id, l.qty - 1)}>
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                  <Button size="icon" variant="outline" className="size-8" onClick={() => setQty(l.id, l.qty + 1)}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <span className="w-24 text-end text-sm font-bold">{money(l.price * l.qty)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  onClick={() => setLines((cur) => cur.filter((x) => x.id !== l.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
                {l.qty > l.stock && (
                  <span className="w-full text-xs text-destructive">
                    المتوفر في المخزون {l.stock} فقط
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>اسم الزبون (اختياري)</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>الهاتف (اختياري)</Label>
            <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>خصم (د.ع)</Label>
            <NumberField value={discount} onValueChange={(v) => setDiscount(v ?? 0)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="text-sm">
            <div>المجموع: <b>{money(subtotal)}</b></div>
            {disc > 0 && <div className="text-destructive">الخصم: -{money(disc)}</div>}
            <div className="text-lg font-bold text-primary">الإجمالي: {money(total)}</div>
          </div>
          <Button size="lg" disabled={busy || !lines.length} onClick={checkout}>
            {busy ? "جاري التسجيل..." : "إتمام البيع وطباعة الفاتورة"}
          </Button>
        </div>
      </div>

      <SavedSales onOpen={(r) => setReceipt(r)} />

      {receipt && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">فاتورة #{receipt.sale_number}</span>
            <Button
              size="sm"
              variant={mode === "mini" ? "default" : "outline"}
              onClick={() => setMode("mini")}
            >
              ورق صغير (Mini printer)
            </Button>
            <Button
              size="sm"
              variant={mode === "full" ? "default" : "outline"}
              onClick={() => setMode("full")}
            >
              طباعة عادية A4
            </Button>
            <Button
              size="sm"
              onClick={() => void printReceipt(receipt)}
            >
              <Printer className="me-1 size-4" />
              طباعة
            </Button>
            <Button size="sm" variant="outline" onClick={() => void runDrawer()}>
              <Vault className="me-1 size-4" />
              فتح الجرار
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReceipt(null)}>
              إغلاق
            </Button>
          </div>
          <iframe
            ref={frameRef}
            title="receipt"
            className="h-[60vh] w-full rounded-lg border bg-white"
            srcDoc={mode === "mini" ? miniHtml(receipt, st) : fullHtml(receipt, st)}
          />
        </div>
      )}
    </div>
  );
}

type SavedSale = {
  id: string;
  sale_number: number;
  created_at: string;
  customer_name: string;
  phone: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  pos_sale_items: { product_name: string; quantity: number; unit_price: number }[];
};

/** Saved cashier invoices: review, reprint, or delete (stock goes back). */
function SavedSales({ onOpen }: { onOpen: (r: Receipt) => void }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const sales = useQuery({
    queryKey: ["pos-sales"],
    queryFn: async (): Promise<SavedSale[]> => {
      const { data, error } = await supabase
        .from("pos_sales")
        .select(
          "id, sale_number, created_at, customer_name, phone, subtotal, discount_amount, total_amount, pos_sale_items(product_name, quantity, unit_price)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as SavedSale[];
    },
  });

  const remove = async (s: SavedSale) => {
    if (!window.confirm(`حذف الفاتورة #${s.sale_number}؟ سترجع الكميات للمخزون وتُحذف من الأرباح.`))
      return;
    setBusyId(s.id);
    const { error } = await supabase.rpc("admin_delete_pos_sale", { _sale_id: s.id });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف الفاتورة وإرجاع الكميات للمخزون");
    void qc.invalidateQueries({ queryKey: ["pos-sales"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
    void qc.invalidateQueries({ queryKey: ["profit-report"] });
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <h3 className="text-base font-semibold">الفواتير المحفوظة</h3>
      {sales.isLoading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : !sales.data?.length ? (
        <p className="text-sm text-muted-foreground">لا توجد فواتير بعد.</p>
      ) : (
        <div className="space-y-2">
          {sales.data.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-2 text-sm">
              <span className="font-bold">#{s.sale_number}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleString("ar-IQ-u-nu-latn")}
              </span>
              {s.customer_name && <span className="text-xs">{s.customer_name}</span>}
              <span className="text-xs text-muted-foreground">
                {s.pos_sale_items?.length ?? 0} مادة
              </span>
              <span className="ms-auto font-bold text-primary">{money(s.total_amount)}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onOpen({
                    sale_number: Number(s.sale_number),
                    created_at: s.created_at,
                    customer_name: s.customer_name ?? "",
                    phone: s.phone ?? "",
                    lines: (s.pos_sale_items ?? []).map((i, idx) => ({
                      id: `${s.id}-${idx}`,
                      name: i.product_name,
                      price: Number(i.unit_price) || 0,
                      qty: Number(i.quantity) || 0,
                      stock: 0,
                    })),
                    subtotal: Number(s.subtotal) || 0,
                    discount: Number(s.discount_amount) || 0,
                    total: Number(s.total_amount) || 0,
                  })
                }
              >
                <RotateCcw className="me-1 size-4" />
                عرض وطباعة
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busyId === s.id}
                onClick={() => void remove(s)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Connect thermal printer / cash drawer and show scanner status. */
function HardwareBar({
  autoDrawer,
  onAutoDrawer,
  onDrawer,
}: {
  autoDrawer: boolean;
  onAutoDrawer: (v: boolean) => void;
  onDrawer: () => void;
}) {
  const [supported, setSupported] = useState({ serial: false, usb: false });
  useEffect(() => setSupported({ serial: hasSerial(), usb: hasUsb() }), []);

  const connect = async (role: "printer" | "drawer", kind: "serial" | "usb") => {
    try {
      await connectDevice(role, kind);
      toast.success(role === "printer" ? "تم ربط الطابعة الحرارية" : "تم ربط جرار النقود");
    } catch (e) {
      const msg = (e as Error).message;
      if (!/No port selected|No device selected/i.test(msg)) toast.error(msg);
    }
  };

  const slot = (role: "printer" | "drawer", title: string) => {
    const label = deviceLabel(role);
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
        <span className="text-sm font-semibold">{title}:</span>
        {label ? (
          <>
            <span className="text-xs text-primary">متصل ({label})</span>
            <Button size="sm" variant="ghost" onClick={() => void disconnectDevice(role)}>
              <Unplug className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={!supported.usb} onClick={() => void connect(role, "usb")}>
              <Usb className="me-1 size-4" /> USB
            </Button>
            <Button size="sm" variant="outline" disabled={!supported.serial} onClick={() => void connect(role, "serial")}>
              منفذ تسلسلي/COM
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">الأجهزة</h3>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ScanBarcode className="size-4" /> قارئ الباركود جاهز — امسح أي مادة مباشرة
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {slot("printer", "الطابعة الحرارية")}
        {slot("drawer", "جرار النقود (اختياري إذا كان موصولاً بالطابعة)")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={onDrawer}>
          <Vault className="me-1 size-4" /> فتح الجرار
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoDrawer} onChange={(e) => onAutoDrawer(e.target.checked)} />
          فتح الجرار تلقائياً عند الطباعة
        </label>
      </div>
      {!supported.usb && !supported.serial && (
        <p className="text-xs text-destructive">
          ربط الطابعة والجرار يحتاج متصفح Chrome أو Edge على الحاسوب.
        </p>
      )}
    </div>
  );
}
