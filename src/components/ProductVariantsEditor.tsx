import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { productVariantsQuery } from "@/lib/queries";

const empty = {
  group_ar: "",
  group_en: "",
  value_ar: "",
  value_en: "",
  price_delta: "0",
  stock_qty: "0",
};

/** Admin editor for a product's selectable options (colors, sizes, ...). */
export function ProductVariantsEditor({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery(productVariantsQuery);
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);

  const rows = (data ?? []).filter((v) => v.product_id === productId);

  const refresh = () => qc.invalidateQueries({ queryKey: ["product_variants"] });

  const addRow = async () => {
    if (!form.group_ar.trim() || !form.value_ar.trim()) {
      toast.error("اكتب اسم الخيار وقيمته");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("product_variants").insert({
      product_id: productId,
      group_ar: form.group_ar.trim(),
      group_en: form.group_en.trim() || form.group_ar.trim(),
      value_ar: form.value_ar.trim(),
      value_en: form.value_en.trim() || form.value_ar.trim(),
      price_delta: Number(form.price_delta) || 0,
      stock_qty: Number(form.stock_qty) || 0,
      sort_order: rows.length,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setForm({ ...empty, group_ar: form.group_ar, group_en: form.group_en });
      void refresh();
      toast.success("تمت إضافة الخيار");
    }
  };

  const removeRow = async (id: string) => {
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void refresh();
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 sm:col-span-2">
      <div className="text-sm font-bold">خيارات المنتج (لون، حجم، ...)</div>
      <p className="text-xs text-muted-foreground">
        أضف مجموعة الخيار (مثال: اللون) وقيمتها (مثال: أحمر). فرق السعر يُضاف لسعر المنتج.
      </p>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <span className="font-semibold">{v.group_ar}:</span>
              <span>{v.value_ar}</span>
              {Number(v.price_delta) !== 0 && (
                <span className="text-primary">
                  {Number(v.price_delta) > 0 ? "+" : ""}
                  {Number(v.price_delta).toLocaleString("en-US")} د.ع
                </span>
              )}
              <span className="text-muted-foreground">الكمية: {v.stock_qty}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ms-auto size-8 text-destructive"
                onClick={() => void removeRow(v.id)}
                aria-label="حذف"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>المجموعة (عربي)</Label>
          <Input
            value={form.group_ar}
            placeholder="اللون"
            onChange={(e) => setForm({ ...form, group_ar: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>المجموعة (إنكليزي)</Label>
          <Input
            dir="ltr"
            value={form.group_en}
            placeholder="Color"
            onChange={(e) => setForm({ ...form, group_en: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>القيمة (عربي)</Label>
          <Input
            value={form.value_ar}
            placeholder="أحمر"
            onChange={(e) => setForm({ ...form, value_ar: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>القيمة (إنكليزي)</Label>
          <Input
            dir="ltr"
            value={form.value_en}
            placeholder="Red"
            onChange={(e) => setForm({ ...form, value_en: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>فرق السعر</Label>
          <Input
            type="number"
            dir="ltr"
            value={form.price_delta}
            onChange={(e) => setForm({ ...form, price_delta: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>الكمية</Label>
          <Input
            type="number"
            dir="ltr"
            value={form.stock_qty}
            onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
          />
        </div>
      </div>

      <Button variant="outline" disabled={busy} onClick={() => void addRow()}>
        <Plus className="size-4" />
        إضافة خيار
      </Button>
    </div>
  );
}
