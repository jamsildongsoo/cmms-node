import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { InventoryTxModule } from '../inventory-tx/inventory-tx.module';
import { ProcurementRepository } from './procurement.repository';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    FileModule,
    InventoryTxModule,
    TypeOrmModule.forFeature([
      PurchaseRequest,
      PurchaseRequestItem,
      InventoryHistory,
      User,
      Role,
      Warehouse,
    ]),
  ],
  controllers: [ProcurementController],
  providers: [ProcurementService, ProcurementRepository],
  exports: [ProcurementService],
})
export class ProcurementModule {}
