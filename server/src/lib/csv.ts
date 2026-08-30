/** Minimal, dependency-free CSV serializer with RFC-4180 escaping. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(',')).join('\r\n');
  return body ? `${head}\r\n${body}\r\n` : `${head}\r\n`;
}
