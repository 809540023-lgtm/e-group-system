import { fail, json } from '../../../../lib/api.ts';
import { getSession } from '../../../../lib/auth.ts';
import {
  evaluatePassport,
  getRwaSummary,
  listAssetPassports,
  listRwaDistributions,
  listRwaStress,
  listRwaVehicles,
} from '../../../../lib/capital.ts';

export const dynamic = 'force-dynamic';

/** RWA 現況：資產護照、載體、分配與壓力情境。僅總部可讀。 */
export async function GET() {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);
  if (session.role !== 'admin') return fail('FORBIDDEN', 403);

  const asOf = new Date().toISOString().slice(0, 10);
  const [summary, passports, vehicles, distributions, stress] = await Promise.all([
    getRwaSummary(),
    listAssetPassports(),
    listRwaVehicles(),
    listRwaDistributions(),
    listRwaStress(),
  ]);

  return json({
    asOf,
    summary,
    passports: passports.map((row) => ({
      assetNo: row.asset_no,
      kind: row.kind,
      stationName: row.station_name,
      appraisedValueTwd: row.appraised_value_twd,
      existingLienTwd: row.existing_lien_twd,
      eligibility: evaluatePassport(row, asOf),
    })),
    vehicles: vehicles.map((row) => ({
      code: row.code,
      name: row.name,
      kind: row.kind,
      status: row.status,
      totalUnits: row.total_units,
      allocatedTwd: Number(row.allocated_twd),
      maintenanceReservePct: Number(row.maintenance_reserve_pct),
      seniorDebtTwd: row.senior_debt_twd,
    })),
    distributions: distributions.map((row) => ({
      vehicleCode: row.vehicle_code,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      equipmentRentTwd: row.equipment_rent_twd,
      excludedOperatingRevenueTwd: row.operating_revenue_twd,
      distributableTwd: row.distributable_twd,
      perUnitTwd: row.per_unit_twd,
      status: row.status,
    })),
    stress: stress.map((row) => ({
      vehicleCode: row.vehicle_code,
      scenario: row.scenario,
      shortfallTwd: row.shortfall_twd,
      principalAtRisk: row.principal_at_risk,
    })),
  });
}
