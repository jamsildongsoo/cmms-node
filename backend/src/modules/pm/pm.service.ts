import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { PmRecordItem } from '../../entities/pm-record-item.entity';
import { PmRecord } from '../../entities/pm-record.entity';
import { DocStatus } from '../../common/constants/status.constants';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { addDateOnly, toDateOnly } from '../../common/utils/date-only.util';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import {
  PmCheckTemplateResponseDto,
  PmRecordDetailsDto,
  PmRecordHeaderDto,
  PmRecordItemDto,
  PmRecordItemResponseDto,
  PmRecordResponseDto,
  PmScheduleResponseDto,
  SavePmRecordDto,
} from './dto/pm.dto';
import { PmRepository } from './pm.repository';

@Injectable()
export class PmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly pmRepository: PmRepository,
  ) {}

  async getPmSchedules(companyId: string, targetDate: Date): Promise<PmScheduleResponseDto[]> {
    const cycles = await this.pmRepository.findSchedules(companyId, toDateOnly(targetDate));
    return cycles.map((cycle) => ({
      equipmentId: cycle.equipmentId,
      equipmentName: cycle.equipment?.name ?? cycle.equipmentId,
      plantId: cycle.plantId,
      checkTypeCode: cycle.checkTypeCode,
      cycleVal: cycle.cycleVal,
      cycleUnit: cycle.cycleUnit,
      lastCheckDate: cycle.lastCheckDate,
      nextCheckDate: cycle.nextCheckDate,
    }));
  }

  async getPmRecords(
    companyId: string,
    operator: string,
    stepStage?: string,
    searchType?: string,
    searchValue?: string,
    showAll?: string,
  ): Promise<PmRecordResponseDto[]> {
    const plantId = await resolveActivePlantId(this.dataSource, companyId, operator);
    const records = await this.pmRepository.findRecords({
      companyId,
      plantId: plantId ?? undefined,
      stage: stepStage?.toUpperCase() || null,
      searchType,
      searchValue,
      showAll,
    });
    return records.map((record) => this.toRecordResponse(record));
  }

  async getPmRecordDetails(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<PmRecordDetailsDto> {
    const activePlantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId),
    );
    const record = await this.pmRepository.findRecord(companyId, activePlantId, id);
    if (!record) throw new NotFoundException('점검 기록을 찾을 수 없습니다.');

    const items = await this.pmRepository.findItems(companyId, activePlantId, id);
    return {
      pmRecord: this.toRecordResponse(record),
      checkItems: items.map((item) => this.toItemResponse(item)),
    };
  }

  async getCheckTemplates(
    companyId: string,
    plantId: string,
    checkTypeCode: string,
    operator: string,
  ): Promise<PmCheckTemplateResponseDto[]> {
    const activePlantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId),
    );
    const templates = await this.pmRepository.findTemplates(companyId, activePlantId, checkTypeCode);
    return templates.map((item) => ({
      itemNo: item.itemNo,
      checkName: item.checkName,
      checkMethod: item.checkMethod,
      minValue: item.minValue,
      maxValue: item.maxValue,
      baseValue: item.baseValue,
      unit: item.unit,
    }));
  }

  async savePmRecord(
    companyId: string,
    request: SavePmRecordDto,
    operator: string,
    mode: 'create' | 'update',
  ): Promise<PmRecordResponseDto> {
    const { pmRecord, checkItems } = request;
    const plantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, pmRecord.plantId),
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let pmId = pmRecord.id?.trim() || '';
    if (mode === 'create' && pmId) {
      throw new BadRequestException('신규 예방점검에는 문서번호를 지정할 수 없습니다.');
    }
    if (mode === 'update' && !pmId) {
      throw new BadRequestException('수정할 예방점검 문서번호가 필요합니다.');
    }
    try {
      const isNew = !pmId;
      const stage = (pmRecord.stepStage || 'R').toUpperCase();
      const refModule = pmRecord.refModule?.toUpperCase() || null;
      const refNo = pmRecord.refNo?.trim() || null;
      this.validateStage(stage, refModule, refNo);

      if (stage === 'R' && refNo) {
        await this.requireConfirmedPlan(
          queryRunner.manager,
          companyId,
          plantId,
          refNo,
        );
      }

      let previousStatus: string | null = null;
      let record: PmRecord;
      if (isNew) {
        pmId = await this.sequenceService.generateNextNo(
          companyId,
          AppModule.PM,
          pmRecord.departmentId,
        );
        record = queryRunner.manager.getRepository(PmRecord).create({
          companyId,
          plantId,
          id: pmId,
          createdBy: operator,
          updatedBy: operator,
          deleteYn: 'N',
        });
      } else {
        record = await this.findLockedRecord(
          queryRunner.manager,
          companyId,
          plantId,
          pmId,
        );
        previousStatus = record.status;
        if (![DocStatus.TEMP, DocStatus.REJECTED].includes(record.status as DocStatus)) {
          throw new BadRequestException('임시저장 또는 반려 상태의 예방점검만 수정할 수 있습니다.');
        }
      }

      const values = this.normalizeHeader(pmRecord, stage, refModule, refNo);
      if (previousStatus === DocStatus.REJECTED) {
        values.approvalId = null;
      }
      // 종료 여부는 전용 종료 API에서만 변경한다. 기존 계획 수정으로 재개방하지 않는다.
      if (!isNew) delete values.closeYn;
      Object.assign(record, values, { updatedBy: operator });
      await queryRunner.manager.getRepository(PmRecord).save(record);

      const itemRepository = queryRunner.manager.getRepository(PmRecordItem);
      await itemRepository.delete({ companyId, plantId, pmRecordId: pmId });
      if (checkItems.length > 0) {
        await itemRepository.save(
          checkItems.map((item, index) =>
            itemRepository.create(this.toItemEntity(companyId, plantId, pmId, item, index, stage)),
          ),
        );
      }

      const firstSelfConfirmation =
        stage === 'R' &&
        pmRecord.status === DocStatus.SELF_CONFIRMED &&
        previousStatus !== DocStatus.SELF_CONFIRMED &&
        previousStatus !== DocStatus.CONFIRMED;
      if (firstSelfConfirmation) {
        if (refNo) {
          await this.ensureNoConfirmedResult(
            queryRunner.manager,
            companyId,
            plantId,
            refNo,
            pmId,
          );
        }
        await this.updateEquipmentCycle(
          queryRunner.manager,
          companyId,
          plantId,
          pmRecord.equipmentId,
          pmRecord.checkTypeCode,
          values.workDate!,
          operator,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const saved = await this.pmRepository.findRecord(companyId, plantId, pmId);
    if (!saved) throw new NotFoundException('저장된 예방점검 문서를 찾을 수 없습니다.');
    return this.toRecordResponse(saved);
  }

  async closePmPlan(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<void> {
    const activePlantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId),
    );
    await this.dataSource.transaction(async (manager) => {
      const plan = await this.findLockedRecord(manager, companyId, activePlantId, id);
      if (plan.stepStage !== 'P') throw new BadRequestException('실적 문서는 종료할 수 없습니다.');
      if (plan.closeYn === 'Y') throw new BadRequestException('이미 종료된 계획입니다.');
      plan.closeYn = 'Y';
      plan.updatedBy = operator;
      await manager.getRepository(PmRecord).save(plan);
    });
  }

  async deletePmRecord(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<void> {
    const activePlantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId),
    );
    await this.dataSource.transaction(async (manager) => {
      const record = await this.findLockedRecord(manager, companyId, activePlantId, id);
      if (record.stepStage === 'P') {
        const resultCount = await manager.getRepository(PmRecord).count({
          where: {
            companyId,
            plantId: activePlantId,
            refNo: id,
            refModule: AppModule.PM,
            stepStage: 'R',
            deleteYn: 'N',
          },
        });
        if (resultCount > 0) {
          throw new BadRequestException('연결된 실적이 있어 계획을 삭제할 수 없습니다.');
        }
      }
      record.deleteYn = 'Y';
      record.updatedBy = operator;
      await manager.getRepository(PmRecord).save(record);
    });
  }

  private validateStage(stage: string, refModule: string | null, refNo: string | null): void {
    if (!['P', 'R'].includes(stage)) {
      throw new BadRequestException('예방점검 단계는 P(계획) 또는 R(실적)만 가능합니다.');
    }
    if (stage === 'P' && (refModule || refNo)) {
      throw new BadRequestException('예방점검 계획은 참조 계획번호를 가질 수 없습니다.');
    }
    if (stage === 'R' && (!!refModule !== !!refNo || (refModule && refModule !== AppModule.PM))) {
      throw new BadRequestException('참조 실적은 PM 계획번호와 참조 모듈을 모두 입력해야 합니다.');
    }
  }

  private requirePlantId(plantId: string | null): string {
    if (!plantId) throw new BadRequestException('활성 사업장을 확인할 수 없습니다.');
    return plantId;
  }

  private normalizeHeader(
    input: PmRecordHeaderDto,
    stage: string,
    refModule: string | null,
    refNo: string | null,
  ): Partial<PmRecord> {
    let workDate = input.workDate ? toDateOnly(input.workDate) : null;
    const cycleFrom = input.cycleFrom ? toDateOnly(input.cycleFrom) : null;
    const cycleEnd = input.cycleEnd ? toDateOnly(input.cycleEnd) : null;
    const recurring = stage === 'P' && !!cycleFrom && !!cycleEnd;
    if (recurring) workDate = null;
    if (stage === 'P' && !recurring && !workDate) {
      throw new BadRequestException('단일 예방점검 계획은 계획일이 필요합니다.');
    }
    if (stage === 'P' && (!!cycleFrom !== !!cycleEnd)) {
      throw new BadRequestException('반복작업은 시작일과 종료일을 모두 입력해야 합니다.');
    }
    if (stage === 'R' && !workDate) {
      throw new BadRequestException('예방점검 실적은 점검일이 필요합니다.');
    }

    return {
      title: input.title?.trim() || null,
      equipmentId: input.equipmentId,
      departmentId: input.departmentId,
      checkTypeCode: input.checkTypeCode,
      stepStage: stage,
      cycleFrom: stage === 'P' ? cycleFrom : null,
      cycleEnd: stage === 'P' ? cycleEnd : null,
      closeYn: stage === 'P' ? 'N' : null,
      workDate,
      workerId: input.workerId,
      judgeCode: input.judgeCode,
      remarks: input.remarks ?? null,
      certNumber: input.certNumber ?? null,
      certExpireDate: input.certExpireDate ? toDateOnly(input.certExpireDate) : null,
      certAgency: input.certAgency ?? null,
      approvalId: input.approvalId ?? null,
      refNo: stage === 'R' ? refNo : null,
      refModule: stage === 'R' ? refModule : null,
      status: input.status || DocStatus.TEMP,
    };
  }

  private async findLockedRecord(
    manager: EntityManager,
    companyId: string,
    plantId: string,
    id: string,
  ): Promise<PmRecord> {
    const record = await manager
      .getRepository(PmRecord)
      .createQueryBuilder('pm')
      .setLock('pessimistic_write')
      .where('pm.companyId = :companyId', { companyId })
      .andWhere('pm.plantId = :plantId', { plantId })
      .andWhere('pm.id = :id', { id })
      .andWhere('pm.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getOne();
    if (!record) throw new NotFoundException('예방점검 문서를 찾을 수 없습니다.');
    return record;
  }

  private async requireConfirmedPlan(
    manager: EntityManager,
    companyId: string,
    plantId: string,
    id: string,
  ): Promise<void> {
    const plan = await manager
      .getRepository(PmRecord)
      .createQueryBuilder('pm')
      .setLock('pessimistic_write')
      .where('pm.companyId = :companyId', { companyId })
      .andWhere('pm.plantId = :plantId', { plantId })
      .andWhere('pm.id = :id', { id })
      .andWhere('pm.stepStage = :stage', { stage: 'P' })
      .andWhere('pm.status IN (:...statuses)', {
        statuses: [DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED],
      })
      .andWhere('pm.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getOne();
    if (!plan) {
      throw new BadRequestException('확정된 예방점검 계획에 대해서만 참조 실적을 입력할 수 있습니다.');
    }
  }

  private async ensureNoConfirmedResult(
    manager: EntityManager,
    companyId: string,
    plantId: string,
    refNo: string,
    currentId: string,
  ): Promise<void> {
    const count = await manager
      .getRepository(PmRecord)
      .createQueryBuilder('pm')
      .where('pm.companyId = :companyId', { companyId })
      .andWhere('pm.plantId = :plantId', { plantId })
      .andWhere('pm.stepStage = :stage', { stage: 'R' })
      .andWhere('pm.refModule = :module', { module: AppModule.PM })
      .andWhere('pm.refNo = :refNo', { refNo })
      .andWhere('pm.status IN (:...statuses)', {
        statuses: [DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED],
      })
      .andWhere('pm.id <> :currentId', { currentId })
      .andWhere('pm.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getCount();
    if (count > 0) throw new BadRequestException('이미 확정된 예방점검 실적이 있는 계획입니다.');
  }

  private async updateEquipmentCycle(
    manager: EntityManager,
    companyId: string,
    plantId: string,
    equipmentId: string,
    checkTypeCode: string,
    workDate: string,
    operator: string,
  ): Promise<void> {
    const repository = manager.getRepository(EquipmentCheckCycle);
    const cycle = await repository.findOne({
      where: { companyId, plantId, equipmentId, checkTypeCode, deleteYn: 'N' },
    });
    if (!cycle) return;
    cycle.lastCheckDate = workDate;
    cycle.nextCheckDate = addDateOnly(workDate, cycle.cycleVal, cycle.cycleUnit);
    cycle.updatedBy = operator;
    await repository.save(cycle);
  }

  private toItemEntity(
    companyId: string,
    plantId: string,
    pmRecordId: string,
    item: PmRecordItemDto,
    index: number,
    stage: string,
  ): Partial<PmRecordItem> {
    const numberString = (value?: number | null) => (value == null ? null : String(value));
    return {
      companyId,
      plantId,
      pmRecordId,
      itemNo: index + 1,
      checkName: item.checkName,
      checkMethod: item.checkMethod ?? null,
      minValue: numberString(item.minValue),
      maxValue: numberString(item.maxValue),
      baseValue: numberString(item.baseValue),
      unit: item.unit ?? null,
      checkValue: stage === 'P' ? null : numberString(item.checkValue),
    };
  }

  private toRecordResponse(record: PmRecord): PmRecordResponseDto {
    return {
      companyId: record.companyId,
      plantId: record.plantId,
      id: record.id,
      title: record.title,
      equipmentId: record.equipmentId,
      equipmentName: record.equipment?.name ?? null,
      departmentId: record.departmentId,
      checkTypeCode: record.checkTypeCode,
      stepStage: record.stepStage,
      cycleFrom: record.cycleFrom,
      cycleEnd: record.cycleEnd,
      closeYn: record.closeYn,
      workDate: record.workDate,
      workerId: record.workerId,
      judgeCode: record.judgeCode,
      remarks: record.remarks,
      certNumber: record.certNumber,
      certExpireDate: record.certExpireDate,
      certAgency: record.certAgency,
      approvalId: record.approvalId,
      refNo: record.refNo,
      refModule: record.refModule,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      createdBy: record.createdBy,
    };
  }

  private toItemResponse(item: PmRecordItem): PmRecordItemResponseDto {
    return {
      itemNo: item.itemNo,
      checkName: item.checkName,
      checkMethod: item.checkMethod,
      minValue: item.minValue,
      maxValue: item.maxValue,
      baseValue: item.baseValue,
      unit: item.unit,
      checkValue: item.checkValue,
    };
  }
}
