/**
 * 統一錯誤形狀：對外只回 error_code、customer_message、correlation_id 與可重試標記，
 * 不回傳金鑰、SQL 或原始通知內容。
 */

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'QUOTE_EXPIRED'
  | 'OUT_OF_STOCK'
  | 'SOURCE_STALE'
  | 'PRODUCT_UNPUBLISHED'
  | 'COMPLIANCE_BLOCKED'
  | 'PAYMENT_SIGNATURE_INVALID'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'REFUND_EXCEEDS_AVAILABLE'
  | 'RATE_LIMITED'
  | 'INTEGRATION_PENDING'
  | 'INTERNAL';

export interface AppErrorShape {
  readonly error_code: ErrorCode;
  readonly customer_message: string;
  readonly correlation_id: string;
  readonly retryable: boolean;
}

export class AppError extends Error {
  readonly error_code: ErrorCode;
  readonly customer_message: string;
  readonly retryable: boolean;
  readonly correlation_id: string;

  constructor(
    error_code: ErrorCode,
    customer_message: string,
    options: { retryable?: boolean; correlation_id?: string; cause?: unknown } = {},
  ) {
    super(`${error_code}: ${customer_message}`, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.error_code = error_code;
    this.customer_message = customer_message;
    this.retryable = options.retryable ?? false;
    this.correlation_id = options.correlation_id ?? 'local';
  }

  toShape(): AppErrorShape {
    return {
      error_code: this.error_code,
      customer_message: this.customer_message,
      correlation_id: this.correlation_id,
      retryable: this.retryable,
    };
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
