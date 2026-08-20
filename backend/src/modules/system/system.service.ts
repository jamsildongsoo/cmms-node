import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/users.entity';
import { LoginHistory } from '../../entities/login-history.entity';
import { AuthRefreshSession } from '../../entities/auth-refresh-session.entity';

export interface SystemUserResponse {
  companyId: string;
  id: string;
  name: string;
  useYn: string;
  roleId: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  title: string | null;
}

export interface LoginHistoryResponse {
  companyId: string;
  userId: string;
  loginIp: string | null;
  loginResult: string;
  loginAt: Date;
}

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    @InjectRepository(AuthRefreshSession)
    private readonly refreshSessionRepository: Repository<AuthRefreshSession>,
  ) {}

  async getUsers(companyId?: string): Promise<SystemUserResponse[]> {
    const cleanCompanyId = companyId?.trim().toUpperCase();
    return this.userRepository.find({
      select: {
        companyId: true,
        id: true,
        name: true,
        useYn: true,
        roleId: true,
        email: true,
        phone: true,
        position: true,
        title: true,
      },
      where: cleanCompanyId ? { companyId: cleanCompanyId } : {},
      order: { companyId: 'ASC', id: 'ASC' },
    });
  }

  async getLoginHistory(companyId?: string, userId?: string): Promise<LoginHistoryResponse[]> {
    const cleanCompanyId = companyId?.trim().toUpperCase();
    const cleanUserId = userId?.trim();
    return this.loginHistoryRepository.find({
      select: {
        companyId: true,
        userId: true,
        loginIp: true,
        loginResult: true,
        loginAt: true,
      },
      where: {
        ...(cleanCompanyId ? { companyId: cleanCompanyId } : {}),
        ...(cleanUserId ? { userId: cleanUserId } : {}),
      },
      order: { loginAt: 'DESC' },
      take: 500,
    });
  }

  async updateUserUseYn(companyId: string, id: string, useYn: string, operator: string): Promise<void> {
    const cleanCoId = companyId.trim().toUpperCase();
    const cleanId = id.trim();
    const cleanUseYn = useYn.trim().toUpperCase();

    if (cleanUseYn !== 'Y' && cleanUseYn !== 'N') {
      throw new BadRequestException('사용 여부는 Y 또는 N 이어야 합니다.');
    }

    // SYSTEM 회사의 SYSTEM 사용자는 사용 여부 수정 제한
    if (cleanCoId === 'SYSTEM' && cleanId === 'SYSTEM') {
      throw new BadRequestException('SYSTEM 계정은 비활성화할 수 없습니다.');
    }

    await this.userRepository.update(
      { companyId: cleanCoId, id: cleanId },
      { useYn: cleanUseYn, updatedBy: operator },
    );

    if (cleanUseYn === 'N') {
      await this.refreshSessionRepository
        .createQueryBuilder()
        .update(AuthRefreshSession)
        .set({ revokedAt: new Date(), updatedBy: operator, updatedAt: new Date() })
        .where('company_id = :companyId', { companyId: cleanCoId })
        .andWhere('user_id = :userId', { userId: cleanId })
        .andWhere('revoked_at IS NULL')
        .execute();
    }
  }

  async validateSystemAdminUser(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      select: { roleId: true },
      where: {
        companyId: 'SYSTEM',
        id: userId,
        useYn: 'Y',
        deleteYn: 'N',
      },
    });
    return user?.roleId?.toUpperCase() === 'SYSTEM';
  }
}
