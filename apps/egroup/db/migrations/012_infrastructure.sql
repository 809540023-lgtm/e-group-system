-- 區塊鏈基礎設施監管：資產本質、活動本質與技術中性的三重奏。
--
-- 規範來源：博士論文《區塊鏈基礎設施監管的法學方法論》。
-- 本 migration 只建立分類紀錄、計量快照與活動本質判斷，不建立任何對外募集或交易功能。

/* ------------------------------------------------------------------ */
/* 第二章：五大代幣類別                                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS token_classifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol                text UNIQUE NOT NULL,
  name                  text NOT NULL,
  token_class           text NOT NULL
                        CHECK (token_class IN ('physical_asset','services','intangible_asset','native_dlt','stablecoin')),
  represents_tangible   boolean NOT NULL DEFAULT false,
  represents_service    boolean NOT NULL DEFAULT false,
  represents_financial  boolean NOT NULL DEFAULT false,
  indispensable         boolean NOT NULL DEFAULT false,
  pegged_to_reference   boolean NOT NULL DEFAULT false,
  resale_profit_primary boolean NOT NULL DEFAULT false,
  securities_risk       text NOT NULL CHECK (securities_risk IN ('low','medium','high')),
  howey_needed          boolean NOT NULL DEFAULT true,
  -- Howey 四要件（論文第二章第三節第一款）
  howey_money_investment boolean NOT NULL DEFAULT false,
  howey_common_enterprise boolean NOT NULL DEFAULT false,
  howey_profit_expectation boolean NOT NULL DEFAULT false,
  howey_efforts_of_others boolean NOT NULL DEFAULT false,
  legal_analogy         text,
  regulator             text,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_classifications_class_idx ON token_classifications (token_class);

/* ------------------------------------------------------------------ */
/* 第三章：去中心化計量                                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS decentralization_snapshots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain                   text NOT NULL,
  measured_on             date NOT NULL,
  nakamoto_coefficient    integer NOT NULL CHECK (nakamoto_coefficient >= 0),
  gini                    numeric(5,4) NOT NULL CHECK (gini >= 0 AND gini <= 1),
  country_count           integer NOT NULL CHECK (country_count >= 0),
  top5_country_share      numeric(5,4) NOT NULL CHECK (top5_country_share >= 0 AND top5_country_share <= 1),
  staking_ratio           numeric(5,4) NOT NULL CHECK (staking_ratio >= 0 AND staking_ratio <= 1),
  usage_density           numeric(8,6) NOT NULL CHECK (usage_density >= 0),
  single_entity_control   boolean NOT NULL DEFAULT false,
  governance_concentration numeric(5,4) NOT NULL DEFAULT 0
                          CHECK (governance_concentration >= 0 AND governance_concentration <= 1),
  band                    text NOT NULL CHECK (band IN ('centralized','emerging','diffuse')),
  efforts_of_others       boolean NOT NULL DEFAULT true,
  source                  text,
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, measured_on)
);

CREATE INDEX IF NOT EXISTS decentralization_snapshots_chain_idx
  ON decentralization_snapshots (chain, measured_on DESC);

/* ------------------------------------------------------------------ */
/* 第四章：活動本質測試                                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS activity_substance_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject               text NOT NULL,
  role                  text NOT NULL,
  classification        text NOT NULL CHECK (classification IN ('infrastructure','intermediary')),
  core_factors          jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_factors      jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers              jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 論文第五章第四節的三項核心原則
  passivity_satisfied   boolean NOT NULL DEFAULT false,
  neutrality_satisfied  boolean NOT NULL DEFAULT false,
  compensation_satisfied boolean NOT NULL DEFAULT false,
  compensation_kind     text NOT NULL DEFAULT 'fixed'
                        CHECK (compensation_kind IN ('fixed','usage','transaction','remote')),
  exempt                boolean NOT NULL DEFAULT false,
  assessed_on           date NOT NULL DEFAULT CURRENT_DATE,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_substance_assessments_subject_idx
  ON activity_substance_assessments (subject, assessed_on DESC);

/* ------------------------------------------------------------------ */
/* 第五章：不採取行動信函先例                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS no_action_precedents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   text UNIQUE NOT NULL,
  decided_on  date NOT NULL,
  category    text NOT NULL CHECK (category IN ('broker','adviser')),
  subject     text NOT NULL,
  principle   text NOT NULL,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS no_action_precedents_category_idx ON no_action_precedents (category, decided_on);

/* ------------------------------------------------------------------ */
/* 第六章：技術功能內在性                                              */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS technology_function_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_symbol          text NOT NULL,
  function              text NOT NULL
                        CHECK (function IN ('staking','validation','reward_distribution','locking',
                                            'minting_burning','gas_payment','protocol_testing',
                                            'airdrop_claim','onchain_transfer')),
  intrinsic_to_protocol boolean NOT NULL DEFAULT false,
  necessary_for_operation boolean NOT NULL DEFAULT false,
  capital_contribution  boolean NOT NULL DEFAULT false,
  common_enterprise     boolean NOT NULL DEFAULT false,
  profit_expectation    boolean NOT NULL DEFAULT false,
  issuer_relationship   boolean NOT NULL DEFAULT false,
  consumptive_use       boolean NOT NULL DEFAULT false,
  custodial_staking     boolean NOT NULL DEFAULT false,
  non_security          boolean NOT NULL DEFAULT false,
  blockers              jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessed_on           date NOT NULL DEFAULT CURRENT_DATE,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_symbol, function, assessed_on)
);

/* ------------------------------------------------------------------ */
/* 第七章：協議代幣兩階段模型                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS protocol_token_stages (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_symbol            text UNIQUE NOT NULL,
  stage                   text NOT NULL CHECK (stage IN ('pre_functionality','functional')),
  programmed_as_indispensable boolean NOT NULL DEFAULT false,
  deployed_for_actual_use boolean NOT NULL DEFAULT false,
  core_features_complete  boolean NOT NULL DEFAULT false,
  single_issuer_efforts   boolean NOT NULL DEFAULT true,
  regulation_pt_used      boolean NOT NULL DEFAULT false,
  regulation_pt_cap_usd   bigint,
  regulation_pt_offering_usd bigint,
  transitioned_at         timestamptz,
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_token_transitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_symbol    text NOT NULL REFERENCES protocol_token_stages(token_symbol),
  from_stage      text NOT NULL CHECK (from_stage IN ('pre_functionality','functional')),
  to_stage        text NOT NULL CHECK (to_stage IN ('pre_functionality','functional')),
  decision_code   text NOT NULL,
  actor_id        text NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protocol_token_transitions_symbol_idx
  ON protocol_token_transitions (token_symbol, created_at DESC);

/* ------------------------------------------------------------------ */
/* 第七章第六節：DAO 法律實體與責任分配                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS dao_registrations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text UNIQUE NOT NULL,
  entity_form               text NOT NULL
                            CHECK (entity_form IN ('none','wyoming_dao_llc','duna','tennessee_dao','utah_dao')),
  governance_transparent    boolean NOT NULL DEFAULT false,
  member_limited_liability  boolean NOT NULL DEFAULT false,
  minimum_governance_standards boolean NOT NULL DEFAULT false,
  general_partnership_presumption boolean NOT NULL DEFAULT true,
  safe_harbor               boolean NOT NULL DEFAULT false,
  control_holder_threshold  numeric(5,4) NOT NULL DEFAULT 0.05,
  registered_on             date,
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------------------------------------------ */
/* 第七章第七節：跨境三層次解方                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS cross_border_tier_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_symbol          text NOT NULL,
  tier                  text NOT NULL
                        CHECK (tier IN ('framework_alignment','tiered_reporting','real_time_sharing')),
  satisfied             boolean NOT NULL DEFAULT false,
  requirement           text NOT NULL,
  reference             text,
  assessed_on           date NOT NULL DEFAULT CURRENT_DATE,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_symbol, tier, assessed_on)
);

/* ------------------------------------------------------------------ */
/* 活動本質判斷：被阻擋的判斷同樣要留痕                                */
/* ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION eg_assess_activity_substance(
  p_subject text,
  p_role text,
  p_factors jsonb,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_regular     boolean := COALESCE((p_factors->>'regularBusinessForOthers')::boolean, false);
  v_txn_fee     boolean := COALESCE((p_factors->>'transactionBasedCompensation')::boolean, false);
  v_solicit     boolean := COALESCE((p_factors->>'activeSolicitation')::boolean, false);
  v_middleman   boolean := COALESCE((p_factors->>'actsAsMiddleman')::boolean, false);
  v_custody     boolean := COALESCE((p_factors->>'custodyClientAssets')::boolean, false);
  v_discretion  boolean := COALESCE((p_factors->>'discretionaryAuthority')::boolean, false);
  v_advice      boolean := COALESCE((p_factors->>'personalizedAdvice')::boolean, false);
  v_passive     boolean := COALESCE((p_factors->>'passiveTechnicalFunction')::boolean, false);
  v_fixed_fee   boolean := COALESCE((p_factors->>'fixedOrUsageFee')::boolean, false);
  v_publisher   boolean := COALESCE((p_factors->>'publisherException')::boolean, false);
  v_comp_kind   text := COALESCE(p_factors->>'compensationKind', 'fixed');
  v_core        jsonb := '[]'::jsonb;
  v_negative    jsonb := '[]'::jsonb;
  v_class       text;
  v_passivity   boolean;
  v_neutrality  boolean;
  v_comp_ok     boolean;
  v_exempt      boolean;
  v_id          uuid;
BEGIN
  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUBJECT_REQUIRED', 'reason', '必須指明受評估的主體');
  END IF;
  IF p_role IS NULL OR btrim(p_role) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROLE_REQUIRED', 'reason', '必須指明受評估的角色');
  END IF;
  IF v_comp_kind NOT IN ('fixed','usage','transaction','remote') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_COMPENSATION',
      'reason', '報酬結構必須為 fixed、usage、transaction 或 remote');
  END IF;

  -- 論文第四章第二節：核心因素指向中介
  IF v_regular THEN v_core := v_core || to_jsonb('規律性為他人帳戶買賣證券。'::text); END IF;
  IF v_txn_fee THEN v_core := v_core || to_jsonb('收取交易基礎報酬。'::text); END IF;
  IF v_solicit THEN v_core := v_core || to_jsonb('主動招攬證券交易或尋找投資者。'::text); END IF;
  IF v_middleman THEN v_core := v_core || to_jsonb('作為買賣雙方的中介。'::text); END IF;
  IF v_custody THEN v_core := v_core || to_jsonb('保管客戶資金或證券。'::text); END IF;
  IF v_discretion THEN v_core := v_core || to_jsonb('對客戶資產具裁量控制權。'::text); END IF;
  IF v_advice THEN v_core := v_core || to_jsonb('提供個人化投資建議。'::text); END IF;

  -- 論文第四章第二節第二款：否定因素指向基礎設施
  IF v_passive THEN v_negative := v_negative || to_jsonb('僅提供軟體或技術平臺。'::text); END IF;
  IF NOT v_discretion THEN v_negative := v_negative || to_jsonb('對交易無裁量權。'::text); END IF;
  IF NOT v_custody THEN v_negative := v_negative || to_jsonb('不接觸客戶資金或證券。'::text); END IF;
  IF v_fixed_fee THEN v_negative := v_negative || to_jsonb('報酬為固定或使用量基礎。'::text); END IF;
  IF v_publisher THEN v_negative := v_negative || to_jsonb('適用出版者例外。'::text); END IF;

  v_class := CASE WHEN jsonb_array_length(v_core) = 0 THEN 'infrastructure' ELSE 'intermediary' END;

  -- 論文第五章第四節：三項核心原則
  v_passivity  := NOT (v_regular OR v_middleman OR v_discretion);
  v_neutrality := NOT (v_solicit OR v_advice);
  v_comp_ok    := v_comp_kind IN ('fixed','usage');
  v_exempt     := v_class = 'infrastructure' AND v_passivity AND v_neutrality AND v_comp_ok;

  INSERT INTO activity_substance_assessments (
    subject, role, classification, core_factors, negative_factors, blockers,
    passivity_satisfied, neutrality_satisfied, compensation_satisfied,
    compensation_kind, exempt, note
  ) VALUES (
    p_subject, p_role, v_class, v_core, v_negative, v_core,
    v_passivity, v_neutrality, v_comp_ok, v_comp_kind, v_exempt,
    CASE WHEN v_exempt
      THEN '未出現核心因素且三原則齊備，屬基礎設施提供者。'
      ELSE '出現核心因素或三原則未齊備，須依活動本質接受證券中介審查。'
    END
  ) RETURNING id INTO v_id;

  PERFORM eg_audit(
    'system', p_actor, 'infrastructure.activity_substance', 'activity_substance_assessment', v_id::text,
    NULL,
    jsonb_build_object(
      'subject', p_subject, 'role', p_role, 'classification', v_class,
      'exempt', v_exempt, 'coreFactors', v_core, 'compensationKind', v_comp_kind
    ),
    CASE WHEN v_exempt THEN '基礎設施豁免' ELSE '須中介審查' END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', CASE WHEN v_exempt THEN 'INFRASTRUCTURE_EXEMPT' ELSE 'INTERMEDIARY_REVIEW' END,
    'assessmentId', v_id,
    'classification', v_class,
    'exempt', v_exempt,
    'coreFactors', v_core,
    'negativeFactors', v_negative,
    'passivity', v_passivity,
    'neutrality', v_neutrality,
    'compensation', v_comp_ok
  );
END;
$$;

/* ------------------------------------------------------------------ */
/* 協議代幣階段推進：只能前進，不能倒退                                */
/* ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION eg_advance_protocol_token_stage(
  p_token_symbol text,
  p_programmed boolean,
  p_deployed boolean,
  p_core_complete boolean,
  p_single_issuer boolean,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_row       protocol_token_stages;
  v_target    text;
  v_code      text;
  v_reason    text;
BEGIN
  SELECT * INTO v_row FROM protocol_token_stages WHERE token_symbol = p_token_symbol;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOKEN_NOT_FOUND', 'reason', '找不到協議代幣');
  END IF;

  -- 論文第七章第二節：功能性是明確的轉換點，三項條件須同時成立
  v_target := CASE
    WHEN p_programmed AND p_deployed AND p_core_complete THEN 'functional'
    ELSE 'pre_functionality'
  END;

  IF v_target = v_row.stage THEN
    v_code := CASE WHEN v_target = 'functional' THEN 'ALREADY_FUNCTIONAL' ELSE 'REMAINS_PRE_FUNCTIONALITY' END;
    v_reason := CASE WHEN v_target = 'functional'
      THEN '已處於功能階段，無須轉換'
      ELSE '尚未同時滿足編程為不可或缺、已部署供實際使用、核心功能完成三項條件'
    END;
  ELSIF v_target = 'pre_functionality' THEN
    -- 已進入功能階段後不得因單一條件回退而倒退，須走安全模式與人工複核
    v_code := 'STAGE_REGRESSION_BLOCKED';
    v_reason := '已進入功能階段，不得因單一條件變動自動倒退；須經安全模式與人工複核';
  ELSE
    v_code := 'ADVANCED_TO_FUNCTIONAL';
    v_reason := '三項條件同時成立，轉換為功能階段';
  END IF;

  IF v_code = 'ADVANCED_TO_FUNCTIONAL' THEN
    UPDATE protocol_token_stages
       SET stage = 'functional',
           programmed_as_indispensable = p_programmed,
           deployed_for_actual_use = p_deployed,
           core_features_complete = p_core_complete,
           single_issuer_efforts = p_single_issuer,
           transitioned_at = now(),
           updated_at = now()
     WHERE token_symbol = p_token_symbol;
  ELSE
    UPDATE protocol_token_stages
       SET programmed_as_indispensable = p_programmed,
           deployed_for_actual_use = p_deployed,
           core_features_complete = p_core_complete,
           single_issuer_efforts = p_single_issuer,
           updated_at = now()
     WHERE token_symbol = p_token_symbol;
  END IF;

  -- 被阻擋的推進同樣要留痕，否則事後無法證明「當時確實擋下了」
  INSERT INTO protocol_token_transitions (
    token_symbol, from_stage, to_stage, decision_code, actor_id, note
  ) VALUES (
    p_token_symbol, v_row.stage, v_target, v_code, p_actor, v_reason
  );

  PERFORM eg_audit(
    'system', p_actor, 'infrastructure.protocol_token_stage', 'protocol_token_stage', p_token_symbol,
    jsonb_build_object('stage', v_row.stage),
    jsonb_build_object('stage', v_target, 'decision', v_code),
    v_reason
  );

  RETURN jsonb_build_object(
    'ok', v_code = 'ADVANCED_TO_FUNCTIONAL',
    'code', v_code,
    'reason', v_reason,
    'fromStage', v_row.stage,
    'toStage', v_target
  );
END;
$$;
