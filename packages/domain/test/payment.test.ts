import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  decideDuplicatePayment,
  decideRefundRetry,
  ecpayCheckMacValue,
  parseFormBody,
  sha256Hex,
  verifyEcpayNotification,
} from '../src/payment.ts';

describe('sha256 純 JS 實作', () => {
  it('符合 FIPS 180-4 標準測試向量', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('與 node:crypto 結果一致（含多位元組與長輸入）', () => {
    const samples = ['日本日貨代購', 'a'.repeat(1000), 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), '混合 mixed 內容 123'];
    for (const sample of samples) {
      expect(sha256Hex(sample)).toBe(createHash('sha256').update(sample, 'utf8').digest('hex'));
    }
  });
});

describe('ECPay CheckMacValue', () => {
  const hashKey = 'pwFHCqoQZGmho4w6';
  const hashIv = 'EkRm7iFT261dpevs';

  it('與獨立實作（node:crypto）結果一致', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'Test1234567890',
      MerchantTradeDate: '2021/01/01 00:00:00',
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試',
      ItemName: '測試商品',
      ReturnURL: 'https://example.com/return',
      ChoosePayment: 'ALL',
      EncryptType: '1',
    };

    const sortedKeys = Object.keys(params).sort((a, b) =>
      a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0,
    );
    const body = sortedKeys.map((k) => `${k}=${params[k as keyof typeof params]}`).join('&');
    const raw = `HashKey=${hashKey}&${body}&HashIV=${hashIv}`;
    const encoded = encodeURIComponent(raw)
      .toLowerCase()
      .replace(/%20/g, '+')
      .replace(/%2d/g, '-')
      .replace(/%5f/g, '_')
      .replace(/%2e/g, '.')
      .replace(/%21/g, '!')
      .replace(/%2a/g, '*')
      .replace(/%28/g, '(')
      .replace(/%29/g, ')');
    const expected = createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();

    expect(ecpayCheckMacValue(params, hashKey, hashIv)).toBe(expected);
  });

  it('輸出為 64 位大寫十六進位', () => {
    const mac = ecpayCheckMacValue({ A: '1', B: '2' }, hashKey, hashIv);
    expect(mac).toMatch(/^[0-9A-F]{64}$/);
  });

  it('參數順序不影響結果（依 key 排序）', () => {
    const a = ecpayCheckMacValue({ B: '2', A: '1' }, hashKey, hashIv);
    const b = ecpayCheckMacValue({ A: '1', B: '2' }, hashKey, hashIv);
    expect(a).toBe(b);
  });

  it('大小寫不同的 key 視為相同排序', () => {
    const a = ecpayCheckMacValue({ abc: '1', ABD: '2' }, hashKey, hashIv);
    const b = ecpayCheckMacValue({ ABD: '2', abc: '1' }, hashKey, hashIv);
    expect(a).toBe(b);
  });

  it('不同 HashKey 產生不同結果', () => {
    expect(ecpayCheckMacValue({ A: '1' }, hashKey, hashIv)).not.toBe(
      ecpayCheckMacValue({ A: '1' }, 'otherKey', hashIv),
    );
  });
});

describe('parseFormBody', () => {
  it('解析表單編碼並還原加號與百分比編碼', () => {
    const body = Buffer.from('A=1&B=hello+world&C=%E6%B8%AC%E8%A9%A6', 'utf8');
    expect(parseFormBody(body)).toEqual({ A: '1', B: 'hello world', C: '測試' });
  });

  it('拒絕重複欄位（參數污染）', () => {
    expect(() => parseFormBody(Buffer.from('A=1&A=2', 'utf8'))).toThrow(AppError);
  });

  it('空 body 回傳空物件', () => {
    expect(parseFormBody(Buffer.from('', 'utf8'))).toEqual({});
  });

  it('無等號的欄位視為空值', () => {
    expect(parseFormBody(Buffer.from('FLAG', 'utf8'))).toEqual({ FLAG: '' });
  });
});

describe('verifyEcpayNotification', () => {
  const hashKey = 'pwFHCqoQZGmho4w6';
  const hashIv = 'EkRm7iFT261dpevs';

  function buildBody(overrides: Record<string, string> = {}): Buffer {
    const params: Record<string, string> = {
      MerchantID: '3002607',
      MerchantTradeNo: 'JP20261009001',
      TradeNo: '2401011234567890',
      TradeAmt: '1198',
      RtnCode: '1',
      PaymentDate: '2026/10/09 12:00:00',
      SimulatePaid: '0',
      ...overrides,
    };
    const mac = ecpayCheckMacValue(params, hashKey, hashIv);
    const all = { ...params, CheckMacValue: mac };
    return Buffer.from(
      Object.entries(all)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&'),
      'utf8',
    );
  }

  const base = {
    hashKey,
    hashIv,
    expectedMerchantId: '3002607',
    expectedMerchantTradeNo: 'JP20261009001',
    expectedAmountTwd: 1198,
    allowSimulated: false,
  };

  it('驗證通過並回傳事件鍵', () => {
    const result = verifyEcpayNotification({ ...base, rawBody: buildBody() });
    expect(result.success).toBe(true);
    expect(result.amountTwd).toBe(1198);
    expect(result.providerTradeNo).toBe('2401011234567890');
    expect(result.eventKey).toBe('2401011234567890:1:2026/10/09 12:00:00');
  });

  it('缺少 CheckMacValue 被拒', () => {
    expect(() =>
      verifyEcpayNotification({ ...base, rawBody: Buffer.from('MerchantID=3002607', 'utf8') }),
    ).toThrow(AppError);
  });

  it('簽章被竄改被拒', () => {
    const body = buildBody();
    const tampered = Buffer.from(body.toString('utf8').replace(/CheckMacValue=[^&]*/, 'CheckMacValue=DEADBEEF'), 'utf8');
    expect(() => verifyEcpayNotification({ ...base, rawBody: tampered })).toThrow(AppError);
  });

  it('金額不符被拒', () => {
    expect(() => verifyEcpayNotification({ ...base, rawBody: buildBody({ TradeAmt: '9999' }) })).toThrow(AppError);
  });

  it('特店編號不符被拒', () => {
    expect(() => verifyEcpayNotification({ ...base, rawBody: buildBody({ MerchantID: '9999999' }) })).toThrow(AppError);
  });

  it('訂單編號不符被拒', () => {
    expect(() =>
      verifyEcpayNotification({ ...base, rawBody: buildBody({ MerchantTradeNo: 'OTHER' }) }),
    ).toThrow(AppError);
  });

  it('正式環境拒絕模擬付款', () => {
    expect(() => verifyEcpayNotification({ ...base, rawBody: buildBody({ SimulatePaid: '1' }) })).toThrow(AppError);
    expect(() =>
      verifyEcpayNotification({ ...base, allowSimulated: true, rawBody: buildBody({ SimulatePaid: '1' }) }),
    ).not.toThrow();
  });

  it('失敗交易仍回傳 success=false 供記錄', () => {
    const result = verifyEcpayNotification({ ...base, rawBody: buildBody({ RtnCode: '0' }) });
    expect(result.success).toBe(false);
  });
});

describe('重複付款與退款重試決策', () => {
  it('未付款時套用', () => {
    expect(
      decideDuplicatePayment({ existingProviderTradeNo: null, incomingProviderTradeNo: 'T1', orderAlreadyPaid: false }),
    ).toEqual({ action: 'apply' });
  });

  it('同一平臺交易重送不重複扣庫存', () => {
    expect(
      decideDuplicatePayment({ existingProviderTradeNo: 'T1', incomingProviderTradeNo: 'T1', orderAlreadyPaid: true }),
    ).toEqual({ action: 'ignore_duplicate' });
  });

  it('不同交易號重複付同一訂單轉財務核對', () => {
    const decision = decideDuplicatePayment({
      existingProviderTradeNo: 'T1',
      incomingProviderTradeNo: 'T2',
      orderAlreadyPaid: true,
    });
    expect(decision.action).toBe('finance_review');
  });

  it('退款未知結果先查平臺，不以新交易號重送', () => {
    expect(decideRefundRetry({ status: 'unknown', reason: 'timeout' })).toBe('query_provider');
    expect(decideRefundRetry({ status: 'pending', refundTradeNo: 'R1' })).toBe('query_provider');
    expect(decideRefundRetry({ status: 'failed', reason: 'rejected' })).toBe('retry_same_key');
    expect(decideRefundRetry({ status: 'completed', refundTradeNo: 'R1', amountTwd: 100 })).toBe('stop');
  });
});
