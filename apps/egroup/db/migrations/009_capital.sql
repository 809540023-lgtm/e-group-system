-- 資本市場：RWA 資產護照、STO 三階段關卡、STO+ 混合代幣狀態機。
--
-- 規範來源：計畫書第十、十一章；博士論文《證券型代幣的範式轉移》。
-- 本 migration 只建立紀錄與狀態機，不建立任何對外募集或交易功能。

/* ------------------------------------------------------------------ */
/* RWA 資產護照                                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS asset_passports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_no              text UNIQUE NOT NULL,
  equipment_id          uuid REFERENCES equipment(id),
  kind                  text NOT NULL DEFAULT 'equipment'
                        CHECK (kind IN ('equipment','receivable','inventory')),
  serial_no             text,
  invoice_no            text,
  invoice_date          date,
  owner_legal_entity    text,
  location_station_id   uuid REFERENCES stations(id),
  maintenance_current   boolean NOT NULL DEFAULT false,
  insurance_policy_no   text,
  insurance_expires_on  date,
  appraised_value_twd   integer CHECK (appraised_value_twd IS NULL OR appraised_value_twd >= 0),
  appraisal_date        date,
  appraiser             text,
  existing_lien_twd     integer NOT NULL DEFAULT 0 CHECK (existing_lien_twd >= 0),
  lien_holder           text,
  lease_id              uuid REFERENCES leases(id),
  rwa_eligible          boolean NOT NULL DEFAULT false,
  eligibility_score     integer NOT NULL DEFAULT 0 CHECK (eligibility_score BETWEEN 0 AND 100),
  eligibility_blockers  jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligibility_warnings  jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_passports_eligible_idx ON asset_passports (rwa_eligible, kind);

CREATE TABLE IF NOT EXISTS asset_valuations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid NOT NULL REFERENCES asset_passports(id),
  valued_on     date NOT NULL,
  value_twd     integer NOT NULL CHECK (value_twd >= 0),
  method        text NOT NULL,
  appraiser     text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, valued_on)
);

/* ------------------------------------------------------------------ */
/* RWA 載體與分配                                                      */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS rwa_vehicles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text UNIQUE NOT NULL,
  name                    text NOT NULL,
  kind                    text NOT NULL
                          CHECK (kind IN ('equipment_lease','equipment_ownership','receivable')),
  status                  text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','structuring','legal_review','approved','issuing','live','suspended','closed')),
  legal_counsel           text,
  securities_firm         text,
  collection_account      text,
  maintenance_reserve_pct numeric(5,4) NOT NULL DEFAULT 0
                          CHECK (maintenance_reserve_pct >= 0 AND maintenance_reserve_pct <= 1),
  senior_debt_twd         integer NOT NULL DEFAULT 0 CHECK (senior_debt_twd >= 0),
  distributable_basis     text NOT NULL DEFAULT 'equipment_rent'
                          CHECK (distributable_basis IN ('equipment_rent','receivable_collection')),
  disclosure_url          text,
  total_units             integer NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rwa_vehicle_assets (
  vehicle_id      uuid NOT NULL REFERENCES rwa_vehicles(id),
  asset_id        uuid NOT NULL REFERENCES asset_passports(id),
  allocated_twd   integer NOT NULL CHECK (allocated_twd >= 0),
  PRIMARY KEY (vehicle_id, asset_id)
);

CREATE TABLE IF NOT EXISTS rwa_distribution_runs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id                uuid NOT NULL REFERENCES rwa_vehicles(id),
  period_start              date NOT NULL,
  period_end                date NOT NULL,
  equipment_rent_twd        integer NOT NULL DEFAULT 0 CHECK (equipment_rent_twd >= 0),
  operating_revenue_twd     integer NOT NULL DEFAULT 0 CHECK (operating_revenue_twd >= 0),
  fees_twd                  integer NOT NULL DEFAULT 0 CHECK (fees_twd >= 0),
  maintenance_reserve_twd   integer NOT NULL DEFAULT 0 CHECK (maintenance_reserve_twd >= 0),
  senior_debt_service_twd   integer NOT NULL DEFAULT 0 CHECK (senior_debt_service_twd >= 0),
  distributable_twd         integer NOT NULL DEFAULT 0 CHECK (distributable_twd >= 0),
  per_unit_twd              integer NOT NULL DEFAULT 0 CHECK (per_unit_twd >= 0),
  status                    text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','approved','paid','void')),
  approved_by               text,
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS rwa_stress_scenarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        uuid NOT NULL REFERENCES rwa_vehicles(id),
  scenario          text NOT NULL
                    CHECK (scenario IN ('station_closure','lessee_default','equipment_damage','double_financing','insurance_denial','residual_shortfall')),
  assumption        text NOT NULL,
  impact_twd        integer NOT NULL DEFAULT 0,
  recovery_twd      integer NOT NULL DEFAULT 0,
  shortfall_twd     integer NOT NULL DEFAULT 0,
  principal_at_risk boolean NOT NULL DEFAULT false,
  evaluated_on      date NOT NULL DEFAULT current_date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, scenario, evaluated_on)
);

/* ------------------------------------------------------------------ */
/* STO 三階段                                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS sto_programs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        text UNIQUE NOT NULL,
  name                        text NOT NULL,
  stage                       integer NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  status                      text NOT NULL DEFAULT 'preparation'
                              CHECK (status IN ('preparation','structuring','legal_review','approved','issuing','live','suspended','abandoned')),
  target_instrument           text NOT NULL
                              CHECK (target_instrument IN ('equity','debt','equipment_right')),
  issuer_entity               text,
  tpex_regime                 text,
  professional_investor_only  boolean NOT NULL DEFAULT true,
  issuance_cap_twd            integer CHECK (issuance_cap_twd IS NULL OR issuance_cap_twd >= 0),
  disclosure_doc_url          text,
  counsel_opinion_url         text,
  securities_firm             text,
  approved_on                 date,
  note                        text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sto_requirements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES sto_programs(id),
  stage         integer NOT NULL CHECK (stage BETWEEN 1 AND 3),
  key           text NOT NULL,
  label         text NOT NULL,
  category      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','done','blocked')),
  blocking      boolean NOT NULL DEFAULT true,
  evidence      text,
  owner         text,
  due_on        date,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, key)
);

CREATE INDEX IF NOT EXISTS sto_requirements_program_idx ON sto_requirements (program_id, stage);

/* ------------------------------------------------------------------ */
/* STO+ 代幣持有人與批次                                               */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS token_holders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES accounts(id),
  wallet_address        text UNIQUE NOT NULL,
  address_class         text NOT NULL
                        CHECK (address_class IN ('platform','secondary_market','custody')),
  kyc_status            text NOT NULL DEFAULT 'pending'
                        CHECK (kyc_status IN ('verified','pending','rejected')),
  kyc_verified_on       date,
  investor_category     text NOT NULL DEFAULT 'general'
                        CHECK (investor_category IN ('general','professional','accredited')),
  jurisdiction          text NOT NULL DEFAULT 'TW',
  sanctions_checked_on  date,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_holders_account_idx ON token_holders (account_id);

CREATE TABLE IF NOT EXISTS token_lots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id           uuid NOT NULL REFERENCES token_holders(id),
  program_id          uuid NOT NULL REFERENCES sto_programs(id),
  quantity            integer NOT NULL CHECK (quantity > 0),
  acquisition         text NOT NULL CHECK (acquisition IN ('purchased','earned')),
  acquired_at         timestamptz NOT NULL DEFAULT now(),
  consideration_twd   integer NOT NULL DEFAULT 0 CHECK (consideration_twd >= 0),
  lockup_until        date,
  lockup_basis        text NOT NULL DEFAULT 'none'
                      CHECK (lockup_basis IN ('rule_144','earned_exempt','none')),
  contribution_type   text CHECK (contribution_type IN ('content','curation','governance','technical')),
  contribution_score  numeric(6,2),
  state               text NOT NULL DEFAULT 'ST+' CHECK (state IN ('ST','ST+')),
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','converted','burned')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (acquisition <> 'earned' OR lockup_basis = 'earned_exempt'),
  CHECK (acquisition <> 'purchased' OR lockup_basis IN ('rule_144','none'))
);

CREATE INDEX IF NOT EXISTS token_lots_holder_idx ON token_lots (holder_id, status);

CREATE TABLE IF NOT EXISTS token_state_transitions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id            uuid NOT NULL REFERENCES token_lots(id),
  from_state        text NOT NULL CHECK (from_state IN ('ST','ST+')),
  to_state          text CHECK (to_state IN ('ST','ST+')),
  trigger           text NOT NULL CHECK (trigger IN ('address_class','manual_override','safe_mode')),
  from_address      text,
  to_address        text,
  to_address_class  text NOT NULL CHECK (to_address_class IN ('platform','secondary_market','custody')),
  decision_code     text NOT NULL,
  legal_basis       text NOT NULL,
  actor             text NOT NULL,
  approved_by       text,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  note              text
);

CREATE INDEX IF NOT EXISTS token_state_transitions_lot_idx ON token_state_transitions (lot_id, occurred_at DESC);

/* ------------------------------------------------------------------ */
/* Social Mining                                                       */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS social_mining_rules (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id                uuid NOT NULL REFERENCES sto_programs(id),
  version                   integer NOT NULL CHECK (version > 0),
  content_quality_weight    numeric(5,4) NOT NULL,
  interaction_depth_weight  numeric(5,4) NOT NULL,
  governance_weight         numeric(5,4) NOT NULL,
  time_weight               numeric(5,4) NOT NULL,
  per_account_cap           integer NOT NULL DEFAULT 0 CHECK (per_account_cap >= 0),
  decay_pct                 numeric(5,4) NOT NULL DEFAULT 0 CHECK (decay_pct >= 0 AND decay_pct <= 1),
  reset_period_days         integer NOT NULL DEFAULT 0 CHECK (reset_period_days >= 0),
  effective_from            date NOT NULL,
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, version),
  CHECK (abs(content_quality_weight + interaction_depth_weight + governance_weight + time_weight - 1) < 0.0001)
);

CREATE TABLE IF NOT EXISTS social_mining_awards (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id                 uuid NOT NULL REFERENCES token_holders(id),
  rule_id                   uuid NOT NULL REFERENCES social_mining_rules(id),
  period_start              date NOT NULL,
  period_end                date NOT NULL,
  content_quality_score     numeric(6,2) NOT NULL DEFAULT 0 CHECK (content_quality_score BETWEEN 0 AND 100),
  interaction_depth_score   numeric(6,2) NOT NULL DEFAULT 0 CHECK (interaction_depth_score BETWEEN 0 AND 100),
  governance_score          numeric(6,2) NOT NULL DEFAULT 0 CHECK (governance_score BETWEEN 0 AND 100),
  time_score                numeric(6,2) NOT NULL DEFAULT 0 CHECK (time_score BETWEEN 0 AND 100),
  weighted_score            numeric(8,4) NOT NULL DEFAULT 0,
  requested_quantity        integer NOT NULL DEFAULT 0 CHECK (requested_quantity >= 0),
  awarded_quantity          integer NOT NULL DEFAULT 0 CHECK (awarded_quantity >= 0),
  capped                    boolean NOT NULL DEFAULT false,
  lot_id                    uuid REFERENCES token_lots(id),
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_id, rule_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

/* ------------------------------------------------------------------ */
/* 合規審計與安全模式                                                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS compliance_audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES sto_programs(id),
  layer         text NOT NULL
                CHECK (layer IN ('code_security','legal','governance','regulatory')),
  auditor       text NOT NULL,
  standard      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','passed','failed','waived')),
  report_url    text,
  performed_on  date,
  findings      text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safe_mode_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        uuid NOT NULL REFERENCES sto_programs(id),
  trigger           text NOT NULL
                    CHECK (trigger IN ('code_vulnerability','oracle_error','legal_conflict','governance_conflict')),
  mode              text NOT NULL
                    CHECK (mode IN ('pause_transfer','pause_conversion','manual_review')),
  authorized_by     jsonb NOT NULL DEFAULT '[]'::jsonb,
  multi_sig_count   integer NOT NULL DEFAULT 0 CHECK (multi_sig_count >= 0),
  expires_at        timestamptz,
  announced_at      timestamptz,
  resolved_at       timestamptz,
  resolution        text,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safe_mode_events_open_idx ON safe_mode_events (program_id) WHERE resolved_at IS NULL;

/* ------------------------------------------------------------------ */
/* 代幣法律狀態轉換                                                    */
/* ------------------------------------------------------------------ */

-- 狀態轉換由接收地址的性質自動判斷，不由使用者手動選擇。
-- 平台內部錢包只能持有效用狀態；合規二級市場地址只能持有證券狀態；
-- 合規託管地址可持有任一狀態，因此不觸發轉換。
--
-- 保守預設：安全模式啟動、KYC 未完成、或鎖定期內想把證券狀態轉回效用狀態時，
-- 一律不放行，並標記為需人工複核。
CREATE OR REPLACE FUNCTION eg_transition_token_state(
  p_lot_id uuid,
  p_to_address text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lot            token_lots;
  v_from_address   text;
  v_program        sto_programs;
  v_safe           boolean;
  v_target_class   text;
  v_target_kyc     text;
  v_target_cat     text;
  v_target_state   text;
  v_code           text;
  v_reason         text;
  v_manual         boolean := false;
  v_allowed        boolean := true;
BEGIN
  SELECT * INTO v_lot FROM token_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LOT_NOT_FOUND', 'reason', '找不到代幣批次');
  END IF;

  SELECT wallet_address INTO v_from_address FROM token_holders WHERE id = v_lot.holder_id;
  SELECT * INTO v_program FROM sto_programs WHERE id = v_lot.program_id;

  SELECT EXISTS (
    SELECT 1 FROM safe_mode_events
     WHERE program_id = v_lot.program_id
       AND resolved_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_safe;

  IF v_safe THEN
    v_allowed := false;
    v_code := 'SAFE_MODE';
    v_reason := '安全模式啟動中，暫停轉讓與狀態轉換，須人工複核後才恢復。';
    v_manual := true;
    v_target_class := 'platform';
  ELSE
    SELECT address_class, kyc_status, investor_category
      INTO v_target_class, v_target_kyc, v_target_cat
      FROM token_holders WHERE wallet_address = p_to_address;

    IF v_target_class IS NULL THEN
      v_allowed := false;
      v_code := 'ADDRESS_UNKNOWN';
      v_reason := '接收地址未完成身分綁定，不得收受代幣。';
      v_target_class := 'platform';
    ELSIF v_target_kyc <> 'verified' THEN
      v_allowed := false;
      v_code := 'KYC_REQUIRED';
      v_reason := '代幣採身分綁定，未完成 KYC 的地址不得收受代幣。';
    ELSIF v_target_class = 'custody' THEN
      v_target_state := v_lot.state;
      v_code := 'CUSTODY_HOLD';
      v_reason := '合規託管地址可持有任一狀態，法律狀態不變。';
    ELSIF v_target_class = 'secondary_market' THEN
      IF v_program.professional_investor_only AND v_target_cat = 'general' THEN
        v_allowed := false;
        v_code := 'INVESTOR_NOT_ELIGIBLE';
        v_reason := '本計畫僅限專業投資人，一般投資人不得進入證券狀態。';
      ELSE
        v_target_state := 'ST';
        v_code := CASE WHEN v_lot.state = 'ST' THEN 'ALREADY_SECURITY' ELSE 'UTILITY_TO_SECURITY' END;
        v_reason := '轉入合規二級市場，觸發證券狀態，適用揭露、反詐欺、適格投資人與轉售限制。';
      END IF;
    ELSE
      IF v_lot.lockup_until IS NOT NULL AND v_lot.lockup_until > current_date THEN
        v_allowed := false;
        v_code := 'LOCKUP_ACTIVE';
        v_reason := '鎖定期內不得把證券狀態轉回效用狀態，否則形成轉售限制之規避。';
        v_manual := true;
      ELSE
        v_target_state := 'ST+';
        v_code := CASE WHEN v_lot.state = 'ST+' THEN 'ALREADY_UTILITY' ELSE 'SECURITY_TO_UTILITY' END;
        v_reason := '轉回平台內部錢包，觸發效用狀態；所有權人未變，僅規範面向切換。';
      END IF;
    END IF;
  END IF;

  INSERT INTO token_state_transitions(
    lot_id, from_state, to_state, trigger, from_address, to_address,
    to_address_class, decision_code, legal_basis, actor, approved_by, note)
  VALUES (
    v_lot.id, v_lot.state,
    CASE WHEN v_allowed THEN v_target_state ELSE NULL END,
    CASE WHEN v_manual THEN 'manual_override' ELSE 'address_class' END,
    v_from_address, p_to_address, v_target_class, v_code, v_reason, p_actor, NULL, NULL);

  IF v_allowed AND v_target_state IS DISTINCT FROM v_lot.state THEN
    UPDATE token_lots SET state = v_target_state WHERE id = v_lot.id;
  END IF;

  PERFORM eg_audit('system', p_actor, 'token.state_transition', 'token_lot', v_lot.id::text,
    jsonb_build_object('state', v_lot.state),
    jsonb_build_object('state', CASE WHEN v_allowed THEN v_target_state ELSE v_lot.state END,
                       'code', v_code, 'toAddress', p_to_address),
    v_reason);

  RETURN jsonb_build_object(
    'ok', v_allowed,
    'code', v_code,
    'reason', v_reason,
    'from', v_lot.state,
    'to', CASE WHEN v_allowed THEN v_target_state ELSE NULL END,
    'requiresManualReview', v_manual);
END;
$$;

/* ------------------------------------------------------------------ */
/* Social Mining 發放                                                  */
/* ------------------------------------------------------------------ */

-- 依事前公開的權重計算加權分數，套用單一帳戶上限，並建立「賺取取得」批次。
-- 賺取取得一律 lockup_basis='earned_exempt'，但仍須通過 KYC 與反集中上限。
CREATE OR REPLACE FUNCTION eg_award_social_mining(
  p_holder_id uuid,
  p_rule_id uuid,
  p_period_start date,
  p_period_end date,
  p_scores jsonb,
  p_requested integer,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule        social_mining_rules;
  v_kyc         text;
  v_cq          numeric;
  v_id          numeric;
  v_gv          numeric;
  v_tm          numeric;
  v_weighted    numeric;
  v_already     integer;
  v_awarded     integer;
  v_capped      boolean;
  v_lot_id      uuid;
  v_award_id    uuid;
BEGIN
  SELECT * INTO v_rule FROM social_mining_rules WHERE id = p_rule_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RULE_NOT_FOUND', 'reason', '找不到獎勵規則');
  END IF;

  SELECT kyc_status INTO v_kyc FROM token_holders WHERE id = p_holder_id;
  IF v_kyc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'HOLDER_NOT_FOUND', 'reason', '找不到代幣持有人');
  END IF;
  IF v_kyc <> 'verified' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'KYC_REQUIRED', 'reason', '未完成 KYC 不得取得代幣');
  END IF;
  IF p_requested IS NULL OR p_requested <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_QUANTITY', 'reason', '申請數量必須為正整數');
  END IF;
  IF p_period_end < p_period_start THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PERIOD', 'reason', '期間結束日不得早於開始日');
  END IF;

  v_cq := COALESCE((p_scores->>'contentQuality')::numeric, 0);
  v_id := COALESCE((p_scores->>'interactionDepth')::numeric, 0);
  v_gv := COALESCE((p_scores->>'governance')::numeric, 0);
  v_tm := COALESCE((p_scores->>'time')::numeric, 0);

  IF v_cq < 0 OR v_cq > 100 OR v_id < 0 OR v_id > 100
     OR v_gv < 0 OR v_gv > 100 OR v_tm < 0 OR v_tm > 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SCORE_OUT_OF_RANGE', 'reason', '各項分數必須介於 0 與 100');
  END IF;

  v_weighted := v_cq * v_rule.content_quality_weight
              + v_id * v_rule.interaction_depth_weight
              + v_gv * v_rule.governance_weight
              + v_tm * v_rule.time_weight;

  SELECT COALESCE(sum(awarded_quantity), 0) INTO v_already
    FROM social_mining_awards WHERE holder_id = p_holder_id AND rule_id = p_rule_id;

  v_awarded := LEAST(p_requested, GREATEST(0, v_rule.per_account_cap - v_already));
  v_capped := v_awarded < p_requested;

  IF v_awarded = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CAP_REACHED',
      'reason', '已達單一帳戶獎勵上限', 'alreadyAwarded', v_already, 'cap', v_rule.per_account_cap);
  END IF;

  INSERT INTO token_lots(holder_id, program_id, quantity, acquisition, acquired_at, consideration_twd,
    lockup_until, lockup_basis, contribution_type, contribution_score, state, status)
  VALUES (p_holder_id, v_rule.program_id, v_awarded, 'earned', now(), 0, NULL, 'earned_exempt',
    COALESCE(p_scores->>'contributionType', 'content'), v_weighted, 'ST+', 'active')
  RETURNING id INTO v_lot_id;

  INSERT INTO social_mining_awards(holder_id, rule_id, period_start, period_end,
    content_quality_score, interaction_depth_score, governance_score, time_score,
    weighted_score, requested_quantity, awarded_quantity, capped, lot_id)
  VALUES (p_holder_id, p_rule_id, p_period_start, p_period_end, v_cq, v_id, v_gv, v_tm,
    v_weighted, p_requested, v_awarded, v_capped, v_lot_id)
  RETURNING id INTO v_award_id;

  PERFORM eg_audit('system', p_actor, 'token.award', 'token_lot', v_lot_id::text, NULL,
    jsonb_build_object('quantity', v_awarded, 'weightedScore', v_weighted, 'capped', v_capped),
    'Social Mining 勞務對價發放');

  RETURN jsonb_build_object('ok', true, 'code', 'AWARDED', 'awardId', v_award_id, 'lotId', v_lot_id,
    'awarded', v_awarded, 'capped', v_capped, 'weightedScore', v_weighted, 'alreadyAwarded', v_already);
END;
$$;

/* ------------------------------------------------------------------ */
/* RWA 分配瀑布                                                        */
/* ------------------------------------------------------------------ */

-- 可分配基礎只有設備租金。營運收入只記錄、不分配，避免把整筆餐食營收
-- 當作可分配收益。債務順位與維修準備先扣除，餘額才除以單位數。
CREATE OR REPLACE FUNCTION eg_compute_rwa_distribution(
  p_vehicle_id uuid,
  p_period_start date,
  p_period_end date,
  p_equipment_rent_twd integer,
  p_operating_revenue_twd integer,
  p_fees_twd integer,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_vehicle       rwa_vehicles;
  v_reserve       integer;
  v_distributable integer;
  v_per_unit      integer;
  v_run_id        uuid;
BEGIN
  SELECT * INTO v_vehicle FROM rwa_vehicles WHERE id = p_vehicle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VEHICLE_NOT_FOUND', 'reason', '找不到 RWA 載體');
  END IF;
  IF p_period_end < p_period_start THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PERIOD', 'reason', '期間結束日不得早於開始日');
  END IF;
  IF p_equipment_rent_twd < 0 OR p_operating_revenue_twd < 0 OR p_fees_twd < 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'reason', '金額不得為負');
  END IF;

  v_reserve := round(p_equipment_rent_twd * v_vehicle.maintenance_reserve_pct);
  v_distributable := GREATEST(0, p_equipment_rent_twd - p_fees_twd - v_reserve - v_vehicle.senior_debt_twd);
  v_per_unit := CASE WHEN v_vehicle.total_units > 0
                     THEN floor(v_distributable::numeric / v_vehicle.total_units)::integer
                     ELSE 0 END;

  INSERT INTO rwa_distribution_runs(vehicle_id, period_start, period_end,
    equipment_rent_twd, operating_revenue_twd, fees_twd, maintenance_reserve_twd,
    senior_debt_service_twd, distributable_twd, per_unit_twd, status, note)
  VALUES (p_vehicle_id, p_period_start, p_period_end,
    p_equipment_rent_twd, p_operating_revenue_twd, p_fees_twd, v_reserve,
    v_vehicle.senior_debt_twd, v_distributable, v_per_unit, 'draft',
    '營運收入僅記錄、不列入分配')
  ON CONFLICT (vehicle_id, period_start, period_end) DO UPDATE
    SET equipment_rent_twd = EXCLUDED.equipment_rent_twd,
        operating_revenue_twd = EXCLUDED.operating_revenue_twd,
        fees_twd = EXCLUDED.fees_twd,
        maintenance_reserve_twd = EXCLUDED.maintenance_reserve_twd,
        senior_debt_service_twd = EXCLUDED.senior_debt_service_twd,
        distributable_twd = EXCLUDED.distributable_twd,
        per_unit_twd = EXCLUDED.per_unit_twd
  RETURNING id INTO v_run_id;

  PERFORM eg_audit('system', p_actor, 'rwa.distribution_compute', 'rwa_distribution_run', v_run_id::text,
    NULL,
    jsonb_build_object('distributable', v_distributable, 'perUnit', v_per_unit,
                       'excludedOperatingRevenue', p_operating_revenue_twd),
    '設備租金、營運收入與投資分配分別記錄');

  RETURN jsonb_build_object('ok', true, 'code', 'COMPUTED', 'runId', v_run_id,
    'maintenanceReserve', v_reserve, 'distributable', v_distributable, 'perUnit', v_per_unit,
    'excludedOperatingRevenue', p_operating_revenue_twd);
END;
$$;
