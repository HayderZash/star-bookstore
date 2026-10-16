import { useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Marks units of a sold item as returned (stock goes back, profit drops). */
export function ReturnButton({
  source,
  itemId,
  quantity,
  returned,
}: {
  source: "cashier" | "online";
  itemId: string;
  quantity: number;
  returned: number;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const left = quantity - returned;

  const run = async (qty: number) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_return_item", {
      _source: source,
      _item_id: itemId,
      _qty: qty,
    });
    setBusy(false);
    if (error || data !== "OK") {
      toast.error(error?.message ?? "تعذر تسجيل الراجع");
      return;
    }
    toast.success(qty > 0 ? "تم تسجيل الراجع وإرجاع الكمية للمخزون" : "تم إلغاء الراجع");
    for (const k of ["pos-sales", "admin-orders", "orders", "products", "profit-report", "returns-report"])
      void qc.invalidateQueries({ queryKey: [k] });
  };

  const ask = () => {
    if (left <= 0) return;
    const raw = left === 1 ? "1" : window.prompt(`كم قطعة راجعة؟ (1 - ${left})`, String(left));
    if (raw === null) return;
    const n = Number(raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    if (!Number.isInteger(n) || n < 1 || n > left) {
      toast.error("عدد غير صحيح");
      return;
    }
    if (left === 1 && !window.confirm("تسجيل هذه القطعة كراجع؟")) return;
    void run(n);
  };

  return (
    <span className="inline-flex items-center gap-1">
      {returned > 0 && (
        <button
          type="button"
          className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
          title="اضغط لإلغاء الراجع"
          disabled={busy}
          onClick={() => window.confirm("إلغاء تسجيل الراجع؟") && void run(-returned)}
        >
          راجع {returned}
        </button>
      )}
      {left > 0 && (
        <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" disabled={busy} onClick={ask}>
          <Undo2 className="me-1 size-3" />
          راجع
        </Button>
      )}
    </span>
  );
}
