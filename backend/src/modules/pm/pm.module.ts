import { Module } from '@nestjs/common';
import { PmController } from './pm.controller';
import { PmService } from './pm.service';

@Module({
  controllers: [PmController],
  providers: [PmService],
  exports: [PmService],
})
export class PmModule {}
