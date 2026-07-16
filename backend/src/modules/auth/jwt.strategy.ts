/* =========================================================================
   JwtStrategy — Passport JWT 전략 (B안 확정)
   
   페이로드에서 roleId, departmentId, lastLoginPlantId를 직접 추출.
   매 요청마다 DB User 조회 없음.
   
   Spring 대응:
     JwtTokenProvider.getUsernameFromJWT(token) → CustomUserDetailsService.loadUserByUsername()
     → DB 조회 → UserPrincipal 생성
   
   Node.js (B안):
     JwtStrategy.validate(payload) → payload 클레임 그대로 반환
     → req.user에 JwtPayload 저장 → TenantInterceptor에서 AsyncLocalStorage 주입
   ========================================================================= */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './auth.interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * 토큰 서명 검증 통과 후 호출.
   * B안: 페이로드 클레임에서 직접 사용자 정보 추출 — DB 조회 없음.
   * 반환값이 req.user에 저장됨.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.companyId || !payload.userId) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    return payload; // req.user = payload
  }
}
