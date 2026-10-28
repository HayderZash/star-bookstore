import { inventoryReportTotals, type InventoryReportRow } from "./inventory-report";

const headers = ["صورة المنتج", "القسم", "الرمز", "الباركود", "المنتج", "السعر الأساس", "سعر المفرد", "العدد", "إجمالي الكلفة", "إجمالي سعر المنتج"];
type Photo = { data: string; width: number; height: number };
type PreparedRow = InventoryReportRow & { photo: Photo | null };

function loadPhoto(url: string): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timeout = window.setTimeout(() => { image.src = ""; reject(new Error("تعذر تحميل الصورة")); }, 15000);
    image.onerror = () => { clearTimeout(timeout); reject(new Error("تعذر تحميل الصورة")); };
    image.onload = () => {
      clearTimeout(timeout);
      try {
        const scale = Math.min(1, 180 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("تعذر تجهيز الصورة");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
      } catch (error) { reject(error); }
    };
    image.src = url;
  });
}

export async function prepareInventoryPhotos(rows: InventoryReportRow[], onProgress: (done: number) => void) {
  const prepared: PreparedRow[] = [];
  let failedPhotos = 0;
  for (let index = 0; index < rows.length; index += 4) {
    const batch = await Promise.all(rows.slice(index, index + 4).map(async (row) => {
      let photo: Photo | null = null;
      if (row.imageUrl) {
        try { photo = await loadPhoto(row.imageUrl); }
        catch { failedPhotos++; }
      }
      return { ...row, photo };
    }));
    prepared.push(...batch);
    onProgress(prepared.length);
  }
  return { rows: prepared, failedPhotos };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadInventoryExcel(rows: PreparedRow[], date: Date) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "مكتبة النجم";
  const sheet = workbook.addWorksheet("الجرد", { views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }] });
  sheet.columns = [18, 20, 16, 20, 36, 20, 20, 12, 22, 24].map((width) => ({ width }));
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = "مكتبة النجم — جرد المنتجات المتوفرة";
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.mergeCells("A2:J2");
  sheet.getCell("A2").value = `تاريخ الجرد: ${date.toLocaleDateString("ar-IQ")} — الأسعار بالدينار العراقي`;
  sheet.getRow(4).values = headers;
  sheet.getRow(4).font = { bold: true };
  rows.forEach((row, index) => {
    const number = index + 5;
    const excelRow = sheet.addRow([row.photo ? "" : row.imageUrl ? "تعذر تحميل الصورة" : "لا توجد صورة", row.category, row.sku, row.barcode, row.name, row.cost, row.price, row.quantity,
      { formula: `F${number}*H${number}`, result: row.totalCost },
      { formula: `G${number}*H${number}`, result: row.totalPrice }]);
    excelRow.height = 66;
    excelRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    [6, 7, 9, 10].forEach((column) => { excelRow.getCell(column).numFmt = '#,##0.##'; });
    if (row.photo) {
      const imageId = workbook.addImage({ base64: row.photo.data, extension: "png" });
      const scale = Math.min(84 / row.photo.width, 78 / row.photo.height);
      sheet.addImage(imageId, { tl: { col: 0.15, row: number - 1 + 0.08 }, ext: { width: row.photo.width * scale, height: row.photo.height * scale }, editAs: "oneCell" });
    }
  });
  const totals = inventoryReportTotals(rows);
  const totalRow = sheet.addRow(["الإجماليات", "", "", "", `عدد المنتجات: ${rows.length}`, "", "", totals.quantity, totals.cost, totals.price]);
  totalRow.font = { bold: true };
  sheet.autoFilter = { from: "A4", to: `J${rows.length + 4}` };
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:4" };
  const output = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([new Uint8Array(output)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `najm-inventory-${date.toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadInventoryPdf(rows: PreparedRow[], date: Date) {
  const { jsPDF } = await import("jspdf");
  const response = await fetch("/fonts/Amiri-Regular.ttf");
  if (!response.ok) throw new Error("تعذر تحميل الخط العربي، يرجى المحاولة مجدداً");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addFileToVFS("Amiri.ttf", btoa(binary));
  pdf.addFont("Amiri.ttf", "Amiri", "normal");
  pdf.setFont("Amiri");
  pdf.setProperties({ title: "جرد المخزون — مكتبة النجم", author: "مكتبة النجم" });
  // Columns progress from the right edge so Arabic labels and numbers remain independent.
  const widths = [24, 27, 22, 28, 47, 24, 24, 14, 28, 39];
  const cellText = (text: string, right: number, top: number, width: number, maxLines = 3) => {
    const rtl = /[\u0600-\u06ff]/.test(text);
    // jsPDF shapes Arabic automatically; reversing it again breaks the joined glyphs.
    pdf.setR2L(false);
    const lines = pdf.splitTextToSize(text, width - 3) as string[];
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1] ?? ""}…`;
    pdf.text(visible, rtl ? right - 1.5 : right - width / 2, top, { align: rtl ? "right" : "center" });
    pdf.setR2L(false);
  };
  const drawHeader = () => {
    pdf.setFontSize(18);
    cellText("مكتبة النجم — تقرير جرد المخزون", 287, 13, 277, 1);
    pdf.setFontSize(10);
    cellText(`تاريخ الجرد: ${date.toLocaleDateString("ar-IQ")} — الأسعار بالدينار العراقي`, 287, 22, 277, 1);
    pdf.setFontSize(9);
    let right = 287;
    headers.forEach((header, index) => {
      const width = widths[index] ?? 20;
      pdf.rect(right - width, 28, width, 14);
      cellText(header, right, 33, width, 2);
      right -= width;
    });
  };
  drawHeader();
  let y = 42;
  rows.forEach((row) => {
    if (y + 24 > 186) { pdf.addPage(); drawHeader(); y = 42; }
    const values = [row.photo ? "" : row.imageUrl ? "تعذر تحميل الصورة" : "لا توجد صورة", row.category, row.sku, row.barcode, row.name, row.cost, row.price, row.quantity, row.totalCost, row.totalPrice];
    let right = 287;
    values.forEach((value, index) => {
      const width = widths[index] ?? 20;
      pdf.rect(right - width, y, width, 24);
      cellText(typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value, right, y + 6, width);
      if (index === 0 && row.photo) {
        const scale = Math.min((width - 4) / row.photo.width, 20 / row.photo.height);
        const w = row.photo.width * scale;
        const h = row.photo.height * scale;
        pdf.addImage(row.photo.data, "PNG", right - width + (width - w) / 2, y + (24 - h) / 2, w, h);
      }
      right -= width;
    });
    y += 24;
  });
  if (y + 16 > 190) { pdf.addPage(); drawHeader(); y = 42; }
  const totals = inventoryReportTotals(rows);
  pdf.setFontSize(11);
  cellText(`عدد المنتجات: ${rows.length}    مجموع القطع: ${totals.quantity}`, 287, y + 7, 277, 1);
  cellText(`إجمالي الكلفة: ${totals.cost.toLocaleString("en-US")}    إجمالي سعر المنتجات: ${totals.price.toLocaleString("en-US")} د.ع`, 287, y + 14, 277, 1);
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 148.5, 203, { align: "center" });
  }
  downloadBlob(pdf.output("blob"), `najm-inventory-${date.toISOString().slice(0, 10)}.pdf`);
}