import { DataSource } from 'typeorm';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';

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
  const user = await dataSource.getRepository(User).findOne({
    select: {
      roleId: true,
      lastLoginPlantId: true,
    },
    where: {
      companyId,
      id: operatorId,
    },
  });
  if (!user) return null;

  if (!user.roleId) {
    return user.lastLoginPlantId;
  }

  const role = await dataSource.getRepository(Role).findOne({
    select: { multiPlant: true },
    where: {
      companyId,
      id: user.roleId,
    },
  });
  const isMulti = role?.multiPlant === 'Y';

  if (!isMulti) {
    return user.lastLoginPlantId;
  }
  return reqPlantId ?? user.lastLoginPlantId ?? null;
}
