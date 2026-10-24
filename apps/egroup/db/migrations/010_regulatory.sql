-- 監理環境：從「執法監管」到「創新導向」的制度轉型。
--
-- 規範來源：博士論文《美國數位資產監管政策的制度轉型》。
-- 本 migration 只建立監理紀錄與跨境要約判斷，不建立任何對外募集功能。

/* ------------------------------------------------------------------ */
/* 監理體制                                                            */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS regulatory_regimes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE NOT NULL,
  name                  text NOT NULL,
  posture               text NOT NULL
                        CHECK (posture IN ('enforcement_led','innovation_oriented','equivalence_required','restricted')),
  framework             text NOT NULL,
  retail_allowed        boolean NOT NULL DEFAULT false,
  professional_only     boolean NOT NULL DEFAULT false,
  equivalence_required  boolean NOT NULL DEFAULT false,
  local_license_held    boolean NOT NULL DEFAULT false,
  equivalence_determined boolean NOT NULL DEFAULT false,
  effective_from        date,
  source                text,
  note                  text,
  -- 論文第八章第一節第四款：創新導向監管的五項正當性條件。
  transparent_rulemaking boolean NOT NULL DEFAULT false,
  multi_stakeholder      boolean NOT NULL DEFAULT false,
  continuous_disclosure  boolean NOT NULL DEFAULT false,
  independent_judgment   boolean NOT NULL DEFAULT false,
  accountability         boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regulatory_regimes_posture_idx ON regulatory_regimes (posture);

CREATE TABLE IF NOT EXISTS regulatory_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_code    text NOT NULL REFERENCES regulatory_regimes(code),
  event_date     date NOT NULL,
  kind           text NOT NULL
                 CHECK (kind IN ('enforcement','personnel','guidance','legislation','coordination','accounting')),
  title          text NOT NULL,
  summary        text NOT NULL,
  posture_after  text NOT NULL
                 CHECK (posture_after IN ('enforcement_led','innovation_oriented','equivalence_required','restricted')),
  source         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regime_code, event_date, title)
);

CREATE INDEX IF NOT EXISTS regulatory_events_date_idx ON regulatory_events (event_date DESC);

/* ------------------------------------------------------------------ */
/* 安全港與過渡期機制                                                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS safe_harbor_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no        text UNIQUE NOT NULL,
  kind                text NOT NULL
                      CHECK (kind IN ('temporary_safe_harbor','no_action_letter','sandbox')),
  regime_code         text NOT NULL REFERENCES regulatory_regimes(code),
  applicant           text NOT NULL,
  subject             text NOT NULL,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','submitted','granted','expired','withdrawn','rejected')),
  good_faith          boolean NOT NULL DEFAULT false,
  compliance_measures boolean NOT NULL DEFAULT false,
  reporting_cadence   text NOT NULL DEFAULT 'none'
                      CHECK (reporting_cadence IN ('none','quarterly','semiannual','annual')),
  opened_on           date,
  expires_on          date,
  extension_months    integer NOT NULL DEFAULT 0 CHECK (extension_months >= 0),
  user_cap            integer CHECK (user_cap IS NULL OR user_cap >= 0),
  volume_cap_twd      integer CHECK (volume_cap_twd IS NULL OR volume_cap_twd >= 0),
  exit_mechanism      text NOT NULL DEFAULT 'none'
                      CHECK (exit_mechanism IN ('none','approved','modified','terminated')),
  published           boolean NOT NULL DEFAULT false,
  blockers            jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings            jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR opened_on IS NULL OR expires_on >= opened_on)
);

CREATE INDEX IF NOT EXISTS safe_harbor_status_idx ON safe_harbor_applications (status, kind);

/* ------------------------------------------------------------------ */
/* 揭露義務                                                            */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS disclosure_obligations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  text NOT NULL
                CHECK (subject_type IN ('staking','custody','token_issuance')),
  subject_ref   text NOT NULL,
  item_key      text NOT NULL,
  label         text NOT NULL,
  required      boolean NOT NULL DEFAULT true,
  satisfied     boolean NOT NULL DEFAULT false,
  evidence      text,
  due_on        date,
  satisfied_at  timestamptz,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_ref, item_key)
);

CREATE INDEX IF NOT EXISTS disclosure_obligations_open_idx
  ON disclosure_obligations (subject_type, subject_ref, satisfied);

/* ------------------------------------------------------------------ */
/* 跨境要約評估                                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS cross_border_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id            uuid REFERENCES sto_programs(id),
  destination_code      text NOT NULL REFERENCES regulatory_regimes(code),
  token_state           text NOT NULL CHECK (token_state IN ('ST','ST+')),
  holder_category       text NOT NULL CHECK (holder_category IN ('general','professional','accredited')),
  program_professional_only boolean NOT NULL DEFAULT false,
  equivalence_determined boolean NOT NULL DEFAULT false,
  local_license_held    boolean NOT NULL DEFAULT false,
  allowed               boolean NOT NULL,
  decision_code         text NOT NULL,
  reason                text NOT NULL,
  assessed_by           text NOT NULL,
  assessed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cross_border_program_idx ON cross_border_assessments (program_id, destination_code);

/* ------------------------------------------------------------------ */
/* 稅務與會計對照                                                      */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS tax_accounting_treatments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                  text UNIQUE NOT NULL
                        CHECK (kind IN ('mining_reward','staking_reward','liquid_staking_swap','gas_fee','platform_custody','cross_border_reporting')),
  label                 text NOT NULL,
  tax_treatment         text NOT NULL,
  accounting_treatment  text NOT NULL,
  caveat                text NOT NULL,
  authority             text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------------------------------------------ */
/* 跨境要約判斷（交易函式）                                            */
/* ------------------------------------------------------------------ */

-- 論文第七章第四節：代幣在 A 國合法不代表可在 B 國要約。
-- 判斷順序：體制未登錄 → 限制類 → 等同性／當地許可 → 零售限制 → 專業投資人限制。
CREATE OR REPLACE FUNCTION eg_assess_cross_border(
  p_program_id uuid,
  p_regime_code text,
  p_holder_category text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_regime record;
  v_program record;
  v_token_state text;
  v_allowed boolean := false;
  v_code text;
  v_reason text;
BEGIN
  SELECT code, name, posture, retail_allowed, professional_only,
         equivalence_required, equivalence_determined, local_license_held
    INTO v_regime
    FROM regulatory_regimes
   WHERE code = p_regime_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'REGIME_UNKNOWN',
      'reason', format('未登錄 %s 的監理姿態，不得要約。', p_regime_code)
    );
  END IF;

  SELECT id, code, professional_investor_only, stage
    INTO v_program
    FROM sto_programs
   WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PROGRAM_NOT_FOUND', 'reason', '找不到 STO 計畫。');
  END IF;

  v_token_state := 'ST';

  -- 尚未進入第三階段（發行與託管）者，不得對外要約。
  -- 被阻擋的評估同樣要留痕，否則事後無法證明「當時確實擋下了」。
  IF v_program.stage < 3 THEN
    v_code := 'STAGE_NOT_REACHED';
    v_reason := format('計畫 %s 仍在第 %s 階段，未完成發行與託管，不得跨境要約。', v_program.code, v_program.stage);
  ELSIF v_regime.posture = 'restricted' THEN
    v_code := 'RESTRICTED_JURISDICTION';
    v_reason := format('%s 屬限制或禁止類，不得對外要約。', v_regime.name);
  ELSIF v_regime.equivalence_required
        AND NOT v_regime.equivalence_determined
        AND NOT v_regime.local_license_held THEN
    v_code := 'EQUIVALENCE_MISSING';
    v_reason := format('%s 須經等同性認定或設立當地分支機構，兩者皆缺。', v_regime.name);
  ELSIF v_regime.professional_only AND p_holder_category = 'general' THEN
    v_code := 'RETAIL_NOT_ALLOWED';
    v_reason := format('%s 不開放零售參與，一般投資人不得受讓。', v_regime.name);
  ELSIF v_program.professional_investor_only AND p_holder_category = 'general' THEN
    v_code := 'PROFESSIONAL_ONLY';
    v_reason := '本計畫限專業投資人，證券狀態不得由一般投資人持有。';
  ELSE
    v_allowed := true;
    v_code := 'ALLOWED';
    v_reason := format('%s 的監理姿態與投資人類別均符合，可進行要約。', v_regime.name);
  END IF;

  INSERT INTO cross_border_assessments (
    program_id, destination_code, token_state, holder_category,
    program_professional_only, equivalence_determined, local_license_held,
    allowed, decision_code, reason, assessed_by
  ) VALUES (
    p_program_id, p_regime_code, v_token_state, p_holder_category,
    v_program.professional_investor_only, v_regime.equivalence_determined, v_regime.local_license_held,
    v_allowed, v_code, v_reason, p_actor
  );

  PERFORM eg_audit(
    'system', p_actor, 'cross_border.assess', 'sto_program', p_program_id::text,
    NULL,
    jsonb_build_object('destination', p_regime_code, 'allowed', v_allowed, 'code', v_code),
    v_reason
  );

  RETURN jsonb_build_object(
    'ok', v_allowed,
    'code', v_code,
    'reason', v_reason,
    'destination', p_regime_code,
    'tokenState', v_token_state
  );
END;
$$;
