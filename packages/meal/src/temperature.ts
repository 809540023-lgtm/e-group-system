/**
 * 冷鏈溫度判定（計畫書第七章）。
 *
 * 記錄溫度異常持續時間及處置，不只保存單一瞬間讀數。
 * 門檻為內部管理值，正式營運須依產品標示、現行規範與驗證結果調整。
 */

import type { StorageType } from './nutrition.ts';

export type TemperatureStatus = 'ok' | 'warning' | 'breach';

export interface TemperatureReading {
  readonly storage: StorageType;
  readonly tempC: number;
  readonly durationMinutes: number;
}

export interface TemperatureVerdict {
  readonly status: TemperatureStatus;
  readonly action: string;
  readonly requiresQuarantine: boolean;
}

export function evaluateTemperature(reading: TemperatureReading): TemperatureVerdict {
  if (!Number.isFinite(reading.tempC)) throw new Error('TEMPERATURE_INVALID: 溫度必須是有限數值。');
  if (!Number.isFinite(reading.durationMinutes) || reading.durationMinutes < 0) {
    throw new Error('TEMPERATURE_INVALID: 持續時間必須是非負有限數值。');
  }

  const { storage, tempC, durationMinutes } = reading;

  if (storage === 'frozen') {
    if (tempC <= -18) return { status: 'ok', action: '維持冷凍保存。', requiresQuarantine: false };
    if (tempC <= -15) {
      return durationMinutes > 30
        ? { status: 'breach', action: '超過容許時間，隔離並由品質負責人判定。', requiresQuarantine: true }
        : { status: 'warning', action: '縮短檢查間隔並記錄後續溫度。', requiresQuarantine: false };
    }
    return { status: 'breach', action: '立即隔離批次、停止交付並通報品質負責人。', requiresQuarantine: true };
  }

  if (storage === 'chilled') {
    if (tempC >= 0 && tempC <= 7) return { status: 'ok', action: '維持冷藏保存。', requiresQuarantine: false };
    if (tempC > 7 && tempC <= 10) {
      return durationMinutes > 30
        ? { status: 'breach', action: '超過容許時間，隔離並由品質負責人判定。', requiresQuarantine: true }
        : { status: 'warning', action: '檢查設備與門磁，記錄後續溫度。', requiresQuarantine: false };
    }
    if (tempC < 0) {
      return durationMinutes > 60
        ? { status: 'breach', action: '可能凍傷，隔離並由品質負責人判定。', requiresQuarantine: true }
        : { status: 'warning', action: '確認是否短暫結霜並記錄。', requiresQuarantine: false };
    }
    return { status: 'breach', action: '立即隔離批次、停止交付並通報品質負責人。', requiresQuarantine: true };
  }

  if (tempC >= 10 && tempC <= 30) return { status: 'ok', action: '維持常溫保存。', requiresQuarantine: false };
  if (tempC > 30 && tempC <= 35) {
    return durationMinutes > 60
      ? { status: 'breach', action: '超過容許時間，隔離並由品質負責人判定。', requiresQuarantine: true }
      : { status: 'warning', action: '移至陰涼處並記錄。', requiresQuarantine: false };
  }
  return { status: 'breach', action: '立即隔離批次並通報品質負責人。', requiresQuarantine: true };
}

/** 感測器需校正與故障處理；超過校正期限的讀數不得作為放行依據。 */
export function sensorUsable(input: { readonly lastCalibratedAt: string; readonly now: Date; readonly maxDays: number }): boolean {
  const calibrated = new Date(input.lastCalibratedAt);
  if (Number.isNaN(calibrated.getTime())) return false;
  const days = (input.now.getTime() - calibrated.getTime()) / 86_400_000;
  return days >= 0 && days <= input.maxDays;
}
