import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery } from "@/lib/queries";

/** Admin settings section: pick which products appear in the homepage featured showcase. */
export function FeaturedPicker() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const selected = products.filter((p) => p.is_featured);
  const term = q.trim().toLowerCase();
  const list = term
    ? products.filter(
        (p) =>
          p.name_ar.toLowerCase().includes(term) ||
          p.name_en.toLowerCase().includes(term) ||
          (p.barcode ?? "").includes(term) ||
          p.sku.toLowerCase().includes(term),
      )
    : selected;

  const toggle = async (id: string, v: boolean) => {
    setBusy(id);
    const { error } = await supabase.from("products").update({ is_featured: v }).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(v ? "أُضيف إلى المميز" : "أُزيل من المميز");
  };

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Star className="size-5 fill-primary text-primary" />
        <div>
          <h3 className="text-base font-semibold">المميز ({selected.length})</h3>
          <p className="text-xs text-muted-foreground">
            المنتجات المختارة تظهر بشكل بارز في أعلى الصفحة الرئيسية للزبون.
          </p>
        </div>
      </div>
      <Input
        placeholder="ابحث باسم المنتج أو الباركود لإضافته..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {list.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {term ? "لا توجد نتائج" : "لم تختر أي منتج بعد — ابحث أعلاه لإضافة منتجات."}
          </p>
        )}
        {list.slice(0, 60).map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-3 rounded-lg border p-2 text-sm hover:bg-muted/50"
          >
            {p.image_url ? (
              <img src={p.image_url} alt="" className="size-10 rounded object-cover" />
            ) : (
              <div className="size-10 rounded bg-muted" />
            )}
            <span className="flex-1 line-clamp-1">{p.name_ar}</span>
            <Switch
              checked={p.is_featured}
              disabled={busy === p.id}
              onCheckedChange={(v) => void toggle(p.id, v)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
