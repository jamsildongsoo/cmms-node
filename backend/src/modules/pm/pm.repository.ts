import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PmCheckTemplate } from '../../entities/pm-check-template.entity';
import { PmRecordItem } from '../../entities/pm-record-item.entity';
import { PmRecord } from '../../entities/pm-record.entity';

export interface PmRecordSearch {
  companyId: string;
  plantId?: string;
  searchType?: string;
  searchValue?: string;
  showAll?: string;
  tempOnly?: string;
  userId?: string;
}

@Injectable()
export class PmRepository {
  constructor(
    @InjectRepository(PmRecord)
    private readonly records: Repository<PmRecord>,
    @InjectRepository(PmRecordItem)
    private readonly items: Repository<PmRecordItem>,
    @InjectRepository(PmCheckTemplate)
    private readonly templates: Repository<PmCheckTemplate>,
  ) {}

  findRecords(search: PmRecordSearch): Promise<PmRecord[]> {
    const query = this.records
      .createQueryBuilder('pm')
      .leftJoinAndSelect('pm.equipment', 'equipment')
      .leftJoinAndSelect('pm.worker', 'worker')
      .where('pm.companyId = :companyId', { companyId: search.companyId })
      .andWhere('pm.deleteYn = :notDeleted', { notDeleted: 'N' });

    if (search.plantId) {
      query.andWhere('pm.plantId = :plantId', { plantId: search.plantId });
    }
    if (search.tempOnly === 'Y') {
      query
        .andWhere('pm.status = :tempStatus', { tempStatus: 'T' })
        .andWhere('pm.createdBy = :userId', { userId: search.userId });
    } else {
      query.andWhere('pm.status <> :tempStatus', { tempStatus: 'T' });
    }

    if (search.tempOnly !== 'Y' && search.searchValue) {
      const value = `%${search.searchValue}%`;
      if (search.searchType === 'id') {
        query.andWhere('pm.id ILIKE :value', { value });
      } else if (search.searchType === 'title') {
        query.andWhere('pm.title ILIKE :value', { value });
      } else if (search.searchType === 'author') {
        query.andWhere('(pm.workerId ILIKE :value OR worker.name ILIKE :value)', { value });
      }
    }

    return query.orderBy('pm.id', 'DESC').getMany();
  }

  findRecord(companyId: string, plantId: string, id: string): Promise<PmRecord | null> {
    return this.records.findOne({
      where: { companyId, plantId, id, deleteYn: 'N' },
      relations: { equipment: true },
    });
  }

  findItems(companyId: string, plantId: string, pmRecordId: string): Promise<PmRecordItem[]> {
    return this.items.find({
      where: { companyId, plantId, pmRecordId },
      order: { itemNo: 'ASC' },
    });
  }

  findTemplates(
    companyId: string,
    plantId: string,
    equipmentId: string,
    checkTypeCode: string,
  ): Promise<PmCheckTemplate[]> {
    return this.templates.find({
      where: { companyId, plantId, equipmentId, checkTypeCode },
      order: { itemNo: 'ASC' },
    });
  }
}
