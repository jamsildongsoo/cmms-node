import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { User } from '../../entities/users.entity';
import { LoginHistory } from '../../entities/login-history.entity';
import { AuthRefreshSession } from '../../entities/auth-refresh-session.entity';
import { MdmModule } from '../mdm/mdm.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, LoginHistory, AuthRefreshSession]), MdmModule],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
