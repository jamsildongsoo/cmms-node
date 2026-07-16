import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { Equipment } from '../../entities/equipment.entity';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { Inventory } from '../../entities/inventory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Equipment,
      EquipmentCheckCycle,
      Inventory,
    ]),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService, TypeOrmModule],
})
export class MasterModule {}
