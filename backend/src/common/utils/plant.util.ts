import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../entities/users.entity';
import { AppModule } from '../constants/module.constants';
import { getTenantContext } from '../context/tenant.context';

/**
 * 조회 요청의 플랜트 범위를 결정합니다.
 * - COMPANY 범위는 요청 플랜트 또는 null(회사 전체)을 반환합니다.
 * - PLANT 범위는 homePlantId만 반환하며 다른 플랜트 요청은 거부합니다.
 * - 저장/상세/삭제처럼 단일 플랜트가 필요한 업무는 호출부에서 필수값을 검증합니다.
 */
export async function resolveActivePlantId(
  dataSource: DataSource,
  companyId: string,
  operatorId: string,
  reqPlantId?: string | null,
  module?: AppModule,
): Promise<string | null> {
  const requestedPlantId = reqPlantId?.trim() || null;
  if (!module) return requestedPlantId;

  const user = await dataSource.getRepository(User).findOne({
    select: { roleId: true, departmentId: true, lastLoginPlantId: true },
    where: { companyId, id: operatorId, deleteYn: 'N', useYn: 'Y' },
  });
  if (!user) throw new ForbiddenException('유효한 사용자를 찾을 수 없습니다.');

  const roleId = user.roleId?.toUpperCase();
  if (companyId === 'SYSTEM' && roleId === 'SYSTEM') return requestedPlantId;
  if (roleId === 'ADMIN') return requestedPlantId;

  if (user.scope === 'COMPANY') return requestedPlantId;

  const activePlantId = getTenantContext().activePlantId?.trim()
    || user.lastLoginPlantId?.trim()
    || null;
  if (!activePlantId) throw new ForbiddenException('사용자의 현재 Plant가 없습니다.');
  if (requestedPlantId && requestedPlantId !== activePlantId) {
    throw new ForbiddenException('접근 권한이 없는 플랜트입니다.');
  }
  return activePlantId;
}
