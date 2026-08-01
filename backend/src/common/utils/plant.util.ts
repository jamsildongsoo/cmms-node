import { DataSource } from 'typeorm';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';

/**
 * 조회 요청의 플랜트 범위를 결정합니다.
 * - reqPlantId가 있으면 해당 플랜트로 조회합니다.
 * - 멀티플랜트 역할에서 reqPlantId가 없으면 회사 전체 조회를 의미합니다.
 * - 단일 플랜트 역할에서 reqPlantId가 없으면 사용자의 기본 플랜트로 제한합니다.
 * - 저장/상세/삭제처럼 단일 플랜트가 필요한 업무는 호출부에서 별도 검증합니다.
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

  if (!user) return null;
  const role = user.roleId
    ? await dataSource.getRepository(Role).findOne({
      select: { multiPlant: true },
      where: { companyId, id: user.roleId },
    })
    : null;
  return role?.multiPlant === 'Y'
    ? (reqPlantId?.trim() || null)
    : user.lastLoginPlantId;
}
