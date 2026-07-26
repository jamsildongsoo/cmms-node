import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { User } from '../../entities/users.entity';
import { LoginHistory } from '../../entities/login-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, LoginHistory])],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
