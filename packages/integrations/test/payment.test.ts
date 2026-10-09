import { describe, expect, it } from 'vitest';
import {
  ECPAY_STAGE_BASE,
  assertNotSimulatedInProduction,
  createEcpayAdapter,
  formatEcpayTradeDate,
  isSimulatedNotification,
  sanitizeMerchantTradeNo,
} from '../src/payment/index.ts';
import { createInvoiceAdapter, validateInvoiceCarrier } from '../src/invoice/index.ts';

const ENV = {
  ECPAY_MERCHANT_ID: '2000132',
  ECPAY_HASH_KEY: '5294y06JbISpM5x9',
  ECPAY_HASH_IV: 'v77hoKGq4kWxNNIS',
};

describe('ECPay adapter', () => {
  it('無憑證時 capability 為 integration_pending', () => {
    const adapter = createEcpayAdapter({ env: {} });
    const cap = adapter.capability();
    expect(cap.status).toBe('integration_pending');
    expect(cap.missingEnv).toContain('ECPAY_MERCHANT_ID');
    expect(cap.notes).toContain('不得宣稱可收款');
  });

  it('已設定憑證時 capability 為 ready 並顯示 API base', () => {
    const adapter = createEcpayAdapter({ env: ENV });
    const cap = adapter.capability();
    expect(cap.status).toBe('ready');
    expect(cap.notes).toContain(ECPAY_STAGE_BASE);
  });

  it('buildCheckoutForm 產生含 CheckMacValue 的導轉表單', () => {
    const adapter = createEcpayAdapter({ env: ENV });
    const result = adapter.buildCheckoutForm({
      merchantTradeNo: 'JP20260101-0001',
      amountTwd: 348,
      itemName: '測試商品',
      tradeDesc: '代購',
      returnUrl: 'https://example.com/api/webhooks/ecpay',
      clientBackUrl: 'https://example.com/checkout/result',
      choosePayment: 'Credit',
      idempotencyKey: 'k1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.action).toBe(`${ECPAY_STAGE_BASE}/Cashier/AioCheckOut/V5`);
    expect(result.value.fields.CheckMacValue).toMatch(/^[0-9A-F]{64}$/);
    expect(result.value.fields.TotalAmount).toBe('348');
    expect(result.value.fields.EncryptType).toBe('1');
  });

  it('未設定憑證時 buildCheckoutForm 回報 not_configured', () => {
    const adapter = createEcpayAdapter({ env: {} });
    const result = adapter.buildCheckoutForm({
      merchantTradeNo: 'X',
      amountTwd: 1,
      itemName: 'i',
      tradeDesc: 'd',
      returnUrl: 'r',
      clientBackUrl: 'c',
      choosePayment: 'ALL',
      idempotencyKey: 'k',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });

  it('createPayment 在未設定時丟出明確錯誤，不假成功', async () => {
    const adapter = createEcpayAdapter({ env: {} });
    await expect(
      adapter.createPayment({
        merchantTradeNo: 'X',
        amountTwd: 1,
        itemName: 'i',
        tradeDesc: 'd',
        returnUrl: 'r',
        clientBackUrl: 'c',
        choosePayment: 'ALL',
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/尚未設定/);
  });

  it('queryPayment 未設定時回報 unknown 而非 paid', async () => {
    const adapter = createEcpayAdapter({ env: {} });
    const result = await adapter.queryPayment({ merchantTradeNo: 'X', amountTwd: 1 });
    expect(result.status).toBe('unknown');
  });

  it('fixtures 模式查詢回傳已設定結果', async () => {
    const adapter = createEcpayAdapter({
      env: {},
      fixtures: { queries: { T1: { status: 'paid', providerTradeNo: 'P1', paidAt: '2026-01-01', amountTwd: 348 } } },
    });
    const result = await adapter.queryPayment({ merchantTradeNo: 'T1', amountTwd: 348 });
    expect(result.status).toBe('paid');
  });

  it('fixtures 模式退款依 requestKey 冪等', async () => {
    const adapter = createEcpayAdapter({
      env: {},
      fixtures: { refunds: { 'rk-1': { status: 'completed', refundTradeNo: 'R1', amountTwd: 100 } } },
    });
    const first = await adapter.requestRefund({ merchantTradeNo: 'T', providerTradeNo: 'P', amountTwd: 100, reason: 'r', requestKey: 'rk-1' });
    const second = await adapter.requestRefund({ merchantTradeNo: 'T', providerTradeNo: 'P', amountTwd: 100, reason: 'r', requestKey: 'rk-1' });
    expect(first).toEqual(second);
  });

  it('sanitizeMerchantTradeNo 只留英數字且截斷 20 碼', () => {
    expect(sanitizeMerchantTradeNo('JP-2026/01/01_0001')).toBe('JP202601010001');
    expect(sanitizeMerchantTradeNo('A'.repeat(30))).toHaveLength(20);
  });

  it('formatEcpayTradeDate 使用 yyyy/MM/dd HH:mm:ss', () => {
    const text = formatEcpayTradeDate(new Date(2026, 0, 2, 3, 4, 5));
    expect(text).toBe('2026/01/02 03:04:05');
  });

  it('模擬交易在正式環境必須被拒絕', () => {
    const notification = {
      merchantId: 'M',
      merchantTradeNo: 'T',
      providerTradeNo: 'P',
      amountTwd: 1,
      currency: 'TWD',
      success: true,
      simulated: true,
      paidAt: '',
      eventKey: 'e',
    };
    expect(isSimulatedNotification(notification)).toBe(true);
    expect(() => assertNotSimulatedInProduction(notification, true)).toThrow(/模擬交易/);
    expect(() => assertNotSimulatedInProduction(notification, false)).not.toThrow();
  });
});

describe('發票 adapter', () => {
  it('無憑證時為 integration_pending', () => {
    const adapter = createInvoiceAdapter({ env: {} });
    expect(adapter.capability().status).toBe('integration_pending');
  });

  it('統編與個人載具不得同時使用', () => {
    expect(() =>
      validateInvoiceCarrier({ carrierType: 'mobile_barcode', carrierId: '/ABC1234', buyerTaxId: '12345678', donationCode: null }),
    ).toThrow(/不得同時使用/);
  });

  it('統編必須為 8 位數字', () => {
    expect(() =>
      validateInvoiceCarrier({ carrierType: 'paper', carrierId: null, buyerTaxId: '123', donationCode: null }),
    ).toThrow(/8 位數字/);
  });

  it('手機條碼格式錯誤被拒絕', () => {
    expect(() =>
      validateInvoiceCarrier({ carrierType: 'mobile_barcode', carrierId: 'ABC', buyerTaxId: null, donationCode: null }),
    ).toThrow(/手機條碼/);
  });

  it('捐贈碼必須為 3 至 7 位數字', () => {
    expect(() =>
      validateInvoiceCarrier({ carrierType: 'donation', carrierId: null, buyerTaxId: null, donationCode: '12' }),
    ).toThrow(/捐贈碼/);
  });

  it('合法載具通過驗證', () => {
    expect(() =>
      validateInvoiceCarrier({ carrierType: 'mobile_barcode', carrierId: '/ABC1234', buyerTaxId: null, donationCode: null }),
    ).not.toThrow();
  });

  it('fixtures 模式開立發票', async () => {
    const adapter = createInvoiceAdapter({
      env: {},
      fixtures: {
        issues: {
          'ik-1': { invoiceNumber: 'AB12345678', invoiceDate: '2026-01-01', randomCode: '1234', amountTwd: 348, status: 'issued' },
        },
      },
    });
    const result = await adapter.issue({
      orderCode: 'O1',
      sellerTaxId: '12345678',
      buyerTaxId: null,
      carrierType: 'mobile_barcode',
      carrierId: '/ABC1234',
      donationCode: null,
      amountTwd: 348,
      taxType: 'taxable',
      items: [{ name: '品', quantity: 1, unitPriceTwd: 348 }],
      idempotencyKey: 'ik-1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.invoiceNumber).toBe('AB12345678');
  });

  it('未設定時開立回報 not_configured', async () => {
    const adapter = createInvoiceAdapter({ env: {} });
    const result = await adapter.issue({
      orderCode: 'O1',
      sellerTaxId: '12345678',
      buyerTaxId: null,
      carrierType: 'paper',
      carrierId: null,
      donationCode: null,
      amountTwd: 1,
      taxType: 'taxable',
      items: [],
      idempotencyKey: 'k',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });
});
