// Bill data encoded directly in the URL hash (base64url).
// Payload is gzip-compressed via CompressionStream so the link stays short.
// No backend needed — the customer opens the link on their own phone
// and the bill renders purely client-side.

export interface BillLinkData {
  s: string;   // store name
  h?: string;  // receipt header
  f?: string;  // receipt footer
  id: string;  // order id
  ts: number;  // timestamp
  items: { n: string; q: number; p: number }[];
  sub: number;
  disc: number;
  tot: number;
  cur: string;
  pm?: string; // payment mode
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as any]).stream().pipeThrough(new (window as any).CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as any]).stream().pipeThrough(new (window as any).DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const r2 = (n: number) => Math.round(Number(n) * 100) / 100;

/** Slim the payload down before encoding (drop empties, round numbers). */
function slim(d: BillLinkData): BillLinkData {
  const out: BillLinkData = {
    s: d.s,
    id: d.id,
    ts: d.ts,
    items: d.items.map(i => ({ n: i.n, q: i.q, p: r2(i.p) })),
    sub: r2(d.sub),
    disc: r2(d.disc),
    tot: r2(d.tot),
    cur: d.cur,
  };
  if (d.h) out.h = d.h;
  if (d.f) out.f = d.f;
  if (d.pm) out.pm = d.pm;
  return out;
}

export async function encodeBill(data: BillLinkData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(slim(data)));
  try {
    // 'z.' = gzipped payload
    return 'z.' + bytesToB64url(await gzip(json));
  } catch {
    return 'j.' + bytesToB64url(json);
  }
}

export async function decodeBill(hash: string): Promise<BillLinkData | null> {
  try {
    if (hash.startsWith('z.')) {
      const bytes = await gunzip(b64urlToBytes(hash.slice(2)));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    const raw = hash.startsWith('j.') ? hash.slice(2) : hash;
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(raw)));
  } catch {
    return null;
  }
}

export async function buildBillLink(data: BillLinkData): Promise<string> {
  return `${window.location.origin}/bill#${await encodeBill(data)}`;
}

/** Strip to digits for wa.me. Returns '' when no usable number. */
export function normalizePhone(phone: any): string {
  return String(phone || '').replace(/\D/g, '');
}

/** Short link for a bill, resolved by order id: <origin>/bill/<orderId> */
export function buildShortBillLink(orderId: string): string {
  return `${window.location.origin}/bill/${encodeURIComponent(orderId)}`;
}

/**
 * Map a backend bill/order payload to BillLinkData.
 * Accepts the POS order shape ({ id, items: [{name, qty, price}], ... })
 * as well as the compact BillLinkData shape.
 */
export function mapApiBillToBillData(b: any, fallbackStore = 'Intelli POS', fallbackCur = 'Rs.'): BillLinkData | null {
  try {
    const d = b?.data ?? b;
    if (!d) return null;
    if (Array.isArray(d.items) && d.items.length > 0 && typeof d.items[0] === 'object' && 'n' in d.items[0]) {
      return d as BillLinkData; // already compact shape
    }
    return {
      s: d.store || d.restaurantName || d.businessName || fallbackStore,
      h: d.header || d.receiptHeader,
      f: d.footer || d.receiptFooter,
      id: String(d.id || d.order_code || d.orderId || ''),
      ts: Number(d.timestamp || d.ts || (d.created_at ? Date.parse(d.created_at) : Date.now())),
      items: (Array.isArray(d.items) ? d.items : JSON.parse(d.items || '[]')).map((i: any) => ({
        n: String(i.name ?? i.n ?? ''),
        q: Number(i.qty ?? i.q ?? i.quantity ?? 1),
        p: Number(i.price ?? i.p ?? 0),
      })),
      sub: Number(d.subtotal ?? d.sub ?? 0),
      disc: Number(d.discount ?? d.disc ?? 0),
      tot: Number(d.total ?? d.tot ?? 0),
      cur: d.currency || d.currencySymbol || fallbackCur,
      pm: d.paymentMode || d.payment_mode || d.pm,
    };
  } catch {
    return null;
  }
}
