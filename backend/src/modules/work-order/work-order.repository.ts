import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkOrderItem } from '../../entities/work-order-item.entity';

@Injectable()
export class WorkOrderRepository {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrders: Repository<WorkOrder>,
    @InjectRepository(WorkOrderItem)
    private readonly items: Repository<WorkOrderItem>,
  ) {}

  findAll(
    companyId: string,
    plantId?: string,
    searchType?: string,
    searchValue?: string,
  ): Promise<WorkOrder[]> {
    const query = this.workOrders
      .createQueryBuilder('wo')
      .leftJoinAndSelect('wo.equipment', 'equipment')
      .leftJoinAndSelect('wo.worker', 'worker')
      .where('wo.companyId = :companyId', { companyId })
      .andWhere('wo.deleteYn = :notDeleted', { notDeleted: 'N' });
    if (plantId) query.andWhere('wo.plantId = :plantId', { plantId });
    if (searchValue) {
      const value = `%${searchValue}%`;
      if (searchType === 'id') query.andWhere('wo.id ILIKE :value', { value });
      if (searchType === 'title') query.andWhere('wo.title ILIKE :value', { value });
      if (searchType === 'worker') {
        query.andWhere('(wo.workerId ILIKE :value OR worker.name ILIKE :value)', { value });
      }
    }
    return query.orderBy('wo.id', 'DESC').getMany();
  }

  findOne(companyId: string, plantId: string, id: string): Promise<WorkOrder | null> {
    return this.workOrders.findOne({
      where: { companyId, plantId, id, deleteYn: 'N' },
      relations: { equipment: true },
    });
  }

  findItems(companyId: string, plantId: string, workOrderId: string): Promise<WorkOrderItem[]> {
    return this.items.find({
      where: { companyId, plantId, workOrderId },
      order: { itemNo: 'ASC' },
    });
  }
}
