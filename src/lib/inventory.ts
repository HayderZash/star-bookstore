type StockProduct = { stock_qty: number; category_id: string | null };
type StockCategory = { id: string; parent_id: string | null };

export function stockUnits(qty: number) {
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}

export function inventoryPercent(units: number, total: number) {
  return total > 0 ? (stockUnits(units) / total) * 100 : 0;
}

export function formatInventoryPercent(percent: number) {
  return `${percent.toFixed(1)}%`;
}

/** Count main stock once; variant quantities are allocations, not extra units. */
export function inventorySummary(products: readonly StockProduct[], categories: readonly StockCategory[] = []) {
  const totalUnits = products.reduce((sum, p) => sum + stockUnits(p.stock_qty), 0);
  const availableProducts = products.filter((p) => stockUnits(p.stock_qty) > 0).length;
  const categoryUnits = new Map<string, number>();
  const parents = new Map(categories.map((c) => [c.id, c.parent_id]));
  let generalUnits = 0;
  for (const product of products) {
    const units = stockUnits(product.stock_qty);
    if (!product.category_id) generalUnits += units;
    let id = product.category_id;
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      categoryUnits.set(id, (categoryUnits.get(id) ?? 0) + units);
      id = parents.get(id) ?? null;
    }
  }
  return {
    totalUnits,
    availableProducts,
    availabilityPercent: inventoryPercent(availableProducts, products.length),
    categoryUnits,
    generalUnits,
  };
}