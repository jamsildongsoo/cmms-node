import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PmController } from './pm.controller';
import { PmService } from './pm.service';
import { PmRecord } from '../../entities/pm-record.entity';
import { PmRecordItem } from '../../entities/pm-record-item.entity';
import { PmCheckTemplate } from '../../entities/pm-check-template.entity';
import { PmRepository } from './pm.repository';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    FileModule,
    TypeOrmModule.forFeature([
      PmRecord,
      PmRecordItem,
      PmCheckTemplate,
    ]),
  ],
  controllers: [PmController],
  providers: [PmService, PmRepository],
  exports: [PmService, TypeOrmModule],
})
export class PmModule {}
