function toCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n');
}
