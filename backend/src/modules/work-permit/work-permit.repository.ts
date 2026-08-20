import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkPermit } from '../../entities/work-permit.entity';

@Injectable()
export class WorkPermitRepository {
  constructor(
    @InjectRepository(WorkPermit)
    private readonly workPermits: Repository<WorkPermit>,
  ) {}

  findAll(
    companyId: string,
    plantId?: string,
    searchType?: string,
    searchValue?: string,
    tempOnly?: string,
    userId?: string,
  ): Promise<WorkPermit[]> {
    const query = this.workPermits
      .createQueryBuilder('wp')
      .leftJoinAndSelect('wp.equipment', 'equipment')
      .leftJoinAndSelect('wp.supervisor', 'supervisor')
      .where('wp.companyId = :companyId', { companyId })
      .andWhere('wp.deleteYn = :notDeleted', { notDeleted: 'N' });
    if (plantId) query.andWhere('wp.plantId = :plantId', { plantId });
    if (tempOnly === 'Y') {
      query
        .andWhere('wp.status = :tempStatus', { tempStatus: 'T' })
        .andWhere('wp.createdBy = :userId', { userId });
    } else {
      query.andWhere('wp.status <> :tempStatus', { tempStatus: 'T' });
    }
    if (tempOnly !== 'Y' && searchValue) {
      const value = `%${searchValue}%`;
      if (searchType === 'id') query.andWhere('wp.id ILIKE :value', { value });
      if (searchType === 'title') query.andWhere('wp.title ILIKE :value', { value });
      if (searchType === 'supervisor') {
        query.andWhere(
          '(wp.supervisorId ILIKE :value OR supervisor.name ILIKE :value)',
          { value },
        );
      }
    }
    return query.orderBy('wp.id', 'DESC').getMany();
  }

  findOne(companyId: string, plantId: string, id: string): Promise<WorkPermit | null> {
    return this.workPermits.findOne({
      where: { companyId, plantId, id, deleteYn: 'N' },
      relations: { equipment: true },
    });
  }
}
