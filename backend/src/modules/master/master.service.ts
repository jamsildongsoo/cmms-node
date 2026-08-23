import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike } from 'typeorm';
import { Equipment } from '../../entities/equipment.entity';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { Inventory } from '../../entities/inventory.entity';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { toDateOnly } from '../../common/utils/date-only.util';
import { AppModule } from '../../common/constants/module.constants';
import { EquipmentSaveRequestDto, InventoryUpsertDto } from './dto/master.dto';

export interface EquipmentSaveRequest {
  equipment: Partial<Equipment>;
  checkCycles?: Partial<EquipmentCheckCycle>[];
}

@Injectable()
export class MasterService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Equipment) private readonly eqRepo: Repository<Equipment>,
    @InjectRepository(EquipmentCheckCycle) private readonly checkCycleRepo: Repository<EquipmentCheckCycle>,
    @InjectRepository(Inventory) private readonly invRepo: Repository<Inventory>,
  ) {}

  // =========================================================================
  // 1. 설비 마스터 (Equipment)
  // =========================================================================
  async getEquipmentsByCompany(companyId: string, operator: string, keyword?: string, limitValue?: string, pmTargetOnly = false): Promise<Equipment[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, null, AppModule.EQP);
    const limit = this.parseReferenceLimit(limitValue);
    const nameOrId = keyword?.trim();
    let list: Equipment[];
    if (activePlantId) {
      const where = nameOrId
        ? [
          { companyId, plantId: activePlantId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}), id: ILike(`%${nameOrId}%`) },
          { companyId, plantId: activePlantId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}), name: ILike(`%${nameOrId}%`) },
        ]
        : { companyId, plantId: activePlantId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}) };
      list = await this.eqRepo.find({ where, take: limit, order: { id: 'ASC' } });
    } else {
      const where = nameOrId
        ? [
          { companyId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}), id: ILike(`%${nameOrId}%`) },
          { companyId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}), name: ILike(`%${nameOrId}%`) },
        ]
        : { companyId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}) };
      list = await this.eqRepo.find({ where, take: limit, order: { id: 'ASC' } });
    }
    await this.fillCheckDates(companyId, list);
    return list;
  }

  async getEquipmentsByPlant(companyId: string, plantId: string, operator: string, keyword?: string, limitValue?: string, pmTargetOnly = false): Promise<Equipment[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId, AppModule.EQP);
    if (!activePlantId) {
      return [];
    }
    const limit = this.parseReferenceLimit(limitValue);
    const keywordValue = keyword?.trim();
    const where = keywordValue
      ? [
        { companyId, plantId: activePlantId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}), id: ILike(`%${keywordValue}%`) },
        { companyId, plantId: activePlantId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}), name: ILike(`%${keywordValue}%`) },
      ]
      : { companyId, plantId: activePlantId, deleteYn: 'N' as const, ...(pmTargetOnly ? { pmTargetYn: 'Y' as const } : {}) };
    const list = await this.eqRepo.find({ where, take: limit, order: { id: 'ASC' } });
    await this.fillCheckDates(companyId, list);
    return list;
  }

  private async fillCheckDates(companyId: string, list: Equipment[]): Promise<void> {
    for (const eq of list) {
      const cycles = await this.checkCycleRepo.find({
        where: { companyId, plantId: eq.plantId, equipmentId: eq.id, deleteYn: 'N' },
      });
      if (cycles && cycles.length > 0) {
        // lastCheckDate 최대값 추출
        const lastDates = cycles
          .map(c => c.lastCheckDate)
          .filter(d => d !== null && d !== undefined)
          .map(d => toDateOnly(d!));
        const last = lastDates.length > 0 ? lastDates.sort().at(-1)! : null;

        // nextCheckDate 최소값 추출
        const nextDates = cycles
          .map(c => c.nextCheckDate)
          .filter(d => d !== null && d !== undefined)
          .map(d => toDateOnly(d!));
        const next = nextDates.length > 0 ? nextDates.sort()[0] : null;

        eq.lastCheckDate = last;
        eq.nextCheckDate = next;
      }
    }
  }

  async getEquipmentWithDetails(companyId: string, plantId: string, id: string, operator: string): Promise<EquipmentSaveRequest> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId, AppModule.EQP);
    if (!activePlantId) {
      throw new BadRequestException('접근 권한이 없는 플랜트입니다.');
    }
    const eq = await this.eqRepo.findOne({ where: { companyId, plantId: activePlantId, id, deleteYn: 'N' } });
    if (!eq) throw new BadRequestException('설비를 찾을 수 없습니다.');

    const checkCycles = await this.checkCycleRepo.find({
      where: { companyId, plantId: activePlantId, equipmentId: id, deleteYn: 'N' },
    });

    return {
      equipment: eq,
      checkCycles,
    };
  }

  async createEquipment(
    companyId: string,
    request: EquipmentSaveRequestDto,
    operator: string,
  ): Promise<Equipment> {
    return this.saveEquipment(companyId, request, operator, 'create');
  }

  async updateEquipment(
    companyId: string,
    plantId: string,
    id: string,
    request: EquipmentSaveRequestDto,
    operator: string,
  ): Promise<Equipment> {
    return this.saveEquipment(companyId, {
      ...request,
      equipment: { ...request.equipment, plantId, id },
    }, operator, 'update');
  }

  private async saveEquipment(
    companyId: string,
    request: EquipmentSaveRequestDto,
    operator: string,
    mode: 'create' | 'update',
  ): Promise<Equipment> {
    const reqEq = request.equipment;
    if (!reqEq.plantId || !reqEq.id) {
      throw new BadRequestException('플랜트 ID와 설비 ID는 필수입니다.');
    }
    if (reqEq.pmTargetYn === 'Y' && !request.checkCycles?.length) {
      throw new BadRequestException('PM 대상 설비는 하나 이상의 점검주기가 필요합니다.');
    }

    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, reqEq.plantId, AppModule.EQP);
    if (!activePlantId) {
      throw new BadRequestException('접근 권한이 없는 플랜트입니다.');
    }

    reqEq.plantId = activePlantId;
    return this.dataSource.transaction(async (manager) => {
      const equipmentRepository = manager.getRepository(Equipment);
      const cycleRepository = manager.getRepository(EquipmentCheckCycle);
      const exists = await equipmentRepository.findOne({
        where: { companyId, plantId: activePlantId, id: reqEq.id },
      });
      if (mode === 'create' && exists?.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 설비입니다.');
      }
      if (mode === 'update' && (!exists || exists.deleteYn !== 'N')) {
        throw new BadRequestException('수정할 설비를 찾을 수 없습니다.');
      }

      const entity = exists ?? equipmentRepository.create({
        companyId,
        plantId: activePlantId,
        id: reqEq.id,
        createdBy: operator,
      });
      Object.assign(entity, {
        ...reqEq,
        companyId,
        plantId: activePlantId,
        deleteYn: 'N',
        updatedBy: operator,
      });
      const savedEquipment = await equipmentRepository.save(entity);

      const oldCycles = await cycleRepository.find({
        where: { companyId, plantId: activePlantId, equipmentId: reqEq.id, deleteYn: 'N' },
      });
      if (oldCycles.length > 0) {
        oldCycles.forEach((cycle) => {
          cycle.deleteYn = 'Y';
          cycle.updatedBy = operator;
        });
        await cycleRepository.save(oldCycles);
      }

      if (request.checkCycles?.length) {
        await cycleRepository.save(
          request.checkCycles.map((cycle) => cycleRepository.create({
            ...cycle,
            cycleVal: cycle.cycleVal ?? undefined,
            lastCheckDate: cycle.lastCheckDate ? toDateOnly(cycle.lastCheckDate) : null,
            nextCheckDate: cycle.nextCheckDate ? toDateOnly(cycle.nextCheckDate) : null,
            companyId,
            plantId: activePlantId,
            equipmentId: reqEq.id,
            deleteYn: 'N',
            createdBy: operator,
            updatedBy: operator,
          })),
        );
      }
      return savedEquipment;
    });
  }

  async deleteEquipment(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId, AppModule.EQP);
    if (!activePlantId) {
      throw new BadRequestException('접근 권한이 없는 플랜트입니다.');
    }
    const eq = await this.eqRepo.findOne({ where: { companyId, plantId: activePlantId, id, deleteYn: 'N' } });
    if (!eq) throw new BadRequestException('설비를 찾을 수 없습니다.');

    eq.deleteYn = 'Y';
    eq.updatedBy = operator;
    await this.eqRepo.save(eq);
  }

  // =========================================================================
  // 2. 재고 마스터 (Inventory)
  // =========================================================================
  async getInventoriesByCompany(companyId: string, keyword?: string, limitValue?: string): Promise<Inventory[]> {
    const limit = this.parseReferenceLimit(limitValue);
    const keywordValue = keyword?.trim();
    const where = keywordValue
      ? [
        { companyId, deleteYn: 'N' as const, id: ILike(`%${keywordValue}%`) },
        { companyId, deleteYn: 'N' as const, name: ILike(`%${keywordValue}%`) },
      ]
      : { companyId, deleteYn: 'N' as const };
    return this.invRepo.find({ where, take: limit, order: { id: 'ASC' } });
  }

  private parseReferenceLimit(value?: string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : undefined;
  }

  async getInventoryById(companyId: string, id: string): Promise<Inventory> {
    const inv = await this.invRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!inv) throw new BadRequestException('재고 품목을 찾을 수 없습니다.');
    return inv;
  }

  async saveInventory(
    companyId: string,
    invDto: InventoryUpsertDto,
    operator: string,
    mode: 'create' | 'update',
  ): Promise<Inventory> {
    if (!invDto.id) throw new BadRequestException('자재 ID는 필수입니다.');

    const inventoryId = invDto.id?.trim();
    if (!inventoryId) throw new BadRequestException('자재 ID는 필수입니다.');
    const exists = await this.invRepo.findOne({ where: { companyId, id: inventoryId } });
    if (mode === 'create' && exists?.deleteYn === 'N') {
      throw new BadRequestException('이미 존재하는 자재입니다.');
    }
    if (mode === 'update' && (!exists || exists.deleteYn !== 'N')) {
      throw new BadRequestException('수정할 자재를 찾을 수 없습니다.');
    }

    if (exists) {
      Object.assign(exists, {
        ...invDto,
        id: inventoryId,
        safetyQty: invDto.safetyQty.toFixed(4),
        reorderQty: invDto.reorderQty.toFixed(4),
        deleteYn: 'N',
        updatedBy: operator,
      });
      const restored = await this.invRepo.save(exists);
      return restored;
    } else {
      const inv = this.invRepo.create({
        ...invDto,
        companyId,
        id: inventoryId,
        safetyQty: invDto.safetyQty.toFixed(4),
        reorderQty: invDto.reorderQty.toFixed(4),
        deleteYn: 'N',
        createdBy: operator,
        updatedBy: operator,
      });
      const saved = await this.invRepo.save(inv);
      return saved;
    }
  }

  async deleteInventory(companyId: string, id: string, operator: string): Promise<void> {
    const inv = await this.invRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!inv) throw new BadRequestException('재고 품목을 찾을 수 없습니다.');

    inv.deleteYn = 'Y';
    inv.updatedBy = operator;
    await this.invRepo.save(inv);
  }

  // =========================================================================
  // 3. CSV EXPORT
  // =========================================================================
  async exportEquipmentsToCsv(companyId: string, operator: string): Promise<string> {
    const list = await this.getEquipmentsByCompany(companyId, operator);
    let csv = '\ufeff'; // Excel UTF-8 깨짐 방지 BOM 추가
    csv += '설비코드,설비명,플랜트,설치위치,설비타입,설치일자,작업허가대상,PM대상,제조사,모델,일련번호,비고,지난점검일,다음점검일\n';

    for (const eq of list) {
      csv += `${this.escapeCsv(eq.id)},${this.escapeCsv(eq.name)},${this.escapeCsv(eq.plantId)},${this.escapeCsv(eq.location)},${this.escapeCsv(eq.eqTypeCode)},${eq.installDate ? this.formatDate(eq.installDate) : ''},${this.escapeCsv(eq.workPermitYn)},${this.escapeCsv(eq.pmTargetYn)},${this.escapeCsv(eq.makerName)},${this.escapeCsv(eq.model)},${this.escapeCsv(eq.serialNumber)},${this.escapeCsv(eq.remarks)},${eq.lastCheckDate ? this.formatDate(eq.lastCheckDate) : ''},${eq.nextCheckDate ? this.formatDate(eq.nextCheckDate) : ''}\n`;
    }
    return csv;
  }

  async exportInventoriesToCsv(companyId: string): Promise<string> {
    const list = await this.getInventoriesByCompany(companyId);
    let csv = '\ufeff';
    csv += '자재코드,자재명,자재타입,관리부서,단위,제조사,스펙,모델,일련번호,안전재고,재주문점,리드타임(일),비고\n';

    for (const inv of list) {
      csv += `${this.escapeCsv(inv.id)},${this.escapeCsv(inv.name)},${this.escapeCsv(inv.invTypeCode)},${this.escapeCsv(inv.unit)},${this.escapeCsv(inv.makerName)},${this.escapeCsv(inv.spec)},${this.escapeCsv(inv.model)},${this.escapeCsv(inv.serialNumber)},${inv.safetyQty},${inv.reorderQty},${inv.leadTimeDays},${this.escapeCsv(inv.remarks)}\n`;
    }
    return csv;
  }

  private escapeCsv(value: string | null | undefined): string {
    if (!value) return '';
    return value.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/,/g, ' ');
  }

  private formatDate(date: Date | string): string {
    return toDateOnly(date);
  }
}
