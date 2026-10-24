import { fail, json } from '../../../../lib/api.ts';
import { getSession } from '../../../../lib/auth.ts';
import {
  getStoGate,
  listComplianceAudits,
  listSafeModeEvents,
  listStoPrograms,
  listStoRequirements,
} from '../../../../lib/capital.ts';

export const dynamic = 'force-dynamic';

/** STO 三階段關卡現況。僅總部可讀。 */
export async function GET() {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);
  if (session.role !== 'admin') return fail('FORBIDDEN', 403);

  const programs = await listStoPrograms();
  const gates = await Promise.all(programs.map((program) => getStoGate(program)));
  const requirements = await Promise.all(programs.map((program) => listStoRequirements(program.id)));
  const [audits, safeModes] = await Promise.all([listComplianceAudits(), listSafeModeEvents()]);

  return json({
    programs: gates.map((gate, index) => ({
      code: gate.program.code,
      name: gate.program.name,
      stage: gate.program.stage,
      status: gate.program.status,
      targetInstrument: gate.program.target_instrument,
      professionalInvestorOnly: gate.program.professional_investor_only,
      issuanceCapTwd: gate.program.issuance_cap_twd,
      gate: {
        currentStage: gate.currentStage,
        canAdvance: gate.canAdvance,
        nextStage: gate.nextStage,
        blockers: gate.blockers,
        stageProgress: gate.stageProgress,
        verdict: gate.verdict,
      },
      requirements: (requirements[index] ?? []).map((row) => ({
        stage: row.stage,
        key: row.key,
        label: row.label,
        status: row.status,
        blocking: row.blocking,
      })),
    })),
    audits: audits.map((row) => ({
      programCode: row.program_code,
      layer: row.layer,
      status: row.status,
      performedOn: row.performed_on,
    })),
    safeMode: safeModes.map((row) => ({
      programCode: row.program_code,
      trigger: row.trigger,
      mode: row.mode,
      multiSigCount: row.multi_sig_count,
      expiresAt: row.expires_at,
      resolvedAt: row.resolved_at,
    })),
  });
}
