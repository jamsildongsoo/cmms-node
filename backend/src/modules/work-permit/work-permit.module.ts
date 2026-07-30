import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkPermitController } from './work-permit.controller';
import { WorkPermitService } from './work-permit.service';
import { WorkPermitRepository } from './work-permit.repository';
import { WorkPermit } from '../../entities/work-permit.entity';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule, TypeOrmModule.forFeature([WorkPermit])],
  controllers: [WorkPermitController],
  providers: [WorkPermitService, WorkPermitRepository],
  exports: [WorkPermitService, TypeOrmModule],
})
export class WorkPermitModule {}
