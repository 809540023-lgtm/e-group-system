/**
 * CSV 匯出工具。
 *
 * 稽核紀錄含使用者輸入（退款原因、異常回覆等），因此除了引號與逗號轉義，
 * 還必須中和以 = + - @ 或定位字元開頭的試算表公式，
 * 避免匯出檔在 Excel／Google Sheets 開啟時被當成公式執行（CSV injection）。
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  return `\uFEFF${lines.join('\n')}\n`;
}
