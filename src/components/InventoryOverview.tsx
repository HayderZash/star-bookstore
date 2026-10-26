import { Package } from "lucide-react";
import { formatInventoryPercent, inventorySummary } from "@/lib/inventory";

export function InventoryOverview({ products }: { products: readonly { stock_qty: number; category_id: string | null; is_hidden?: boolean }[] }) {
  const summary = inventorySummary(products);
  return (
    <div aria-label="ملخص المخزون" className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-sm">
      <span className="flex items-center gap-2 font-semibold"><Package className="size-4 text-primary" /> إجمالي المخزون: <b dir="ltr" className="tabular-nums">{summary.totalUnits.toLocaleString("en-US")}</b> قطعة</span>
      <span className="text-muted-foreground">حصة المخزون الكلي: <b dir="ltr" className="text-primary tabular-nums">{formatInventoryPercent(summary.totalUnits > 0 ? 100 : 0)}</b></span>
      <span className="text-muted-foreground">المنتجات المتوفرة: <b dir="ltr" className="text-primary tabular-nums">{formatInventoryPercent(summary.availabilityPercent)}</b> <span>({summary.availableProducts} / {summary.productCount})</span></span>
    </div>
  );
}