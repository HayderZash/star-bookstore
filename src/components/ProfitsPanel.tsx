import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD } from "@/lib/format";

type Row = {
  product_name: string;
  source: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
  total_cost: number;
  total_sell: number;
  total_profit: number;
};

const money = (n: number) => formatIQD(Number(n) || 0, "ar");
const sourceLabel = (s: string) => (s === "pos" ? "كاشير" : "طلب أونلاين");

function reportHtml(rows: Row[], from: string, to: string) {
  const body = rows
    .map(
      (r, i) => `<tr><td>${i + 1}</td><td class="name">${r.product_name}</td>
      <td>${sourceLabel(r.source)}</td><td>${r.quantity}</td>
      <td>${money(r.cost_price)}</td><td>${money(r.sell_price)}</td>
      <td>${money(r.total_cost)}</td><td>${money(r.total_sell)}</td>
      <td>${money(r.total_profit)}</td></tr>`,
    )
    .join("");
  const t = rows.reduce(
    (a, r) => ({
      qty: a.qty + Number(r.quantity),
      cost: a.cost + Number(r.total_cost),
      sell: a.sell + Number(r.total_sell),
      profit: a.profit + Number(r.total_profit),
    }),
    { qty: 0, cost: 0, sell: 0, profit: 0 },
  );
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <title>تقرير الأرباح</title><style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color:#171426; margin:0; }
  h1 { color:#4b2e83; font-size:20px; margin:0 0 4px; }
  p.range { margin:0 0 12px; font-size:12px; color:#5b5570; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { border:1px solid #ded7ef; padding:6px; text-align:center; }
  th { background:#4b2e83; color:#fff; }
  td.name { text-align:right; }
  tfoot td { font-weight:700; background:#f4f0fb; }
  </style></head><body>
  <h1>تقرير الأرباح</h1>
  <p class="range">من ${from || "البداية"} إلى ${to || "اليوم"}</p>
  <table><thead><tr><th>#</th><th>المادة</th><th>المصدر</th><th>العدد</th>
  <th>السعر الأساس</th><th>سعر البيع</th><th>كلفة كلية</th><th>بيع كلي</th><th>الربح</th></tr></thead>
  <tbody>${body}</tbody>
  <tfoot><tr><td colspan="3">المجموع</td><td>${t.qty}</td><td>—</td><td>—</td>
  <td>${money(t.cost)}</td><td>${money(t.sell)}</td><td>${money(t.profit)}</td></tr></tfoot>
  </table></body></html>`;
}

/** Admin-only profit report over online orders and cashier sales. */
export function ProfitsPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [printing, setPrinting] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const report = useQuery({
    queryKey: ["profit-report", from, to],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("profit_report", {
        ...(from ? { _from: new Date(from).toISOString() } : {}),
        ...(to ? { _to: new Date(`${to}T23:59:59`).toISOString() } : {}),
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = report.data ?? [];
  const totals = rows.reduce(
    (a, r) => ({
      qty: a.qty + Number(r.quantity),
      cost: a.cost + Number(r.total_cost),
      sell: a.sell + Number(r.total_sell),
      profit: a.profit + Number(r.total_profit),
    }),
    { qty: 0, cost: 0, sell: 0, profit: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label>من تاريخ</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>إلى تاريخ</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => report.refetch()}>
          تحديث
        </Button>
        <Button onClick={() => setPrinting(true)} disabled={!rows.length}>
          <Printer className="me-1 size-4" />
          طباعة التقرير
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["عدد القطع المباعة", String(totals.qty)],
          ["كلفة المواد", money(totals.cost)],
          ["مجموع البيع", money(totals.sell)],
          ["الربح الكلي", money(totals.profit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-start">المادة</th>
              <th className="p-2">المصدر</th>
              <th className="p-2">العدد</th>
              <th className="p-2">السعر الأساس</th>
              <th className="p-2">سعر البيع</th>
              <th className="p-2">كلفة كلية</th>
              <th className="p-2">بيع كلي</th>
              <th className="p-2">الربح</th>
            </tr>
          </thead>
          <tbody>
            {report.isLoading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  جاري التحميل…
                </td>
              </tr>
            )}
            {!report.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  لا توجد مبيعات ضمن هذه الفترة.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.product_name}-${r.source}-${i}`} className="border-t">
                <td className="p-2 text-start">{r.product_name}</td>
                <td className="p-2 text-center text-xs">{sourceLabel(r.source)}</td>
                <td className="p-2 text-center">{r.quantity}</td>
                <td className="p-2 text-center">{money(r.cost_price)}</td>
                <td className="p-2 text-center">{money(r.sell_price)}</td>
                <td className="p-2 text-center">{money(r.total_cost)}</td>
                <td className="p-2 text-center">{money(r.total_sell)}</td>
                <td className="p-2 text-center font-semibold text-primary">
                  {money(r.total_profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {printing && (
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const win = frameRef.current?.contentWindow;
                win?.focus();
                win?.print();
              }}
            >
              <Printer className="me-1 size-4" />
              طباعة
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPrinting(false)}>
              إغلاق
            </Button>
          </div>
          <iframe
            ref={frameRef}
            title="profit-report"
            className="h-[60vh] w-full rounded-lg border bg-white"
            srcDoc={reportHtml(rows, from, to)}
          />
        </div>
      )}
    </div>
  );
}
