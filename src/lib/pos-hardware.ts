/**
 * POS hardware bridge (browser only): ESC/POS thermal printer + cash drawer
 * over Web Serial or WebUSB. Works in Chrome/Edge on desktop over HTTPS.
 *
 * - Printer: receipts are rasterised on a canvas (so Arabic renders correctly)
 *   and sent with `GS v 0`, then paper is cut.
 * - Drawer: the standard ESC/POS kick pulse `ESC p m t1 t2` is sent either to a
 *   dedicated drawer device (USB/serial trigger box) or through the printer's
 *   RJ11 drawer port.
 */

import { barcodeBits, qrMatrix } from "./receipt-codes";

type Writer = { write: (data: Uint8Array) => Promise<void>; label: string; close: () => Promise<void> };
type Role = "printer" | "drawer";

// Minimal typings — Web Serial / WebUSB are not in the TS DOM lib.
type SerialPortLike = {
  open: (o: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: unknown;
  writable: { getWriter: () => { write: (d: Uint8Array) => Promise<void>; releaseLock: () => void } } | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};
type USBEndpointLike = { direction: "in" | "out"; endpointNumber: number; type: string };
type USBDeviceLike = {
  productName?: string;
  opened: boolean;
  configuration: { interfaces: { interfaceNumber: number; alternate: { endpoints: USBEndpointLike[] } }[] } | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  transferOut: (ep: number, data: Uint8Array) => Promise<unknown>;
};
type Nav = Navigator & {
  serial?: { requestPort: () => Promise<SerialPortLike>; getPorts: () => Promise<SerialPortLike[]> };
  usb?: { requestDevice: (o: { filters: unknown[] }) => Promise<USBDeviceLike>; getDevices: () => Promise<USBDeviceLike[]> };
};

const nav = () => (typeof navigator === "undefined" ? undefined : (navigator as Nav));
export const hasSerial = () => !!nav()?.serial;
export const hasUsb = () => !!nav()?.usb;

const STORE_KEY = (r: Role) => `pos-hw-${r}`;
const devices: Partial<Record<Role, Writer>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const onHardwareChange = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const deviceLabel = (r: Role) => devices[r]?.label ?? null;

export const ESC_POS = {
  init: [0x1b, 0x40],
  /** Kick drawer pin 2, 50ms on / 500ms off. */
  kickPin2: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  /** Kick drawer pin 5 (some drawers are wired here). */
  kickPin5: [0x1b, 0x70, 0x01, 0x19, 0xfa],
  feedAndCut: [0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00],
};

async function serialWriter(port: SerialPortLike, baudRate: number): Promise<Writer> {
  if (!port.writable) await port.open({ baudRate });
  const info = port.getInfo?.();
  return {
    label: `Serial${info?.usbVendorId ? ` ${info.usbVendorId.toString(16)}:${info.usbProductId?.toString(16)}` : ""}`,
    write: async (data) => {
      const w = port.writable!.getWriter();
      try {
        await w.write(data);
      } finally {
        w.releaseLock();
      }
    },
    close: () => port.close(),
  };
}

async function usbWriter(dev: USBDeviceLike): Promise<Writer> {
  if (!dev.opened) await dev.open();
  if (!dev.configuration) await dev.selectConfiguration(1);
  const iface = dev.configuration!.interfaces.find((i) =>
    i.alternate.endpoints.some((e) => e.direction === "out" && e.type === "bulk"),
  );
  if (!iface) throw new Error("لم يتم العثور على منفذ إرسال في جهاز USB");
  await dev.claimInterface(iface.interfaceNumber);
  const ep = iface.alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk")!;
  return {
    label: dev.productName || "USB",
    write: async (data) => {
      // Chunk large raster jobs for printers with small buffers.
      for (let i = 0; i < data.length; i += 4096) await dev.transferOut(ep.endpointNumber, data.slice(i, i + 4096));
    },
    close: () => dev.close(),
  };
}

export async function connectDevice(role: Role, kind: "serial" | "usb", baudRate = 9600) {
  const n = nav();
  if (kind === "serial") {
    if (!n?.serial) throw new Error("المتصفح لا يدعم Web Serial — استخدم Chrome أو Edge على الحاسوب");
    devices[role] = await serialWriter(await n.serial.requestPort(), baudRate);
  } else {
    if (!n?.usb) throw new Error("المتصفح لا يدعم WebUSB — استخدم Chrome أو Edge على الحاسوب");
    devices[role] = await usbWriter(await n.usb.requestDevice({ filters: [] }));
  }
  localStorage.setItem(STORE_KEY(role), JSON.stringify({ kind, baudRate }));
  emit();
}

export async function disconnectDevice(role: Role) {
  try {
    await devices[role]?.close();
  } catch {
    /* ignore */
  }
  delete devices[role];
  localStorage.removeItem(STORE_KEY(role));
  emit();
}

/** Re-attach previously authorised devices silently after a page reload. */
export async function restoreDevices() {
  const n = nav();
  for (const role of ["printer", "drawer"] as Role[]) {
    if (devices[role]) continue;
    const raw = localStorage.getItem(STORE_KEY(role));
    if (!raw) continue;
    try {
      const { kind, baudRate } = JSON.parse(raw) as { kind: "serial" | "usb"; baudRate: number };
      if (kind === "serial" && n?.serial) {
        const [port] = await n.serial.getPorts();
        if (port) devices[role] = await serialWriter(port, baudRate);
      } else if (kind === "usb" && n?.usb) {
        const [dev] = await n.usb.getDevices();
        if (dev) devices[role] = await usbWriter(dev);
      }
    } catch {
      /* device unplugged — user can reconnect */
    }
  }
  emit();
}

/** Open the cash drawer: dedicated drawer device first, else via the printer. */
export async function openDrawer(): Promise<boolean> {
  const target = devices.drawer ?? devices.printer;
  if (!target) return false;
  await target.write(new Uint8Array([...ESC_POS.kickPin2, ...ESC_POS.kickPin5]));
  return true;
}

export type ReceiptLine = { name: string; qty: number; amount: string; note?: string };
export type ReceiptData = {
  title: string;
  subtitle: string[];
  lines: ReceiptLine[];
  totals: { label: string; value: string; bold?: boolean }[];
  footer: string;
  /** Invoice serial rendered as a CODE128 barcode. */
  barcode?: string;
  /** QR codes printed side by side to keep the paper short. */
  qrs?: { label: string; text: string }[];
};

const WIDTH = 576; // 80mm @ 203dpi (72mm printable)

/** Draw the receipt on a canvas and convert it to an ESC/POS raster image. */
export function receiptToEscPos(r: ReceiptData): Uint8Array {
  const pad = 8;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = 4000;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, canvas.height);
  ctx.fillStyle = "#000";
  ctx.direction = "rtl";
  let y = 10;
  const text = (s: string, size: number, align: CanvasTextAlign, bold = false, x?: number) => {
    ctx.font = `${bold ? "bold " : ""}${size}px Tahoma, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(s, x ?? (align === "center" ? WIDTH / 2 : align === "right" ? WIDTH - pad : pad), y + size);
  };
  const rule = () => {
    ctx.fillRect(pad, y + 4, WIDTH - pad * 2, 2);
    y += 14;
  };
  text(r.title, 34, "center", true);
  y += 44;
  for (const s of r.subtitle) {
    text(s, 22, "center");
    y += 30;
  }
  rule();
  for (const l of r.lines) {
    text(l.name, 24, "right", true);
    y += 32;
    text(`${l.qty} ×`, 22, "right");
    text(l.amount, 22, "left");
    y += 30;
    if (l.note) {
      text(l.note, 20, "right");
      y += 28;
    }
    y += 10; // gap between items
  }
  rule();
  for (const t of r.totals) {
    const size = t.bold ? 30 : 24;
    text(t.label, size, "right", t.bold);
    text(t.value, size, "left", t.bold);
    y += size + 10;
  }
  if (r.barcode) {
    y += 10;
    const bits = barcodeBits(r.barcode);
    const m = Math.max(1, Math.min(3, Math.floor((WIDTH - 40) / bits.length)));
    const x0 = Math.round((WIDTH - bits.length * m) / 2);
    for (let i = 0; i < bits.length; i++) if (bits[i] === "1") ctx.fillRect(x0 + i * m, y, m, 70);
    y += 74;
    text(r.barcode, 20, "center");
    y += 30;
  }
  if (r.qrs?.length) {
    y += 8;
    const cell = (WIDTH - pad * 2) / r.qrs.length;
    let tallest = 0;
    r.qrs.forEach((q, i) => {
      const { size, on } = qrMatrix(q.text);
      const m = Math.max(2, Math.floor(Math.min(150, cell - 20) / size));
      const px = size * m;
      // RTL: first QR on the right.
      const cx = WIDTH - pad - cell * i - cell / 2;
      const x0 = Math.round(cx - px / 2);
      for (let rr = 0; rr < size; rr++)
        for (let cc = 0; cc < size; cc++) if (on(rr, cc)) ctx.fillRect(x0 + cc * m, y + rr * m, m, m);
      ctx.font = "18px Tahoma, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(q.label, cx, y + px + 22);
      tallest = Math.max(tallest, px + 30);
    });
    y += tallest + 6;
  }
  y += 10;
  text(r.footer, 22, "center");
  y += 40;

  const height = y;
  const img = ctx.getImageData(0, 0, WIDTH, height).data;
  const bytesPerRow = WIDTH / 8;
  const raster = new Uint8Array(bytesPerRow * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < WIDTH; col++) {
      const i = (row * WIDTH + col) * 4;
      const lum = 0.299 * img[i]! + 0.587 * img[i + 1]! + 0.114 * img[i + 2]!;
      if (lum < 160) raster[row * bytesPerRow + (col >> 3)]! |= 0x80 >> (col & 7);
    }
  }
  const header = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, height & 0xff, height >> 8];
  return new Uint8Array([...ESC_POS.init, ...header, ...raster, ...ESC_POS.feedAndCut]);
}

/** Print directly on the connected thermal printer. Returns false if none. */
export async function printThermal(r: ReceiptData, kickDrawer: boolean): Promise<boolean> {
  const p = devices.printer;
  if (!p) return false;
  await p.write(receiptToEscPos(r));
  if (kickDrawer) await openDrawer();
  return true;
}

/**
 * Keyboard-wedge barcode scanner detector: scanners "type" fast and end with
 * Enter. Humans type much slower, so bursts under `maxGap` ms are scans.
 */
export function listenForScans(onScan: (code: string) => void, maxGap = 45, minLen = 4) {
  let buf = "";
  let last = 0;
  let target: HTMLInputElement | HTMLTextAreaElement | null = null;
  let before = "";
  const handler = (e: KeyboardEvent) => {
    const now = performance.now();
    if (now - last > maxGap) {
      buf = "";
      const t = e.target as HTMLElement | null;
      target = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement ? t : null;
      before = target?.value ?? "";
    }
    last = now;
    if (e.key === "Enter") {
      if (buf.length >= minLen) {
        e.preventDefault();
        e.stopPropagation();
        // Undo the characters the scanner typed into a focused text field.
        if (target && target.dataset["scanTarget"] === undefined) {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
          setter?.call(target, before);
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }
        onScan(buf);
      }
      buf = "";
      return;
    }
    if (e.key.length === 1) buf += e.key;
  };
  window.addEventListener("keydown", handler, true);
  return () => window.removeEventListener("keydown", handler, true);
}
