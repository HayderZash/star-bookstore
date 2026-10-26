import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { formatInventoryPercent, inventoryPercent, inventorySummary } from "./inventory";

describe("inventory percentages", () => {
  const products = [
    { stock_qty: 1, category_id: "child" },
    { stock_qty: 2, category_id: "root" },
    { stock_qty: 0, category_id: "root" },
    { stock_qty: 3, category_id: null },
  ];
  test("each product uses all inventory units as its denominator", () => {
    assert.ok(Math.abs(inventoryPercent(1, inventorySummary(products).totalUnits) - 16.6666667) < 0.00001);
  });
  test("percentages include one decimal place", () => {
    assert.equal(formatInventoryPercent(inventoryPercent(1, 6)), "16.7%");
    assert.equal(formatInventoryPercent(100), "100.0%");
  });
  test("total inventory and available product percentage include all products", () => {
    const summary = inventorySummary(products);
    assert.equal(summary.totalUnits, 6);
    assert.equal(summary.availabilityPercent, 75);
  });
  test("a category includes descendant stock without duplicating total stock", () => {
    const summary = inventorySummary(products, [{ id: "root", parent_id: null }, { id: "child", parent_id: "root" }]);
    assert.equal(inventoryPercent(summary.categoryUnits.get("root") ?? 0, summary.totalUnits), 50);
    assert.equal(summary.categoryUnits.get("child"), 1);
    assert.equal(summary.generalUnits, 3);
    assert.equal(summary.totalUnits, 6);
  });
  test("empty inventory has a zero percentage, not NaN", () => {
    assert.equal(formatInventoryPercent(inventoryPercent(0, 0)), "0.0%");
    assert.equal(inventorySummary([]).availabilityPercent, 0);
  });
  test("negative stock is not counted as inventory", () => {
    assert.equal(inventorySummary([{ stock_qty: -2, category_id: null }]).totalUnits, 0);
  });
});