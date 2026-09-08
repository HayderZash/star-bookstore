import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DealsTicker } from "@/components/DealsTicker";
import { NewsCarousel } from "@/components/NewsCarousel";
import { Pagination } from "@/components/Pagination";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { discountPercent } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { categoryPathLabel } from "@/lib/category-path";
import { localized, useLang } from "@/lib/i18n";
import {
  bannersQuery,
  categoriesQuery,
  popularProductIdsQuery,
  productsQuery,
  settingsQuery,
} from "@/lib/queries";
import { rotationSeed, seededShuffle } from "@/lib/shuffle";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مكتبة النجم | قرطاسية وكتب ولوازم مدرسية" },
      {
        name: "description",
        content:
          "تسوق الكتب والقرطاسية واللوازم المدرسية والمكتبية وأدوات الرسم مع توصيل لكل محافظات العراق.",
      },
      { property: "og:title", content: "مكتبة النجم | تسوق أونلاين في العراق" },
      {
        property: "og:description",
        content: "كتب، قرطاسية، لوازم مدرسية ومكتبية مع توصيل لجميع المحافظات.",
      },
    ],
  }),
  component: Home,
});

function Section({
  title,
  children,
  to,
}: {
  title: string;
  children: React.ReactNode;
  to?: { to: string; search?: Record<string, string> };
}) {
  const { t } = useLang();
  return (
    <section className="animate-rise mt-9">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="relative text-lg font-bold ps-3 before:absolute before:top-1/2 before:start-0 before:h-5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:gradient-warm">
          {title}
        </h2>
        {to && (
          <Link
            to="/search"
            search={to.search ?? {}}
            className="group flex items-center gap-0.5 text-sm font-medium text-primary"
          >
            {t("viewAll")}
            <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-1 rtl:rotate-0 ltr:rotate-180" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function Home() {
  const { lang, t } = useLang();
  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);
  const banners = useQuery(bannersQuery);

  const settings = useQuery(settingsQuery);
  const popularIds = useQuery(popularProductIdsQuery);
  const [bump, setBump] = useState(0);
  const [page, setPage] = useState(1);

  const all = products.data ?? [];
  const rotateHours = Number(settings.data?.["home_rotate_hours"] ?? 6) || 6;
  const PER_PAGE = 20;
  const PAGES = 5;

  const picks = useMemo(
    () => seededShuffle(all, rotationSeed(rotateHours) + bump * 7919).slice(0, PER_PAGE * PAGES),
    [all, rotateHours, bump],
  );
  const totalPages = Math.max(1, Math.ceil(picks.length / PER_PAGE));
  const pageItems = picks.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const popular = (popularIds.data ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 8);

  const deals = all.filter((p) => discountPercent(p) > 0).slice(0, 8);
  const lastPieces = all.filter((p) => p.stock_qty > 0 && p.stock_qty <= 2).slice(0, 8);
  const featured = all.filter((p) => p.is_featured).slice(0, 8);
  const roots = (categories.data ?? []).filter((c) => !c.parent_id);
  const catPath = (id: string | null) => categoryPathLabel(lang, categories.data ?? [], id);


  return (
    <div>
      <h1 className="sr-only">مكتبة النجم — كتب وقرطاسية ولوازم مدرسية</h1>

      <section className="animate-rise grid gap-3 md:grid-cols-3">
        <div className="gradient-hero relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-lift)] md:col-span-2 md:p-8">
          <span className="pointer-events-none absolute -top-16 -end-10 size-48 rounded-full bg-brand-yellow/25 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-20 -start-10 size-56 rounded-full bg-brand-blue/30 blur-2xl" />
          <img
            src={najmLogo.url}
            alt=""
            aria-hidden
            className="animate-float absolute end-6 bottom-4 hidden w-24 opacity-90 sm:block"
          />
          <p className="text-xs font-semibold tracking-wide opacity-80">
            {lang === "ar" ? "أهلاً بك في" : "Welcome to"}
          </p>
          <h2 className="mt-1 text-3xl font-extrabold md:text-4xl">
            <span className="text-shine">مكتبة النجم</span>
          </h2>
          <p className="mt-3 max-w-md text-sm opacity-90">
            {lang === "ar"
              ? "كتب وقرطاسية ولوازم مدرسية ومكتبية بأسعار مناسبة، مع توصيل لكل محافظات العراق."
              : "Books, stationery and school supplies, delivered across Iraq."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/categories"
              className="rounded-full bg-background px-5 py-2.5 text-sm font-bold text-primary transition-transform hover:scale-105"
            >
              {t("categories")}
            </Link>
            <Link
              to="/deals"
              className="rounded-full border border-primary-foreground/40 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-primary-foreground/15"
            >
              {t("deals")}
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="gradient-warm card-lift rounded-3xl p-5 text-warning-foreground">
            <p className="text-2xl font-extrabold">{all.length}+</p>
            <p className="text-sm font-semibold opacity-80">
              {lang === "ar" ? "منتج متوفر الآن" : "products available"}
            </p>
          </div>
          <div className="gradient-fresh card-lift rounded-3xl p-5 text-primary-foreground">
            <p className="text-2xl font-extrabold">{roots.length}</p>
            <p className="text-sm font-semibold opacity-90">
              {lang === "ar" ? "قسم للتسوق" : "categories to explore"}
            </p>
          </div>
        </div>
      </section>

      {banners.data && banners.data.length > 0 && (
        <div className="animate-rise mt-4">
          <NewsCarousel items={banners.data as never} />
        </div>
      )}

      <DealsTicker products={all as never} />

      {roots.length > 0 && (
        <Section title={t("shopByCategory")}>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {roots.map((c) => (
              <Link
                key={c.id}
                to="/search"
                search={{ cat: c.id }}
                className="group flex w-24 shrink-0 flex-col items-center gap-2"
              >
                <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-sand transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-[var(--shadow-card)]">
                  <CategoryIcon
                    icon={c.icon}
                    imageUrl={c.image_url}
                    fallback={localized(lang, c.name_ar, c.name_en).charAt(0)}
                  />
                </span>
                <span className="line-clamp-2 text-center text-xs font-medium transition-colors group-hover:text-primary">
                  {localized(lang, c.name_ar, c.name_en)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}


      {products.isLoading && (
        <Section title={t("latest")}>
          <Grid>
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </Grid>
        </Section>
      )}

      {featured.length > 0 && (
        <Section title={t("featured")}>
          <Grid>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} categoryPath={catPath(p.category_id)} />
            ))}
          </Grid>
        </Section>
      )}

      {popular.length > 0 && (
        <Section title="الأكثر طلباً">
          <Grid>
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} categoryPath={catPath(p.category_id)} />
            ))}
          </Grid>
        </Section>
      )}

      {picks.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">تشكيلة مختارة</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBump((b) => b + 1);
                setPage(1);
              }}
            >
              <RefreshCw className="size-4" /> تغيير المعروض
            </Button>
          </div>
          <Grid>
            {pageItems.map((p) => (
              <ProductCard key={p.id} product={p} categoryPath={catPath(p.category_id)} />
            ))}
          </Grid>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </section>
      )}


      {deals.length > 0 && (
        <Section title={t("deals")}>
          <Grid>
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} categoryPath={catPath(p.category_id)} />
            ))}
          </Grid>
        </Section>
      )}

      {lastPieces.length > 0 && (
        <Section title={t("lastPieces")}>
          <Grid>
            {lastPieces.map((p) => (
              <ProductCard key={p.id} product={p} categoryPath={catPath(p.category_id)} />
            ))}
          </Grid>
        </Section>
      )}

      {!products.isLoading && all.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
      )}
    </div>
  );
}
