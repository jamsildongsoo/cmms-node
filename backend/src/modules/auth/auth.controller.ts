/* =========================================================================
   AuthController — Spring AuthController 1:1 대응
   /api/auth/*
   ========================================================================= */
import {
  Controller, Post, Put, Get, Body, Headers,
  UseGuards, Request, Ip, Res, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import {
  LoginRequestDto,
  PasswordChangeRequestDto,
  SignUpRequestDto,
  UserUpdateRequestDto,
} from './dto/auth-request.dto';
import { JwtPayload } from './auth.interfaces';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/auth/login */
  @Post('login')
  async login(
    @Body() body: LoginRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body, ip, userAgent);
    this.authService.applyRefreshCookie(res, result.refreshToken);
    return result.response;
  }

  /** POST /api/auth/signup */
  @Post('signup')
  async signUp(@Body() body: SignUpRequestDto) {
    await this.authService.signUp(body);
    return '회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.';
  }

  /**
   * POST /api/auth/refresh
   * refresh cookie 검증 후 access token 재발급
   */
  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(req.headers.cookie ?? '', ip, userAgent);
    this.authService.applyRefreshCookie(res, result.refreshToken);
    return result.response;
  }

  /** POST /api/auth/logout */
  @Post('logout')
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.headers.cookie ?? '');
    this.authService.clearRefreshCookie(res);
    return '로그아웃되었습니다.';
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
    @Body() body: UserUpdateRequestDto,
  ) {
    await this.authService.updateMyProfile(req.user.companyId, req.user.userId, body);
    return '사용자 정보가 수정되었습니다.';
  }

  /** PUT /api/auth/me/password */
  @UseGuards(AuthGuard('jwt'))
  @Put('me/password')
  async changePassword(
    @Request() req: { user: JwtPayload },
    @Body() body: PasswordChangeRequestDto,
  ) {
    await this.authService.changePassword(req.user.companyId, req.user.userId, body);
    return '비밀번호가 수정되었습니다.';
  }
}
