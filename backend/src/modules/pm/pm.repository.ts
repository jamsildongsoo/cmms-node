import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { PmCheckTemplate } from '../../entities/pm-check-template.entity';
import { PmRecordItem } from '../../entities/pm-record-item.entity';
import { PmRecord } from '../../entities/pm-record.entity';

export interface PmRecordSearch {
  companyId: string;
  plantId?: string;
  stage?: string | null;
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
    @InjectRepository(EquipmentCheckCycle)
    private readonly cycles: Repository<EquipmentCheckCycle>,
  ) {}

  findSchedules(companyId: string, targetDate: string): Promise<EquipmentCheckCycle[]> {
    return this.cycles
      .createQueryBuilder('cycle')
      .innerJoinAndSelect('cycle.equipment', 'equipment', 'equipment.deleteYn = :notDeleted', {
        notDeleted: 'N',
      })
      .where('cycle.companyId = :companyId', { companyId })
      .andWhere('cycle.deleteYn = :notDeleted', { notDeleted: 'N' })
      .andWhere('cycle.nextCheckDate IS NOT NULL')
      .andWhere('cycle.nextCheckDate <= :targetDate', { targetDate })
      .getMany();
  }

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
    if (search.stage) {
      query.andWhere('pm.stepStage = :stage', { stage: search.stage });
    }
    if (search.tempOnly === 'Y') {
      query
        .andWhere('pm.status = :tempStatus', { tempStatus: 'T' })
        .andWhere('pm.createdBy = :userId', { userId: search.userId });
    } else {
      query.andWhere('pm.status <> :tempStatus', { tempStatus: 'T' });
    }
    if (search.tempOnly !== 'Y' && search.showAll !== 'Y' && search.stage === 'P') {
      query
        .andWhere('pm.closeYn = :open', { open: 'N' })
        .andWhere('(pm.cycleEnd IS NULL OR pm.cycleEnd >= CURRENT_DATE)');
    } else if (search.tempOnly !== 'Y' && search.showAll !== 'Y' && !search.stage) {
      query.andWhere(
        "(pm.stepStage <> 'P' OR (pm.closeYn = 'N' AND (pm.cycleEnd IS NULL OR pm.cycleEnd >= CURRENT_DATE)))",
      );
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
    checkTypeCode: string,
  ): Promise<PmCheckTemplate[]> {
    return this.templates.find({
      where: { companyId, plantId, checkTypeCode },
      order: { itemNo: 'ASC' },
    });
  }
}
