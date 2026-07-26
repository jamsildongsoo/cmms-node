import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalRepository } from './approval.repository';
import { Approval } from '../../entities/approval.entity';
import { ApprovalStep } from '../../entities/approval-step.entity';
import { User } from '../../entities/users.entity';
import { PmRecord } from '../../entities/pm-record.entity';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkPermit } from '../../entities/work-permit.entity';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Approval,
      ApprovalStep,
      User,
      PmRecord,
      WorkOrder,
      WorkPermit,
      EquipmentCheckCycle,
      PurchaseRequest,
    ]),
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService, ApprovalRepository],
  exports: [ApprovalService],
})
export class ApprovalModule {}
