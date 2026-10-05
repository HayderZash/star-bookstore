/** QR codes + invoice serial barcode for cashier receipts (pure JS, no DOM). */
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export const STORE_WEBSITE = "https://star-bookstore.netlify.app/";

/** Serial printed under the invoice barcode, e.g. NJ00000123. */
export const invoiceSerial = (saleNumber: number) => `NJ${String(saleNumber).padStart(8, "0")}`;

export function qrMatrix(text: string) {
  const m = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  return { size: m.size, on: (r: number, c: number) => !!m.data[r * m.size + c] };
}

/** CODE128 bars as a "1010…" string (1 = black module). */
export function barcodeBits(value: string) {
  const o: { encodings?: { data: string }[] } = {};
  JsBarcode(o, value, { format: "CODE128" });
  return (o.encodings ?? []).map((e) => e.data).join("");
}

export function qrSvg(text: string) {
  const { size, on } = qrMatrix(text);
  let d = "";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (on(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + 4} ${size + 4}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export function barcodeSvg(value: string) {
  const bits = barcodeBits(value);
  let d = "";
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") d += `M${i + 10} 0h1v40h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bits.length + 20} 40" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** Website / Facebook / Instagram QR targets (skips links that aren't set). */
export function receiptQrs(settings: Record<string, string>) {
  return [
    { label: "الموقع", text: STORE_WEBSITE },
    { label: "فيسبوك", text: settings["facebook_url"] ?? "" },
    { label: "إنستغرام", text: settings["instagram_url"] ?? "" },
  ].filter((q) => q.text.trim());
}
