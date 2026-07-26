import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/users.entity';
import { LoginHistory } from '../../entities/login-history.entity';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
  ) {}

  async getUsers(companyId?: string): Promise<any[]> {
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

  async getLoginHistory(companyId?: string, userId?: string): Promise<any[]> {
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
