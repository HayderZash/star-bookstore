import { createFileRoute, Link } from "@tanstack/react-router";

import { CashierPanel } from "@/components/CashierPanel";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "الكاشير | مكتبة النجم" },
      { name: "description", content: "نقطة البيع لمكتبة النجم: مسح الباركود، الفواتير، والطباعة الحرارية." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "الكاشير | مكتبة النجم" },
      { property: "og:description", content: "نقطة بيع سريعة لإدارة مبيعات المكتبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosPage,
});

function PosPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (!isAdmin)
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">الكاشير مخصص للإدارة فقط</p>
        <Link to="/account" className="mt-4 inline-block text-sm font-semibold text-primary">
          تسجيل الدخول
        </Link>
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">الكاشير</h1>
        <Link to="/manage-orders" className="text-sm font-semibold text-primary">
          الطلبات ←
        </Link>
      </div>
      <CashierPanel />
    </div>
  );
}
