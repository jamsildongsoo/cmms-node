/* =========================================================================
   AuthController — Spring AuthController 1:1 대응
   /api/auth/*
   ========================================================================= */
import {
  Controller, Post, Put, Get, Body, Headers,
  UseGuards, Request, Ip,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  LoginRequest,
  SignUpRequest,
  PasswordChangeRequest,
  UserUpdateRequest,
} from './auth.interfaces';
import { JwtPayload } from './auth.interfaces';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/auth/login */
  @Post('login')
  async login(@Body() body: LoginRequest, @Ip() ip: string) {
    return this.authService.login(body, ip);
  }

  /** POST /api/auth/signup */
  @Post('signup')
  async signUp(@Body() body: SignUpRequest) {
    await this.authService.signUp(body);
    return '회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.';
  }

  /**
   * POST /api/auth/refresh
   * 응답: 새 토큰 string (FE useAuthStore.extendSession이 response.data로 직접 받음)
   *
   * [B안] refresh 시 DB 재조회 → roleId/departmentId 변경 즉시 반영
   */
  @Post('refresh')
  async refresh(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    return this.authService.refresh(token);
  }

  /** GET /api/auth/me */
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: { user: JwtPayload }) {
    return this.authService.getMyProfile(req.user.companyId, req.user.userId);
  }

  /** PUT /api/auth/me */
  @UseGuards(AuthGuard('jwt'))
  @Put('me')
  async updateMe(
    @Request() req: { user: JwtPayload },
    @Body() body: UserUpdateRequest,
  ) {
    await this.authService.updateMyProfile(req.user.companyId, req.user.userId, body);
    return '사용자 정보가 수정되었습니다.';
  }

  /** PUT /api/auth/me/password */
  @UseGuards(AuthGuard('jwt'))
  @Put('me/password')
  async changePassword(
    @Request() req: { user: JwtPayload },
    @Body() body: PasswordChangeRequest,
  ) {
    await this.authService.changePassword(req.user.companyId, req.user.userId, body);
    return '비밀번호가 수정되었습니다.';
  }
}
