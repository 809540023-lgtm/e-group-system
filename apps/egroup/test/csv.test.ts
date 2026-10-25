import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../src/lib/csv.ts';

describe('csvCell', () => {
  it('一般文字原樣輸出', () => {
    expect(csvCell('order.create')).toBe('order.create');
  });

  it('null 與 undefined 輸出空字串', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('含逗號、引號或換行的欄位加上引號並轉義', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('中和試算表公式注入', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
  });

  it('公式字元出現在中間時不處理', () => {
    expect(csvCell('a=b')).toBe('a=b');
  });

  it('公式與逗號同時出現時先中和再加引號', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });
});

describe('toCsv', () => {
  it('加上 BOM 與結尾換行', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('\uFEFFa,b\n1,2\n');
  });

  it('沒有資料列時只有表頭', () => {
    expect(toCsv(['a'], [])).toBe('\uFEFFa\n');
  });
});
