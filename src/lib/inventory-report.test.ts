import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inventoryReportRows, inventoryReportTotals } from "./inventory-report";

const product = { id: "p1", sku: "01", name_ar: "دفتر", category_id: "c1", image_url: "https://example.com/upload.jpg", cost_price: 1500, price: 2500, stock_qty: 4 };

describe("stocktaking report", () => {
  it("includes only products with positive available stock", () => {
    const rows = inventoryReportRows([], [product, { ...product, id: "empty", stock_qty: 0 }, { ...product, id: "negative", stock_qty: -1 }]);
    assert.deepEqual(rows.map((row) => row.id), ["p1"]);
  });
  it("calculates each selling total as unit price multiplied by quantity", () => {
    const [row] = inventoryReportRows([], [product]);
    assert.equal(row?.totalPrice, 10000);
  });
  it("calculates each base-cost total as unit cost multiplied by quantity", () => {
    const [row] = inventoryReportRows([], [product]);
    assert.equal(row?.totalCost, 6000);
  });
  it("uses the uploaded primary photo before additional photos", () => {
    const [row] = inventoryReportRows([], [{ ...product, images: ["https://example.com/extra.jpg"] }]);
    assert.equal(row?.imageUrl, "https://example.com/upload.jpg");
  });
  it("sums quantities and both stock valuations without counting variants again", () => {
    const rows = inventoryReportRows([], [product, { ...product, id: "p2", cost_price: 500, price: 1000, stock_qty: 2 }]);
    assert.deepEqual(inventoryReportTotals(rows), { quantity: 6, cost: 7000, price: 12000 });
  });
});