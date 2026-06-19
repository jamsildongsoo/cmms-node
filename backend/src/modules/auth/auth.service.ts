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
import { DataSource } from 'typeorm';
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

@Injectable()
export class AuthService {
  private readonly passwordExpiryDays: number;
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
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
    const users = await this.dataSource.query<any[]>(
      `SELECT u.*, r.multi_plant
       FROM users u
       LEFT JOIN role r ON r.company_id = u.company_id AND r.id = u.role_id
       WHERE u.company_id = $1 AND u.id = $2
         AND u.delete_yn = 'N' AND u.use_yn = 'Y'`,
      [companyId, req.id],
    );
    const user = users[0];
    if (!user) {
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException('존재하지 않거나 사용 중지된 사용자입니다.');
    }

    const now = new Date();

    // 2. 계정 잠금 확인
    if (user.account_locked_until && new Date(user.account_locked_until) > now) {
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException(
        `계정이 잠겼습니다. ${user.account_locked_until} 이후 다시 시도하세요.`,
      );
    }

    // 3. 비밀번호 검증
    const passwordMatch = await bcrypt.compare(req.password, user.password_hash);
    if (!passwordMatch) {
      const fails = (user.failed_login_count ?? 0) + 1;
      let lockedUntil: Date | null = null;
      let msg: string;

      if (fails >= this.maxFailedAttempts) {
        lockedUntil = new Date(now.getTime() + this.lockMinutes * 60 * 1000);
        msg = `비밀번호 ${this.maxFailedAttempts}회 오류로 ${this.lockMinutes}분간 잠겼습니다.`;
        await this.dataSource.query(
          `UPDATE users SET failed_login_count=0, account_locked_until=$1 WHERE company_id=$2 AND id=$3`,
          [lockedUntil, companyId, req.id],
        );
      } else {
        msg = `비밀번호가 일치하지 않습니다. (실패 ${fails}/${this.maxFailedAttempts})`;
        await this.dataSource.query(
          `UPDATE users SET failed_login_count=$1 WHERE company_id=$2 AND id=$3`,
          [fails, companyId, req.id],
        );
      }
      await this.recordLoginHistory(companyId, req.id, ipAddress, 'FAIL');
      throw new UnauthorizedException(msg);
    }

    // 4. 플랜트 자동 해소: lastLoginPlantId null이면 첫 활성 플랜트 자동 매핑
    let plantId: string | null = user.last_login_plant_id;
    if (!plantId) {
      const plants = await this.dataSource.query<{ id: string }[]>(
        `SELECT id FROM plant WHERE company_id=$1 AND delete_yn='N' ORDER BY id LIMIT 1`,
        [companyId],
      );
      plantId = plants[0]?.id ?? null;
    }

    // 5. 성공 처리
    await this.dataSource.query(
      `UPDATE users
       SET failed_login_count=0, account_locked_until=NULL,
           last_login_at=$1, last_login_ip=$2, last_login_plant_id=$3
       WHERE company_id=$4 AND id=$5`,
      [now, ipAddress, plantId, companyId, req.id],
    );
    await this.recordLoginHistory(companyId, req.id, ipAddress, 'SUCCESS');

    // 6. 비밀번호 만료 판단
    const expired =
      user.password_changed_at &&
      new Date(user.password_changed_at).getTime() +
        this.passwordExpiryDays * 86400000 <
        now.getTime();
    const mustChange =
      user.must_change_password === 'Y' || expired;

    // 7. [B안] JWT 페이로드에 roleId, departmentId, lastLoginPlantId 포함
    const payload: JwtPayload = {
      sub: `${companyId}:${req.id}`,
      companyId,
      userId: req.id,
      roleId: user.role_id ?? '',
      departmentId: user.department_id ?? null,
      lastLoginPlantId: plantId,
      multiPlant: user.multi_plant === 'Y' ? 'Y' : 'N',
    };
    const accessToken = this.jwtService.sign(payload);

    // 8. 회사명 조회
    const companies = await this.dataSource.query<{ name: string }[]>(
      `SELECT name FROM company WHERE id=$1`,
      [companyId],
    );
    const companyName = companies[0]?.name ?? companyId;
    const permissionRows = await this.dataSource.query<any[]>(
      `SELECT module_detail, perm_c, perm_r, perm_u, perm_d, perm_a
       FROM role_detail WHERE company_id = $1 AND role_id = $2`,
      [companyId, user.role_id],
    );
    const permissions = user.role_id?.toUpperCase() === 'SYSTEM' && companyId === 'SYSTEM'
      ? Object.fromEntries(Object.values(AppModule).map((module) => [
          module,
          { C: 'Y', R: 'Y', U: 'Y', D: 'Y', A: 'Y' },
        ]))
      : Object.fromEntries(permissionRows.map((row) => [
          row.module_detail,
          { C: row.perm_c, R: row.perm_r, U: row.perm_u, D: row.perm_d, A: row.perm_a },
        ]));

    return {
      accessToken,
      companyId,
      companyName,
      id: req.id,
      name: user.name,
      roleId: user.role_id ?? '',
      departmentId: user.department_id ?? null,
      position: user.position ?? null,
      title: user.title ?? null,
      lastLoginPlantId: plantId,
      multiPlant: user.multi_plant === 'Y' ? 'Y' : 'N',
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
    const users = await this.dataSource.query<any[]>(
      `SELECT u.*, r.multi_plant FROM users u
       LEFT JOIN role r ON r.company_id=u.company_id AND r.id=u.role_id
       WHERE u.company_id=$1 AND u.id=$2 AND u.delete_yn='N' AND u.use_yn='Y'`,
      [decoded.companyId, decoded.userId],
    );
    const user = users[0];
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const payload: JwtPayload = {
      sub: `${decoded.companyId}:${decoded.userId}`,
      companyId: decoded.companyId,
      userId: decoded.userId,
      roleId: user.role_id ?? '',
      departmentId: user.department_id ?? null,
      lastLoginPlantId: user.last_login_plant_id ?? null,
      multiPlant: user.multi_plant === 'Y' ? 'Y' : 'N',
    };
    return this.jwtService.sign(payload);
  }

  // =========================================================================
  // 회원가입
  // =========================================================================
  async signUp(req: SignUpRequest): Promise<void> {
    const companyId = req.companyId.toUpperCase().trim();

    const companies = await this.dataSource.query(
      `SELECT id FROM company WHERE id=$1 AND delete_yn='N'`,
      [companyId],
    );
    if (!companies.length) {
      throw new BadRequestException('존재하지 않는 회사 코드입니다.');
    }

    const existing = await this.dataSource.query(
      `SELECT id FROM users WHERE company_id=$1 AND id=$2`,
      [companyId, req.id],
    );
    if (existing.length) {
      throw new BadRequestException('이미 사용 중인 아이디입니다.');
    }

    const hash = await bcrypt.hash(req.password, 12);
    await this.dataSource.query(
      `INSERT INTO users (company_id, id, name, password_hash, department_id,
        role_id, use_yn, delete_yn, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,NULL,'N','N',$2,$2)`,
      [companyId, req.id, req.name, hash, req.departmentId ?? null],
    );
  }

  // =========================================================================
  // 내 정보 조회
  // =========================================================================
  async getMyProfile(companyId: string, userId: string): Promise<UserProfileResponse> {
    const users = await this.dataSource.query<any[]>(
      `SELECT u.*, r.multi_plant FROM users u
       LEFT JOIN role r ON r.company_id=u.company_id AND r.id=u.role_id
       WHERE u.company_id=$1 AND u.id=$2 AND u.delete_yn='N'`,
      [companyId, userId],
    );
    const u = users[0];
    if (!u) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    return {
      companyId: u.company_id,
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      phone: u.phone ?? null,
      position: u.position ?? null,
      title: u.title ?? null,
      departmentId: u.department_id ?? null,
      roleId: u.role_id ?? '',
      lastLoginPlantId: u.last_login_plant_id ?? null,
      multiPlant: u.multi_plant === 'Y' ? 'Y' : 'N',
      mustChangePassword: u.must_change_password === 'Y',
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
    await this.dataSource.query(
      `UPDATE users SET name=$1, email=$2, phone=$3, position=$4, title=$5, updated_by=$6
       WHERE company_id=$7 AND id=$8 AND delete_yn='N'`,
      [req.name, req.email, req.phone, req.position, req.title, userId, companyId, userId],
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
    const users = await this.dataSource.query<{ password_hash: string }[]>(
      `SELECT password_hash FROM users WHERE company_id=$1 AND id=$2 AND delete_yn='N'`,
      [companyId, userId],
    );
    if (!users.length) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const match = await bcrypt.compare(req.currentPassword, users[0].password_hash);
    if (!match) throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');

    const hash = await bcrypt.hash(req.newPassword, 12);
    await this.dataSource.query(
      `UPDATE users
       SET password_hash=$1, password_changed_at=NOW(), must_change_password='N', updated_by=$2
       WHERE company_id=$3 AND id=$4`,
      [hash, userId, companyId, userId],
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
    await this.dataSource.query(
      `INSERT INTO login_history (company_id, user_id, login_ip, login_result, login_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [companyId, userId, ipAddress, result],
    );
  }
}
