import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';
import { Plant } from '../../entities/plant.entity';
import { Company } from '../../entities/company.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { LoginHistory } from '../../entities/login-history.entity';
import { AuthRefreshSession } from '../../entities/auth-refresh-session.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      User,
      Role,
      Plant,
      Company,
      RoleDetail,
      LoginHistory,
      AuthRefreshSession,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        // ConfigService의 제네릭은 런타임 형변환을 하지 않는다. 환경변수 "1800"을
        // 그대로 jsonwebtoken에 넘기면 문자열 시간으로 해석되어 1800ms가 된다.
        const expirationSeconds = Number(config.get<string>('JWT_EXPIRATION', '1800'));
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: Number.isFinite(expirationSeconds) && expirationSeconds > 0
              ? expirationSeconds
              : 1800,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule], // 다른 모듈에서 AuthGuard('jwt') 사용 가능
})
export class AuthModule {}
