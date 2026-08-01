/* =========================================================================
   AuthService — 로그인, 토큰 발급, 사용자 관리

   Access token은 30분, refresh token은 3일을 기본값으로 사용한다.
   Access token은 Authorization Bearer로만 전달하고, refresh token은
   HttpOnly cookie + 서버 세션 테이블로 관리한다.
   ========================================================================= */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import {
  JwtPayload,
  LoginResponse,
  RefreshJwtPayload,
  UserProfileResponse,
} from './auth.interfaces';
import {
  LoginRequestDto,
  PasswordChangeRequestDto,
  SignUpRequestDto,
  UserUpdateRequestDto,
} from './dto/auth-request.dto';
import { AppModule } from '../../common/constants/module.constants';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';
import { Plant } from '../../entities/plant.entity';
import { Company } from '../../entities/company.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { LoginHistory } from '../../entities/login-history.entity';
import { AuthRefreshSession } from '../../entities/auth-refresh-session.entity';

@Injectable()
export class AuthService {
  private readonly passwordExpiryDays: number;
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;
  private readonly accessTokenSeconds: number;
  private readonly refreshTokenSeconds: number;
  private readonly refreshCookieName: string;
  private readonly refreshCookieSecure: boolean;
  private readonly refreshCookieSameSite: 'strict' | 'lax' | 'none';
  private readonly refreshCookiePath: string;
  private readonly refreshSecret: string;

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
    @InjectRepository(AuthRefreshSession)
    private readonly refreshSessionRepository: Repository<AuthRefreshSession>,
  ) {
    this.passwordExpiryDays = config.get<number>('PASSWORD_EXPIRY_DAYS', 90);
    this.maxFailedAttempts = config.get<number>('PASSWORD_MAX_FAILED', 5);
    this.lockMinutes = config.get<number>('PASSWORD_LOCK_MINUTES', 30);
    this.accessTokenSeconds = Number(config.get<string>('JWT_EXPIRATION', '1800')) || 1800;
    this.refreshTokenSeconds = Number(config.get<string>('JWT_REFRESH_EXPIRATION', '259200')) || 259200;
    this.refreshCookieName = config.get<string>('JWT_REFRESH_COOKIE_NAME', 'cmms_refresh');
    this.refreshCookieSecure = config.get<string>(
      'JWT_REFRESH_COOKIE_SECURE',
      config.get<string>('NODE_ENV') === 'production' ? 'true' : 'false',
    ) === 'true';
    this.refreshCookieSameSite = this.parseSameSite(
      config.get<string>('JWT_REFRESH_COOKIE_SAMESITE', 'strict'),
    );
    this.refreshCookiePath = config.get<string>('JWT_REFRESH_COOKIE_PATH', '/api/auth');
    this.refreshSecret = config.get<string>('JWT_REFRESH_SECRET')
      || config.getOrThrow<string>('JWT_SECRET');
  }

  async login(
    req: LoginRequestDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ response: LoginResponse; refreshToken: string }> {
    const companyId = req.companyId.toUpperCase().trim();
    const { user, multiPlant } = await this.findActiveUser(companyId, req.id);
    if (!user) {
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException('존재하지 않거나 사용 중지된 사용자입니다.');
    }

    const now = new Date();
    if (user.accountLockedUntil && user.accountLockedUntil > now) {
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException(
        `계정이 잠겼습니다. ${user.accountLockedUntil} 이후 다시 시도하세요.`,
      );
    }

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

    let plantId: string | null = user.lastLoginPlantId;
    if (!plantId) {
      const plant = await this.plantRepository.findOne({
        select: { id: true },
        where: { companyId, deleteYn: 'N' },
        order: { id: 'ASC' },
      });
      plantId = plant?.id ?? null;
    }

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

    const expired = !!(
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() + this.passwordExpiryDays * 86400000 < now.getTime()
    );
    const mustChange = user.mustChangePassword === 'Y' || expired;

    const payload: JwtPayload = {
      sub: `${companyId}:${req.id}`,
      companyId,
      userId: req.id,
      roleId: user.roleId ?? '',
      departmentId: user.departmentId ?? null,
      lastLoginPlantId: plantId,
      multiPlant,
    };
    const accessToken = this.signAccessToken(payload);
    const company = await this.companyRepository.findOne({
      select: { name: true },
      where: { id: companyId },
    });
    const permissions = await this.resolvePermissions(companyId, user.roleId ?? '');
    const response = this.buildLoginResponse(
      accessToken,
      companyId,
      company?.name ?? companyId,
      req.id,
      user,
      plantId,
      multiPlant,
      mustChange,
      expired,
      permissions,
    );
    const refresh = await this.issueRefreshSession(companyId, req.id, ipAddress, userAgent);

    return { response, refreshToken: refresh.token };
  }

  applyRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(this.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: this.refreshCookieSecure,
      sameSite: this.refreshCookieSameSite,
      path: this.refreshCookiePath,
      maxAge: this.refreshTokenSeconds * 1000,
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.refreshCookieSecure,
      sameSite: this.refreshCookieSameSite,
      path: this.refreshCookiePath,
    });
  }

  async refresh(
    cookieHeader: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ response: LoginResponse; refreshToken: string }> {
    const oldToken = this.extractCookie(cookieHeader, this.refreshCookieName);
    if (!oldToken) throw new UnauthorizedException('refresh token이 없습니다.');

    let decoded: RefreshJwtPayload;
    try {
      decoded = this.jwtService.verify<RefreshJwtPayload>(oldToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('만료되었거나 유효하지 않은 refresh token입니다.');
    }

    if (decoded.type !== 'refresh' || !decoded.sessionId) {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const session = await this.refreshSessionRepository.findOne({
      where: {
        companyId: decoded.companyId,
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        deleteYn: 'N',
      },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('refresh 세션이 유효하지 않습니다.');
    }
    if (session.tokenHash !== this.hashToken(oldToken)) {
      await this.revokeRefreshSession(session, 'SYSTEM');
      throw new UnauthorizedException('refresh token 검증에 실패했습니다.');
    }

    const { user, multiPlant } = await this.findActiveUser(decoded.companyId, decoded.userId);
    if (!user) {
      await this.revokeRefreshSession(session, 'SYSTEM');
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const payload: JwtPayload = {
      sub: `${decoded.companyId}:${decoded.userId}`,
      companyId: decoded.companyId,
      userId: decoded.userId,
      roleId: user.roleId ?? '',
      departmentId: user.departmentId ?? null,
      lastLoginPlantId: user.lastLoginPlantId ?? null,
      multiPlant,
    };
    const accessToken = this.signAccessToken(payload);
    const company = await this.companyRepository.findOne({
      select: { name: true },
      where: { id: decoded.companyId },
    });
    const permissions = await this.resolvePermissions(decoded.companyId, user.roleId ?? '');
    const expired = !!(
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() + this.passwordExpiryDays * 86400000 < Date.now()
    );
    const response = this.buildLoginResponse(
      accessToken,
      decoded.companyId,
      company?.name ?? decoded.companyId,
      decoded.userId,
      user,
      user.lastLoginPlantId ?? null,
      multiPlant,
      user.mustChangePassword === 'Y' || expired,
      expired,
      permissions,
    );
    const rotated = await this.rotateRefreshSession(
      session,
      decoded.companyId,
      decoded.userId,
      ipAddress,
      userAgent,
    );

    return { response, refreshToken: rotated.token };
  }

  async logout(cookieHeader: string): Promise<void> {
    const token = this.extractCookie(cookieHeader, this.refreshCookieName);
    if (!token) return;

    const decoded = this.tryVerifyRefreshToken(token);
    if (!decoded?.sessionId) return;

    const session = await this.refreshSessionRepository.findOne({
      where: {
        companyId: decoded.companyId,
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        deleteYn: 'N',
      },
    });
    if (!session) return;
    await this.revokeRefreshSession(session, decoded.userId);
  }

  async signUp(req: SignUpRequestDto): Promise<void> {
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

  async updateMyProfile(
    companyId: string,
    userId: string,
    req: UserUpdateRequestDto,
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

  async changePassword(
    companyId: string,
    userId: string,
    req: PasswordChangeRequestDto,
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
    await this.revokeAllUserRefreshSessions(companyId, userId, userId);
  }

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
      multiPlant: user ? await this.getMultiPlant(companyId, user.roleId) : 'N',
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

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, { expiresIn: this.accessTokenSeconds });
  }

  private signRefreshToken(payload: RefreshJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTokenSeconds,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseSameSite(value: string): 'strict' | 'lax' | 'none' {
    if (value === 'lax' || value === 'none') return value;
    return 'strict';
  }

  private extractCookie(cookieHeader: string, name: string): string | null {
    const cookies = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
    for (const cookie of cookies) {
      const [key, ...rest] = cookie.split('=');
      if (key === name) {
        return decodeURIComponent(rest.join('='));
      }
    }
    return null;
  }

  private tryVerifyRefreshToken(token: string): RefreshJwtPayload | null {
    try {
      return this.jwtService.verify<RefreshJwtPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      return null;
    }
  }

  private async issueRefreshSession(
    companyId: string,
    userId: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ token: string; sessionId: string }> {
    const sessionId = randomUUID();
    const token = this.signRefreshToken({
      sub: `${companyId}:${userId}`,
      companyId,
      userId,
      sessionId,
      type: 'refresh',
    });
    const now = new Date();
    await this.refreshSessionRepository.save({
      companyId,
      userId,
      sessionId,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(now.getTime() + this.refreshTokenSeconds * 1000),
      lastUsedAt: now,
      revokedAt: null,
      ipAddress,
      userAgent: userAgent ?? null,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      deleteYn: 'N',
    });
    return { token, sessionId };
  }

  private async rotateRefreshSession(
    session: AuthRefreshSession,
    companyId: string,
    userId: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ token: string; sessionId: string }> {
    await this.revokeRefreshSession(session, userId);
    return this.issueRefreshSession(companyId, userId, ipAddress, userAgent);
  }

  private async revokeRefreshSession(
    session: AuthRefreshSession,
    updatedBy: string,
  ): Promise<void> {
    await this.refreshSessionRepository.update(
      { sessionNo: session.sessionNo },
      {
        revokedAt: new Date(),
        updatedAt: new Date(),
        updatedBy,
      },
    );
  }

  private async revokeAllUserRefreshSessions(
    companyId: string,
    userId: string,
    updatedBy: string,
  ): Promise<void> {
    await this.refreshSessionRepository
      .createQueryBuilder()
      .update(AuthRefreshSession)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
        updatedBy,
      })
      .where('company_id = :companyId', { companyId })
      .andWhere('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async resolvePermissions(
    companyId: string,
    roleId: string,
  ): Promise<Record<string, { C: string; R: string; U: string; D: string; A: string }>> {
    if (roleId?.toUpperCase() === 'SYSTEM' && companyId === 'SYSTEM') {
      return Object.fromEntries(Object.values(AppModule).map((module) => [
        module,
        { C: 'Y', R: 'Y', U: 'Y', D: 'Y', A: 'Y' },
      ]));
    }

    const permissionRows = roleId
      ? await this.roleDetailRepository.find({ where: { companyId, roleId } })
      : [];
    return Object.fromEntries(permissionRows.map((row) => [
      row.moduleDetail,
      { C: row.permC, R: row.permR, U: row.permU, D: row.permD, A: row.permA },
    ]));
  }

  private buildLoginResponse(
    accessToken: string,
    companyId: string,
    companyName: string,
    userId: string,
    user: User,
    lastLoginPlantId: string | null,
    multiPlant: 'Y' | 'N',
    mustChange: boolean,
    expired: boolean,
    permissions: Record<string, { C: string; R: string; U: string; D: string; A: string }>,
  ): LoginResponse {
    return {
      accessToken,
      companyId,
      companyName,
      id: userId,
      name: user.name,
      roleId: user.roleId ?? '',
      departmentId: user.departmentId ?? null,
      position: user.position ?? null,
      title: user.title ?? null,
      lastLoginPlantId,
      multiPlant,
      mustChangePassword: mustChange,
      passwordExpired: expired,
      permissions,
    };
  }
}
