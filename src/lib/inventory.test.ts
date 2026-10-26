import { describe, expect, test } from "bun:test";
import { formatInventoryPercent, inventoryPercent, inventorySummary } from "./inventory";

describe("inventory percentages", () => {
  const products = [
    { stock_qty: 1, category_id: "child" },
    { stock_qty: 2, category_id: "root" },
    { stock_qty: 0, category_id: "root" },
    { stock_qty: 3, category_id: null },
  ];
  test("each product uses all inventory units as its denominator", () => {
    expect(inventoryPercent(1, inventorySummary(products).totalUnits)).toBeCloseTo(16.6666667);
  });
  test("percentages include one decimal place", () => {
    expect(formatInventoryPercent(inventoryPercent(1, 6))).toBe("16.7%");
    expect(formatInventoryPercent(100)).toBe("100.0%");
  });
  test("total inventory and available product percentage include all products", () => {
    const summary = inventorySummary(products);
    expect(summary.totalUnits).toBe(6);
    expect(summary.availabilityPercent).toBe(75);
  });
  test("a category includes descendant stock without duplicating total stock", () => {
    const summary = inventorySummary(products, [{ id: "root", parent_id: null }, { id: "child", parent_id: "root" }]);
    expect(inventoryPercent(summary.categoryUnits.get("root") ?? 0, summary.totalUnits)).toBe(50);
    expect(summary.categoryUnits.get("child")).toBe(1);
    expect(summary.generalUnits).toBe(3);
    expect(summary.totalUnits).toBe(6);
  });
  test("empty inventory has a zero percentage, not NaN", () => {
    expect(formatInventoryPercent(inventoryPercent(0, 0))).toBe("0.0%");
    expect(inventorySummary([]).availabilityPercent).toBe(0);
  });
  test("negative stock is not counted as inventory", () => {
    expect(inventorySummary([{ stock_qty: -2, category_id: null }]).totalUnits).toBe(0);
  });
});