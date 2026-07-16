import { DataSource } from 'typeorm';

/**
 * 사용자의 권한 역할(Role)에 맞춰 접근 권한이 있는 플랜트 ID를 결정합니다.
 * - 단일 플랜트 사용자: 요청(reqPlantId)과 무관하게 사용자의 last_login_plant_id 고정
 * - 멀티 플랜트 사용자: 요청(reqPlantId)을 수용 (없으면 last_login_plant_id로 폴백)
 *   → 다른 플랜트를 보려면 reqPlantId로 명시 선택해야 한다.
 */
export async function resolveActivePlantId(
  dataSource: DataSource,
  companyId: string,
  operatorId: string,
  reqPlantId?: string | null,
): Promise<string | null> {
  const userRows = await dataSource.query(
    `SELECT role_id, last_login_plant_id FROM users WHERE company_id = $1 AND id = $2`,
    [companyId, operatorId],
  );
  if (!userRows.length) return null;
  const user = userRows[0];

  if (!user.role_id) {
    return user.last_login_plant_id;
  }

  const roleRows = await dataSource.query(
    `SELECT multi_plant FROM role WHERE company_id = $1 AND id = $2`,
    [companyId, user.role_id],
  );
  const isMulti = roleRows[0]?.multi_plant === 'Y';

  if (!isMulti) {
    return user.last_login_plant_id;
  }
  return reqPlantId ?? user.last_login_plant_id ?? null;
}
