export type InventoryReportProduct = {
  id: string;
  sku: string;
  barcode?: string | null;
  name_ar: string;
  category_id: string | null;
  image_url: string | null;
  images?: string[] | null;
  cost_price?: number;
  price: number;
  stock_qty: number;
};

export function inventoryReportRows(
  categories: { id: string; name_ar: string }[],
  products: InventoryReportProduct[],
) {
  const names = new Map(categories.map((category) => [category.id, category.name_ar]));
  return products.filter((product) => product.stock_qty > 0).map((product) => ({
    id: product.id,
    category: names.get(product.category_id ?? "") ?? "",
    sku: product.sku,
    barcode: product.barcode ?? "",
    name: product.name_ar,
    imageUrl: product.image_url || product.images?.[0] || null,
    cost: product.cost_price ?? 0,
    price: product.price,
    quantity: product.stock_qty,
    totalCost: (product.cost_price ?? 0) * product.stock_qty,
    totalPrice: product.price * product.stock_qty,
  })).sort((a, b) => a.category.localeCompare(b.category, "ar") || a.name.localeCompare(b.name, "ar"));
}

export type InventoryReportRow = ReturnType<typeof inventoryReportRows>[number];

export function inventoryReportTotals(rows: InventoryReportRow[]) {
  return rows.reduce((totals, row) => ({
    quantity: totals.quantity + row.quantity,
    cost: totals.cost + row.totalCost,
    price: totals.price + row.totalPrice,
  }), { quantity: 0, cost: 0, price: 0 });
}