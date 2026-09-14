// Robust Web Bluetooth thermal-printer helper (ESC/POS over BLE).
// Handles the common reasons "can't connect": wrong service UUID filter,
// missing GATT connect, missing secure-context / browser checks.

export interface BtPrinter {
  device: any;
  characteristic: any;
}

let cached: BtPrinter | null = null;

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

export function bluetoothSecureContextOk(): boolean {
  // Web Bluetooth requires HTTPS or localhost.
  if (typeof window === 'undefined') return true;
  return window.isSecureContext;
}

// Common thermal-printer BLE service UUIDs. Requesting a broad list is
// critical: if the printer doesn't advertise the single UUID you pass,
// Chrome won't even show it in the picker.
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // common printer service
  '0000ff00-0000-1000-8000-00805f9b34fb', // HM-10 / generic serial
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // GATT serial (Nordic-ish clones)
  '6e400001-b5a3-3936-9a0a-8ccc9a70c638', // Nordic UART
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
];

function uuid16(n: number) {
  return n; // allow 16-bit shortcuts
}

export async function connectBtPrinter(onDisconnect?: () => void): Promise<BtPrinter> {
  if (!bluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported. Use Chrome/Edge on Android or desktop with Bluetooth enabled.');
  }
  if (!bluetoothSecureContextOk()) {
    throw new Error('Web Bluetooth needs HTTPS or localhost. Open the app via HTTPS (or http://localhost) and try again.');
  }

  // acceptAllDevices=true lets the user pick any nearby printer.
  // optionalServices must cover the printer's service or GATT connect will be blocked.
  const device: any = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });

  device.addEventListener?.('gattserverdisconnected', () => {
    cached = null;
    onDisconnect?.();
  });

  const server = await device.gatt.connect();

  // Find a writable characteristic: try known services first, then sweep all.
  let characteristic: any = null;
  const tryServices = [...PRINTER_SERVICES];
  // Also include already-available UUIDs reported by the device (Chrome exposes device.uuids sometimes)
  const advertised: string[] = device.uuids || [];
  for (const u of advertised) {
    if (!tryServices.includes(u)) tryServices.push(u);
  }

  let lastErr: any = null;
  for (const svcUuid of tryServices) {
    try {
      const svc = await server.getPrimaryService(svcUuid);
      const chars = await svc.getCharacteristics();
      // Prefer write / writeWithoutResponse
      characteristic =
        chars.find((c: any) => c.properties.writeWithoutResponse || c.properties.write) || chars[0];
      if (characteristic) break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!characteristic) {
    try { server.disconnect(); } catch {}
    throw new Error(
      'Connected to Bluetooth device but found no writable characteristic. ' +
      'This printer may use Classic Bluetooth (SPP), not BLE — pair it in system settings and use "System Print Dialog (USB)" mode instead.' +
      (lastErr ? ` (${lastErr?.message || lastErr})` : '')
    );
  }

  cached = { device, characteristic };
  return cached;
}

export function getBtPrinter(): BtPrinter | null {
  return cached;
}

export function disconnectBtPrinter() {
  try { cached?.device?.gatt?.disconnect(); } catch {}
  cached = null;
}

// --- ESC/POS building ---
const enc = new TextEncoder();
function esc(...bytes: number[]) { return new Uint8Array(bytes); }
function text(s: string) { return enc.encode(s); }
function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function buildReceiptBytes(o: {
  store: string; header?: string; footer?: string;
  orderId: string; date: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number; discount: number; total: number; currency: string;
  widthChars?: 32;
}): Uint8Array {
  const W = o.widthChars || 32;
  const line = '-'.repeat(W) + '\n';
  const row = (l: string, r: string) => {
    const space = Math.max(1, W - l.length - r.length);
    return l + ' '.repeat(space) + r + '\n';
  };
  const center = (s: string) => {
    const pad = Math.max(0, Math.floor((W - s.length) / 2));
    return ' '.repeat(pad) + s + '\n';
  };
  return concat(
    esc(0x1b, 0x40),            // init
    esc(0x1b, 0x61, 0x01),      // center
    esc(0x1b, 0x45, 0x01), text(o.store + '\n'), esc(0x1b, 0x45, 0x00),
    esc(0x1b, 0x61, 0x00),      // left
    o.header ? text(o.header + '\n') : new Uint8Array(0),
    text(`Order: ${o.orderId}\n${o.date}\n`),
    text(line),
    concat(...o.items.map(i => text(`${i.qty}x ${i.name}\n${row('', `${o.currency}${(i.price * i.qty).toFixed(2)}`)}`))),
    text(line),
    text(row('Subtotal', `${o.currency}${o.subtotal.toFixed(2)}`)),
    o.discount > 0 ? text(row('Discount', `-${o.currency}${o.discount.toFixed(2)}`)) : new Uint8Array(0),
    esc(0x1b, 0x45, 0x01), text(row('TOTAL', `${o.currency}${o.total.toFixed(2)}`)), esc(0x1b, 0x45, 0x00),
    o.footer ? text(`\n${center(o.footer)}`) : new Uint8Array(0),
    text('\n\n\n'),
    esc(0x1d, 0x56, 0x01),      // cut
  );
}

export async function printReceiptBle(order: {
  store: string; header?: string; footer?: string;
  orderId: string; date: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number; discount: number; total: number; currency: string;
}): Promise<void> {
  if (!cached) throw new Error('Printer not connected. Tap the Bluetooth icon first.');
  const data = buildReceiptBytes(order);
  // BLE MTU is small — chunk writes (20 bytes safest, 100+ often works with writeWithoutResponse)
  const CHUNK = 100;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if (cached.characteristic.properties?.writeWithoutResponse) {
      await cached.characteristic.writeValueWithoutResponse(chunk);
    } else {
      await cached.characteristic.writeValue(chunk);
    }
    // tiny delay to avoid overflowing cheap printers
    await new Promise(r => setTimeout(r, 20));
  }
}
