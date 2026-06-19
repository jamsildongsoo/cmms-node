import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Equipment } from '../../entities/equipment.entity';
import { EquipmentCheckItem } from '../../entities/equipment-check-item.entity';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { Inventory } from '../../entities/inventory.entity';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { toDateOnly } from '../../common/utils/date-only.util';

export interface EquipmentSaveRequest {
  equipment: Partial<Equipment>;
  checkItems?: Partial<EquipmentCheckItem>[];
  checkCycles?: Partial<EquipmentCheckCycle>[];
}

@Injectable()
export class MasterService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Equipment) private readonly eqRepo: Repository<Equipment>,
    @InjectRepository(EquipmentCheckItem) private readonly checkItemRepo: Repository<EquipmentCheckItem>,
    @InjectRepository(EquipmentCheckCycle) private readonly checkCycleRepo: Repository<EquipmentCheckCycle>,
    @InjectRepository(Inventory) private readonly invRepo: Repository<Inventory>,
  ) {}

  // =========================================================================
  // 1. 설비 마스터 (Equipment)
  // =========================================================================
  async getEquipmentsByCompany(companyId: string, operator: string): Promise<Equipment[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator);
    let list: Equipment[];
    if (activePlantId) {
      list = await this.eqRepo.find({ where: { companyId, plantId: activePlantId, deleteYn: 'N' } });
    } else {
      list = await this.eqRepo.find({ where: { companyId, deleteYn: 'N' } });
    }
    await this.fillCheckDates(companyId, list);
    return list;
  }

  async getEquipmentsByPlant(companyId: string, plantId: string, operator: string): Promise<Equipment[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    if (!activePlantId) {
      return [];
    }
    const list = await this.eqRepo.find({ where: { companyId, plantId: activePlantId, deleteYn: 'N' } });
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
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    if (!activePlantId) {
      throw new BadRequestException('접근 권한이 없는 플랜트입니다.');
    }
    const eq = await this.eqRepo.findOne({ where: { companyId, plantId: activePlantId, id, deleteYn: 'N' } });
    if (!eq) throw new BadRequestException('설비를 찾을 수 없습니다.');

    const checkItems = await this.checkItemRepo.find({
      where: { companyId, plantId: activePlantId, equipmentId: id },
      order: { itemNo: 'ASC' },
    });

    const checkCycles = await this.checkCycleRepo.find({
      where: { companyId, plantId: activePlantId, equipmentId: id, deleteYn: 'N' },
    });

    return {
      equipment: eq,
      checkItems,
      checkCycles,
    };
  }

  async saveEquipment(companyId: string, request: EquipmentSaveRequest, operator: string): Promise<Equipment> {
    const reqEq = request.equipment;
    if (!reqEq.plantId || !reqEq.id) {
      throw new BadRequestException('플랜트 ID와 설비 ID는 필수입니다.');
    }

    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, reqEq.plantId);
    if (!activePlantId) {
      throw new BadRequestException('접근 권한이 없는 플랜트입니다.');
    }

    reqEq.plantId = activePlantId;
    reqEq.companyId = companyId;

    const exists = await this.eqRepo.findOne({
      where: { companyId, plantId: activePlantId, id: reqEq.id },
    });

    let savedEq: Equipment;
    if (exists) {
      Object.assign(exists, {
        ...reqEq,
        deleteYn: 'N',
        updatedBy: operator,
      });
      savedEq = await this.eqRepo.save(exists);
    } else {
      const eq = this.eqRepo.create({
        ...reqEq,
        deleteYn: 'N',
        createdBy: operator,
        updatedBy: operator,
      });
      savedEq = await this.eqRepo.save(eq);
    }

    // 1. 점검 항목 업데이트 (기존 물리 삭제 후 재생성)
    await this.checkItemRepo.delete({ companyId, plantId: activePlantId, equipmentId: reqEq.id });
    if (request.checkItems) {
      let seq = 1;
      const newItems = request.checkItems.map(item =>
        this.checkItemRepo.create({
          ...item,
          companyId,
          plantId: activePlantId,
          equipmentId: reqEq.id,
          itemNo: seq++,
        }),
      );
      await this.checkItemRepo.save(newItems);
    }

    // 2. 점검 주기 업데이트 (기존 논리 삭제 후 재생성)
    const oldCycles = await this.checkCycleRepo.find({
      where: { companyId, plantId: activePlantId, equipmentId: reqEq.id, deleteYn: 'N' },
    });
    for (const old of oldCycles) {
      old.deleteYn = 'Y';
      old.updatedBy = operator;
      await this.checkCycleRepo.save(old);
    }

    if (request.checkCycles) {
      const newCycles = request.checkCycles.map(cycle =>
        this.checkCycleRepo.create({
          ...cycle,
          lastCheckDate: cycle.lastCheckDate ? toDateOnly(cycle.lastCheckDate) : null,
          nextCheckDate: cycle.nextCheckDate ? toDateOnly(cycle.nextCheckDate) : null,
          companyId,
          plantId: activePlantId,
          equipmentId: reqEq.id,
          deleteYn: 'N',
          createdBy: operator,
          updatedBy: operator,
        }),
      );
      await this.checkCycleRepo.save(newCycles);
    }

    return savedEq;
  }

  async deleteEquipment(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
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
  async getInventoriesByCompany(companyId: string): Promise<Inventory[]> {
    return this.invRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async getInventoryById(companyId: string, id: string): Promise<Inventory> {
    const inv = await this.invRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!inv) throw new BadRequestException('재고 품목을 찾을 수 없습니다.');
    return inv;
  }

  async saveInventory(companyId: string, invDto: Partial<Inventory>, operator: string): Promise<Inventory> {
    if (!invDto.id) throw new BadRequestException('자재 ID는 필수입니다.');

    invDto.companyId = companyId;
    const exists = await this.invRepo.findOne({ where: { companyId, id: invDto.id } });

    if (exists) {
      Object.assign(exists, {
        ...invDto,
        deleteYn: 'N',
        updatedBy: operator,
      });
      return this.invRepo.save(exists);
    } else {
      const inv = this.invRepo.create({
        ...invDto,
        deleteYn: 'N',
        createdBy: operator,
        updatedBy: operator,
      });
      return this.invRepo.save(inv);
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
    csv += '설비코드,설비명,플랜트,설치위치,설비타입,설치일자,작업허가대상,제조사,모델,일련번호,비고,지난점검일,다음점검일\n';

    for (const eq of list) {
      csv += `${this.escapeCsv(eq.id)},${this.escapeCsv(eq.name)},${this.escapeCsv(eq.plantId)},${this.escapeCsv(eq.location)},${this.escapeCsv(eq.eqTypeCode)},${eq.installDate ? this.formatDate(eq.installDate) : ''},${this.escapeCsv(eq.workPermitYn)},${this.escapeCsv(eq.makerName)},${this.escapeCsv(eq.model)},${this.escapeCsv(eq.serialNumber)},${this.escapeCsv(eq.remarks)},${eq.lastCheckDate ? this.formatDate(eq.lastCheckDate) : ''},${eq.nextCheckDate ? this.formatDate(eq.nextCheckDate) : ''}\n`;
    }
    return csv;
  }

  async exportInventoriesToCsv(companyId: string): Promise<string> {
    const list = await this.getInventoriesByCompany(companyId);
    let csv = '\ufeff';
    csv += '자재코드,자재명,자재타입,관리부서,단위,제조사,스펙,모델,일련번호,안전재고,재주문점,리드타임(일),비고\n';

    for (const inv of list) {
      csv += `${this.escapeCsv(inv.id)},${this.escapeCsv(inv.name)},${this.escapeCsv(inv.itemTypeCode)},${this.escapeCsv(inv.departmentId)},${this.escapeCsv(inv.unit)},${this.escapeCsv(inv.makerName)},${this.escapeCsv(inv.spec)},${this.escapeCsv(inv.model)},${this.escapeCsv(inv.serialNumber)},${inv.safetyQty},${inv.reorderQty},${inv.leadTimeDays},${this.escapeCsv(inv.remarks)}\n`;
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
