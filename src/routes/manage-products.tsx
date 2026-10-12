import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "./admin";

export const Route = createFileRoute("/manage-products")({
  head: () => ({
    meta: [
      { title: "إدارة المنتجات | مكتبة النجم" },
      { name: "description", content: "إضافة وتعديل منتجات مكتبة النجم ومخزونها." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "إدارة المنتجات | مكتبة النجم" },
      { property: "og:description", content: "إضافة وتعديل المنتجات والمخزون." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AdminPage productsOnly />,
});
