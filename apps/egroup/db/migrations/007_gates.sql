-- 007_gates.sql — 擴點關卡與停止條件（計畫書第十七章）
-- 第十七章要求以「連續 8 週單筆貢獻為正、加盟站可持續、資金到位、配送能力、
-- 無未結重大食安事件」作為擴點關卡，並列出五項停止或縮減條件。
-- 這些判斷需要站點固定成本、資金承諾與現金部位三類資料，先前資料模型沒有。

BEGIN;

-- 站點每月固定增量成本（工時、租金、電費、維護）。第十三章要求
-- 「加盟站扣除實際工時及成本後具可持續性」，沒有這個數字無法判斷。
ALTER TABLE stations ADD COLUMN IF NOT EXISTS monthly_fixed_cost_twd integer NOT NULL DEFAULT 0;
ALTER TABLE stations DROP CONSTRAINT IF EXISTS stations_monthly_fixed_cost_nonneg;
ALTER TABLE stations ADD CONSTRAINT stations_monthly_fixed_cost_nonneg
  CHECK (monthly_fixed_cost_twd >= 0);

-- 資金承諾：擴點關卡「新站資金到位」的證據來源。
CREATE TABLE IF NOT EXISTS funding_commitments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL,
  amount_twd   integer NOT NULL CHECK (amount_twd > 0),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','committed','received')),
  expected_on  date,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 現金部位：停止條件「現金不足以履行已承諾訂單及退款」的證據來源。
-- 第十四章要求每月更新現金流、可動用餘額及最差情境。
CREATE TABLE IF NOT EXISTS cash_positions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of                     date NOT NULL UNIQUE,
  available_twd             integer NOT NULL,
  committed_obligations_twd integer NOT NULL DEFAULT 0 CHECK (committed_obligations_twd >= 0),
  worst_case_twd            integer NOT NULL DEFAULT 0,
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funding_commitments_status_idx ON funding_commitments(status);
CREATE INDEX IF NOT EXISTS cash_positions_as_of_idx ON cash_positions(as_of DESC);

COMMIT;
