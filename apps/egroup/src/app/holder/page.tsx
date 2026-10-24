import { Badge, Card, Empty, Notice, PageHeader, Stat, Table } from '../../components/ui.tsx';
import { formatTwd } from '../../lib/format.ts';
import { listTokenLots, listTokenTransitions } from '../../lib/capital.ts';
import { one } from '../../lib/db.ts';
import { requireSession } from '../../lib/auth.ts';

const ADDRESS_CLASS_LABEL: Readonly<Record<string, string>> = {
  platform: '平台內部錢包',
  secondary_market: '合規二級市場',
  custody: '合規託管',
};

const ACQUISITION_LABEL: Readonly<Record<string, string>> = {
  purchased: '購買取得',
  earned: '賺取取得',
};

const LOCKUP_LABEL: Readonly<Record<string, string>> = {
  rule_144: 'Rule 144 鎖定',
  earned_exempt: '勞務對價豁免',
  none: '無',
};

const DECISION_LABEL: Readonly<Record<string, string>> = {
  UTILITY_TO_SECURITY: '效用 → 證券',
  SECURITY_TO_UTILITY: '證券 → 效用',
  ALREADY_SECURITY: '維持證券狀態',
  ALREADY_UTILITY: '維持效用狀態',
  CUSTODY_HOLD: '託管持有，狀態不變',
  SAFE_MODE: '安全模式阻擋',
  KYC_REQUIRED: 'KYC 未完成阻擋',
  ADDRESS_UNKNOWN: '地址未綁定阻擋',
  INVESTOR_NOT_ELIGIBLE: '投資人不適格阻擋',
  LOCKUP_ACTIVE: '鎖定期阻擋',
};

interface HolderSelf {
  id: string;
  wallet_address: string;
  address_class: string;
  kyc_status: string;
  kyc_verified_on: string | null;
  investor_category: string;
  jurisdiction: string;
}

export default async function HolderPage() {
  const session = await requireSession();

  const holder = await one<HolderSelf>(
    `SELECT id, wallet_address, address_class, kyc_status,
            to_char(kyc_verified_on, 'YYYY-MM-DD') AS kyc_verified_on,
            investor_category, jurisdiction
       FROM token_holders
      WHERE account_id = $1`,
    [session.accountId],
  );

  if (holder === null) {
    return (
      <>
        <PageHeader
          title="代幣持有人專區"
          subtitle="此專區與餐食訂購完全分離。買餐不需要持有代幣，持有代幣也不會帶來餐食折扣或優先權。"
        />
        <Card>
          <Empty>此帳號尚未完成代幣持有人身分綁定。代幣採身分綁定，須先完成 KYC 才能建立錢包地址。</Empty>
        </Card>
      </>
    );
  }

  const [lots, transitions] = await Promise.all([listTokenLots(holder.id), listTokenTransitions(50)]);
  const ownTransitions = transitions.filter((row) => row.holder_email === session.email);

  const utility = lots.filter((lot) => lot.state === 'ST+' && lot.status === 'active').reduce((sum, lot) => sum + lot.quantity, 0);
  const security = lots.filter((lot) => lot.state === 'ST' && lot.status === 'active').reduce((sum, lot) => sum + lot.quantity, 0);
  const earned = lots.filter((lot) => lot.acquisition === 'earned' && lot.status === 'active').reduce((sum, lot) => sum + lot.quantity, 0);
  const purchased = lots.filter((lot) => lot.acquisition === 'purchased' && lot.status === 'active').reduce((sum, lot) => sum + lot.quantity, 0);

  return (
    <>
      <PageHeader
        title="代幣持有人專區"
        subtitle="此專區與餐食訂購完全分離。買餐不需要持有代幣，持有代幣也不會帶來餐食折扣或優先權。"
      />

      <div className="grid grid-4">
        <Stat label="效用狀態" value={utility} hint="平台內部錢包持有" />
        <Stat label="證券狀態" value={security} hint="合規二級市場持有" />
        <Stat label="賺取取得" value={earned} hint="勞務對價，豁免鎖定期" />
        <Stat label="購買取得" value={purchased} hint="適用 Rule 144 鎖定期" />
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>身分綁定</h2>
          <div className="divider" />
          <Table head={['錢包地址', '地址性質', 'KYC', '驗證日', '投資人類別', '管轄']}>
            <tr>
              <td className="small muted">{holder.wallet_address}</td>
              <td>{ADDRESS_CLASS_LABEL[holder.address_class] ?? holder.address_class}</td>
              <td>
                <Badge tone={holder.kyc_status === 'verified' ? 'ok' : 'warn'}>
                  {holder.kyc_status === 'verified' ? '已驗證' : holder.kyc_status === 'pending' ? '待驗證' : '未通過'}
                </Badge>
              </td>
              <td className="small">{holder.kyc_verified_on ?? '—'}</td>
              <td>{holder.investor_category === 'general' ? '一般投資人' : holder.investor_category === 'professional' ? '專業投資人' : '合格投資人'}</td>
              <td>{holder.jurisdiction}</td>
            </tr>
          </Table>
          {holder.kyc_status !== 'verified' ? (
            <div style={{ marginTop: 12 }}>
              <Notice tone="danger">KYC 尚未完成，此地址不得收受代幣，也不得參與 Social Mining 發放。</Notice>
            </div>
          ) : null}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>我的批次</h2>
          <div className="muted small">
            法律狀態由接收地址性質自動決定，不由持有人自行選擇。所有權人未變，僅規範面向切換。
          </div>
          <div className="divider" />
          {lots.length === 0 ? (
            <Empty>目前沒有代幣批次。</Empty>
          ) : (
            <Table head={['計畫', '數量', '取得方式', '取得時間', '對價', '鎖定依據', '鎖定至', '法律狀態']}>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.program_code}</td>
                  <td>{lot.quantity}</td>
                  <td>
                    <Badge tone={lot.acquisition === 'earned' ? 'info' : 'warn'}>
                      {ACQUISITION_LABEL[lot.acquisition] ?? lot.acquisition}
                    </Badge>
                  </td>
                  <td className="small">{lot.acquired_at}</td>
                  <td>{lot.consideration_twd > 0 ? formatTwd(lot.consideration_twd) : '無'}</td>
                  <td className="small">{LOCKUP_LABEL[lot.lockup_basis] ?? lot.lockup_basis}</td>
                  <td className="small">{lot.lockup_until ?? '—'}</td>
                  <td>
                    <Badge tone={lot.state === 'ST' ? 'warn' : 'info'}>{lot.state}</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>我的狀態轉換</h2>
          <div className="divider" />
          {ownTransitions.length === 0 ? (
            <Empty>目前沒有狀態轉換紀錄。</Empty>
          ) : (
            <Table head={['時間', '轉換', '觸發', '接收地址性質', '判定', '法律依據']}>
              {ownTransitions.map((row) => (
                <tr key={row.id}>
                  <td className="small">{row.occurred_at}</td>
                  <td>
                    {row.from_state} → {row.to_state ?? '（不變）'}
                  </td>
                  <td className="small">{row.trigger === 'address_class' ? '地址性質' : row.trigger === 'safe_mode' ? '安全模式' : '人工介入'}</td>
                  <td className="small">{ADDRESS_CLASS_LABEL[row.to_address_class] ?? row.to_address_class}</td>
                  <td>
                    <Badge tone={row.to_state === null ? 'danger' : 'ok'}>
                      {DECISION_LABEL[row.decision_code] ?? row.decision_code}
                    </Badge>
                  </td>
                  <td className="small muted">{row.legal_basis}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">
          代幣不保本、不保息，且不代表餐食服務的優先權或折扣。投資決策應以正式揭露文件為準，不以本頁資訊為唯一依據。
        </Notice>
      </div>
    </>
  );
}
