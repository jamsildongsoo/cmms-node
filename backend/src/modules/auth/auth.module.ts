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
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_EXPIRATION', 1800), // 초 단위
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule], // 다른 모듈에서 AuthGuard('jwt') 사용 가능
})
export class AuthModule {}
