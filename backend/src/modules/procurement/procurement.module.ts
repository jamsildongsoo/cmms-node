import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { ProcurementRepository } from './procurement.repository';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { Allocation } from '../../entities/allocation.entity';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { Plant } from '../../entities/plant.entity';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    FileModule,
    TypeOrmModule.forFeature([
      PurchaseRequest,
      PurchaseRequestItem,
      PurchaseOrder,
      PurchaseOrderItem,
      Allocation,
      User,
      Role,
      Warehouse,
      Plant,
    ]),
  ],
  controllers: [ProcurementController],
  providers: [ProcurementService, ProcurementRepository],
  exports: [ProcurementService],
})
export class ProcurementModule {}
