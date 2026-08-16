import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';

@Injectable()
export class ProcurementRepository {
  constructor(
    @InjectRepository(PurchaseRequest)
    private readonly requests: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private readonly items: Repository<PurchaseRequestItem>,
  ) {}

  findAll(companyId: string, plantId?: string, tempOnly = false, requesterId?: string): Promise<PurchaseRequest[]> {
    const where = plantId
      ? { companyId, plantId, deleteYn: 'N' as const }
      : { companyId, deleteYn: 'N' as const };
    if (tempOnly) {
      Object.assign(where, { status: 'T', requesterId });
    }
    return this.requests.find({
      where,
      order: { id: 'DESC' },
    });
  }

  findByRequester(companyId: string, requesterId: string): Promise<PurchaseRequest[]> {
    return this.requests.find({
      where: { companyId, requesterId, deleteYn: 'N' },
      order: { id: 'DESC' },
    });
  }

  findOne(companyId: string, id: string): Promise<PurchaseRequest | null> {
    return this.requests.findOne({
      where: { companyId, id, deleteYn: 'N' },
    });
  }

  findItems(companyId: string, requestId: string): Promise<PurchaseRequestItem[]> {
    return this.items.find({
      where: { companyId, requestId },
      order: { itemNo: 'ASC' },
    });
  }
}
