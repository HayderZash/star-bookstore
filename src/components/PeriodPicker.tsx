import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Period = { mode: "day" | "range" | "all"; day: string; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const defaultPeriod = (): Period => ({ mode: "day", day: todayStr(), from: "", to: "" });

/** Local-time ISO bounds for the chosen period (null = open-ended). */
export function periodBounds(p: Period): { from: string | null; to: string | null } {
  const start = (d: string) => new Date(`${d}T00:00:00`).toISOString();
  const end = (d: string) => new Date(`${d}T23:59:59.999`).toISOString();
  if (p.mode === "day" && p.day) return { from: start(p.day), to: end(p.day) };
  if (p.mode === "range")
    return { from: p.from ? start(p.from) : null, to: p.to ? end(p.to) : null };
  return { from: null, to: null };
}

export function periodLabel(p: Period) {
  if (p.mode === "day") return `يوم ${p.day}`;
  if (p.mode === "range") return `من ${p.from || "البداية"} إلى ${p.to || "اليوم"}`;
  return "كل الوقت";
}

function shiftDay(d: string, n: number) {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const set = (patch: Partial<Period>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {([
        ["day", "يوم محدد"],
        ["range", "مدة زمنية"],
        ["all", "كل الوقت"],
      ] as const).map(([m, l]) => (
        <Button key={m} size="sm" variant={value.mode === m ? "default" : "outline"} onClick={() => set({ mode: m })}>
          {l}
        </Button>
      ))}
      {value.mode === "day" && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => set({ day: shiftDay(value.day || todayStr(), -1) })}>›</Button>
          <Input type="date" className="h-9 w-auto" value={value.day} onChange={(e) => set({ day: e.target.value })} />
          <Button size="sm" variant="ghost" onClick={() => set({ day: shiftDay(value.day || todayStr(), 1) })}>‹</Button>
          <Button size="sm" variant="ghost" onClick={() => set({ day: todayStr() })}>اليوم</Button>
        </div>
      )}
      {value.mode === "range" && (
        <div className="flex items-center gap-1 text-xs">
          من <Input type="date" className="h-9 w-auto" value={value.from} onChange={(e) => set({ from: e.target.value })} />
          إلى <Input type="date" className="h-9 w-auto" value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
