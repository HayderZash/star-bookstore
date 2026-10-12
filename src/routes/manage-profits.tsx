import { createFileRoute, Link } from "@tanstack/react-router";

import { ProfitsPanel } from "@/components/ProfitsPanel";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/manage-profits")({
  head: () => ({
    meta: [
      { title: "الأرباح | مكتبة النجم" },
      { name: "description", content: "تقرير أرباح مكتبة النجم من الكاشير والطلبات الأونلاين." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "الأرباح | مكتبة النجم" },
      { property: "og:description", content: "تقرير الأرباح والخصومات حسب الفترة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfitsPage,
});

function ProfitsPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (!isAdmin)
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">الأرباح مخصصة للإدارة فقط</p>
        <Link to="/account" className="mt-4 inline-block text-sm font-semibold text-primary">
          تسجيل الدخول
        </Link>
      </div>
    );
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black">الأرباح</h1>
      <ProfitsPanel />
    </div>
  );
}
