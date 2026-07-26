import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrderController } from './work-order.controller';
import { WorkOrderService } from './work-order.service';
import { WorkOrderRepository } from './work-order.repository';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkOrderItem } from '../../entities/work-order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkOrder, WorkOrderItem])],
  controllers: [WorkOrderController],
  providers: [WorkOrderService, WorkOrderRepository],
  exports: [WorkOrderService, TypeOrmModule],
})
export class WorkOrderModule {}
