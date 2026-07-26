/* =========================================================================
   AuthService — 로그인, 토큰 발급, 사용자 관리
   
   [B안 확정] JWT 페이로드에 roleId, departmentId, lastLoginPlantId 포함
   → 이후 요청에서 DB 조회 불필요
   
   roleId/departmentId 변경 시 기존 토큰은 만료(최대 30분)까지 구 값 유지.
   30분 세션이므로 실운영에서 허용 가능한 지연.
   ========================================================================= */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  JwtPayload,
  LoginRequest,
  LoginResponse,
  SignUpRequest,
  PasswordChangeRequest,
  UserUpdateRequest,
  UserProfileResponse,
} from './auth.interfaces';
import { AppModule } from '../../common/constants/module.constants';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';
import { Plant } from '../../entities/plant.entity';
import { Company } from '../../entities/company.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { LoginHistory } from '../../entities/login-history.entity';

@Injectable()
export class AuthService {
  private readonly passwordExpiryDays: number;
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Plant)
    private readonly plantRepository: Repository<Plant>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(RoleDetail)
    private readonly roleDetailRepository: Repository<RoleDetail>,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
  ) {
    this.passwordExpiryDays = config.get<number>('PASSWORD_EXPIRY_DAYS', 90);
    this.maxFailedAttempts = config.get<number>('PASSWORD_MAX_FAILED', 5);
    this.lockMinutes = config.get<number>('PASSWORD_LOCK_MINUTES', 30);
  }

  // =========================================================================
  // 로그인
  // =========================================================================
  async login(req: LoginRequest, ipAddress: string): Promise<LoginResponse> {
    const companyId = req.companyId.toUpperCase().trim();

    // 1. 사용자 조회
    const { user, multiPlant } = await this.findActiveUser(companyId, req.id);
    if (!user) {
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException('존재하지 않거나 사용 중지된 사용자입니다.');
    }

    const now = new Date();

    // 2. 계정 잠금 확인
    if (user.accountLockedUntil && user.accountLockedUntil > now) {
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException(
        `계정이 잠겼습니다. ${user.accountLockedUntil} 이후 다시 시도하세요.`,
      );
    }

    // 3. 비밀번호 검증
    const passwordMatch = await bcrypt.compare(req.password, user.passwordHash);
    if (!passwordMatch) {
      const fails = (user.failedLoginCount ?? 0) + 1;
      let lockedUntil: Date | null = null;
      let msg: string;

      if (fails >= this.maxFailedAttempts) {
        lockedUntil = new Date(now.getTime() + this.lockMinutes * 60 * 1000);
        msg = `비밀번호 ${this.maxFailedAttempts}회 오류로 ${this.lockMinutes}분간 잠겼습니다.`;
        await this.userRepository.update(
          { companyId, id: req.id },
          { failedLoginCount: 0, accountLockedUntil: lockedUntil },
        );
      } else {
        msg = `비밀번호가 일치하지 않습니다. (실패 ${fails}/${this.maxFailedAttempts})`;
        await this.userRepository.update(
          { companyId, id: req.id },
          { failedLoginCount: fails },
        );
      }
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException(msg);
    }

    // 4. 플랜트 자동 해소: lastLoginPlantId null이면 첫 활성 플랜트 자동 매핑
    let plantId: string | null = user.lastLoginPlantId;
    if (!plantId) {
      const plant = await this.plantRepository.findOne({
        select: { id: true },
        where: { companyId, deleteYn: 'N' },
        order: { id: 'ASC' },
      });
      plantId = plant?.id ?? null;
    }

    // 5. 성공 처리
    await this.userRepository.update(
      { companyId, id: req.id },
      {
        failedLoginCount: 0,
        accountLockedUntil: null,
        lastLoginAt: now,
        lastLoginIp: ipAddress,
        lastLoginPlantId: plantId,
      },
    );
    await this.recordLoginHistory(companyId, req.id, ipAddress, 'SUCCESS');

    // 6. 비밀번호 만료 판단
    const expired =
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() +
        this.passwordExpiryDays * 86400000 <
        now.getTime();
    const mustChange =
      user.mustChangePassword === 'Y' || expired;

    // 7. [B안] JWT 페이로드에 roleId, departmentId, lastLoginPlantId 포함
    const payload: JwtPayload = {
      sub: `${companyId}:${req.id}`,
      companyId,
      userId: req.id,
      roleId: user.roleId ?? '',
      departmentId: user.departmentId ?? null,
      lastLoginPlantId: plantId,
      multiPlant,
    };
    const accessToken = this.jwtService.sign(payload);

    // 8. 회사명 조회
    const company = await this.companyRepository.findOne({
      select: { name: true },
      where: { id: companyId },
    });
    const companyName = company?.name ?? companyId;
    const permissionRows = user.roleId
      ? await this.roleDetailRepository.find({
          where: { companyId, roleId: user.roleId },
        })
      : [];
    const permissions = user.roleId?.toUpperCase() === 'SYSTEM' && companyId === 'SYSTEM'
      ? Object.fromEntries(Object.values(AppModule).map((module) => [
          module,
          { C: 'Y', R: 'Y', U: 'Y', D: 'Y', A: 'Y' },
        ]))
      : Object.fromEntries(permissionRows.map((row) => [
          row.moduleDetail,
          { C: row.permC, R: row.permR, U: row.permU, D: row.permD, A: row.permA },
        ]));

    return {
      accessToken,
      companyId,
      companyName,
      id: req.id,
      name: user.name,
      roleId: user.roleId ?? '',
      departmentId: user.departmentId ?? null,
      position: user.position ?? null,
      title: user.title ?? null,
      lastLoginPlantId: plantId,
      multiPlant,
      mustChangePassword: !!mustChange,
      passwordExpired: !!expired,
      permissions,
    };
  }

  // =========================================================================
  // 토큰 갱신 — [B안] DB 조회 후 최신 roleId/departmentId 재발급
  // =========================================================================
  async refresh(oldToken: string): Promise<string> {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(oldToken);
    } catch {
      throw new UnauthorizedException('만료되었거나 유효하지 않은 토큰입니다.');
    }

    // refresh 시 DB에서 최신 사용자 정보 재조회 → roleId 변경 즉시 반영
    const { user, multiPlant } = await this.findActiveUser(
      decoded.companyId,
      decoded.userId,
    );
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const payload: JwtPayload = {
      sub: `${decoded.companyId}:${decoded.userId}`,
      companyId: decoded.companyId,
      userId: decoded.userId,
      roleId: user.roleId ?? '',
      departmentId: user.departmentId ?? null,
      lastLoginPlantId: user.lastLoginPlantId ?? null,
      multiPlant,
    };
    return this.jwtService.sign(payload);
  }

  // =========================================================================
  // 회원가입
  // =========================================================================
  async signUp(req: SignUpRequest): Promise<void> {
    const companyId = req.companyId.toUpperCase().trim();

    const company = await this.companyRepository.findOne({
      select: { id: true },
      where: { id: companyId, deleteYn: 'N' },
    });
    if (!company) {
      throw new BadRequestException('존재하지 않는 회사 코드입니다.');
    }

    const existing = await this.userRepository.findOne({
      select: { id: true },
      where: { companyId, id: req.id },
    });
    if (existing) {
      throw new BadRequestException('이미 사용 중인 아이디입니다.');
    }

    const hash = await bcrypt.hash(req.password, 12);
    await this.userRepository.save(this.userRepository.create({
      companyId,
      id: req.id,
      name: req.name,
      passwordHash: hash,
      departmentId: req.departmentId ?? null,
      roleId: null,
      email: req.email?.trim() || null,
      phone: req.phone?.trim() || null,
      position: req.position?.trim() || null,
      title: req.title?.trim() || null,
      useYn: 'N',
      deleteYn: 'N',
      createdBy: req.id,
      updatedBy: req.id,
    }));
  }

  // =========================================================================
  // 내 정보 조회
  // =========================================================================
  async getMyProfile(companyId: string, userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepository.findOne({
      where: { companyId, id: userId, deleteYn: 'N' },
    });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    const multiPlant = await this.getMultiPlant(companyId, user.roleId);

    return {
      companyId: user.companyId,
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      position: user.position ?? null,
      title: user.title ?? null,
      departmentId: user.departmentId ?? null,
      roleId: user.roleId ?? '',
      lastLoginPlantId: user.lastLoginPlantId ?? null,
      multiPlant,
      mustChangePassword: user.mustChangePassword === 'Y',
    };
  }

  // =========================================================================
  // 내 정보 수정
  // =========================================================================
  async updateMyProfile(
    companyId: string,
    userId: string,
    req: UserUpdateRequest,
  ): Promise<void> {
    await this.userRepository.update(
      { companyId, id: userId, deleteYn: 'N' },
      {
        ...(req.name !== undefined ? { name: req.name } : {}),
        ...(req.email !== undefined ? { email: req.email ?? null } : {}),
        ...(req.phone !== undefined ? { phone: req.phone ?? null } : {}),
        ...(req.position !== undefined ? { position: req.position ?? null } : {}),
        ...(req.title !== undefined ? { title: req.title ?? null } : {}),
        updatedBy: userId,
      },
    );
  }

  // =========================================================================
  // 비밀번호 변경
  // =========================================================================
  async changePassword(
    companyId: string,
    userId: string,
    req: PasswordChangeRequest,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      select: { passwordHash: true },
      where: { companyId, id: userId, deleteYn: 'N' },
    });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const match = await bcrypt.compare(req.currentPassword, user.passwordHash);
    if (!match) throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');

    const hash = await bcrypt.hash(req.newPassword, 12);
    await this.userRepository.update(
      { companyId, id: userId },
      {
        passwordHash: hash,
        passwordChangedAt: new Date(),
        mustChangePassword: 'N',
        updatedBy: userId,
      },
    );
  }

  // =========================================================================
  // 유틸
  // =========================================================================
  private async recordLoginHistory(
    companyId: string,
    userId: string,
    ipAddress: string,
    result: 'SUCCESS' | 'FAIL',
  ): Promise<void> {
    await this.loginHistoryRepository.createQueryBuilder()
      .insert()
      .into(LoginHistory)
      .values({
        companyId,
        userId,
        loginIp: ipAddress,
        loginResult: result,
        loginAt: () => 'CURRENT_TIMESTAMP',
      })
      .execute();
  }

  private async findActiveUser(
    companyId: string,
    userId: string,
  ): Promise<{ user: User | null; multiPlant: 'Y' | 'N' }> {
    const user = await this.userRepository.findOne({
      where: {
        companyId,
        id: userId,
        deleteYn: 'N',
        useYn: 'Y',
      },
    });
    return {
      user,
      multiPlant: user
        ? await this.getMultiPlant(companyId, user.roleId)
        : 'N',
    };
  }

  private async getMultiPlant(
    companyId: string,
    roleId: string | null,
  ): Promise<'Y' | 'N'> {
    if (!roleId) return 'N';
    const role = await this.roleRepository.findOne({
      select: { multiPlant: true },
      where: { companyId, id: roleId },
    });
    return role?.multiPlant === 'Y' ? 'Y' : 'N';
  }
}
