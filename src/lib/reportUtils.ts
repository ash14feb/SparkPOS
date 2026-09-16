import { dayBoundsInTimezone, dbTimeMs, todayInTimezone } from './datetime';

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayRange(settings?: any) {
  const t = todayInTimezone(settings);
  return { start: t, end: t };
}

export function inDateRange(ts: any, start: string, end: string, settingsOrTz?: any) {
  const t = dbTimeMs(ts);
  const s = dayBoundsInTimezone(start, settingsOrTz).start;
  const e = dayBoundsInTimezone(end, settingsOrTz).end;
  return t >= s && t <= e;
}

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport(title: string, tableHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<html><head><title>${title}</title>
    <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}th{background:#f3f4f6}h1{font-size:18px}</style>
    </head><body><h1>${title}</h1>${tableHtml}
    <script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}

export function paginate<T>(rows: T[], page: number, perPage: number) {
  const total = Math.ceil(rows.length / perPage) || 1;
  const p = Math.min(Math.max(1, page), total);
  return { page: p, total, slice: rows.slice((p - 1) * perPage, p * perPage) };
}
