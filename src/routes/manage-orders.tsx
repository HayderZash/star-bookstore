import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "./admin";

export const Route = createFileRoute("/manage-orders")({
  head: () => ({
    meta: [
      { title: "إدارة الطلبات | مكتبة النجم" },
      { name: "description", content: "متابعة طلبات زبائن مكتبة النجم وتحديث حالتها." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "إدارة الطلبات | مكتبة النجم" },
      { property: "og:description", content: "متابعة الطلبات وتحديث حالتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AdminPage ordersOnly />,
});
