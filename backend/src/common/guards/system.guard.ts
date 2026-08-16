import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../entities/users.entity';
import { JwtPayload } from '../../modules/auth/auth.interfaces';

@Injectable()
export class SystemGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user || user.companyId !== 'SYSTEM' || user.roleId.toUpperCase() !== 'SYSTEM') {
      throw new ForbiddenException('SYSTEM 권한이 필요합니다.');
    }

    const systemUser = await this.dataSource.getRepository(User).findOne({
      select: { roleId: true },
      where: {
        companyId: 'SYSTEM',
        id: user.userId,
        roleId: 'SYSTEM',
        useYn: 'Y',
        deleteYn: 'N',
      },
    });
    if (!systemUser) {
      throw new ForbiddenException('유효한 SYSTEM 사용자를 확인할 수 없습니다.');
    }
    return true;
  }
}
