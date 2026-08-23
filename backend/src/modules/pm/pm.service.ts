import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PmRecordItem } from '../../entities/pm-record-item.entity';
import { PmRecord } from '../../entities/pm-record.entity';
import { DocStatus } from '../../common/constants/status.constants';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { toDateOnly } from '../../common/utils/date-only.util';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import {
  PmCheckTemplateResponseDto,
  PmRecordDetailsDto,
  PmRecordHeaderDto,
  PmRecordItemDto,
  PmRecordItemResponseDto,
  PmRecordResponseDto,
  SavePmRecordDto,
} from './dto/pm.dto';
import { PmRepository } from './pm.repository';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import { FileStorageService } from '../file/file-storage.service';

@Injectable()
export class PmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly pmRepository: PmRepository,
    private readonly permissionPolicyService: PermissionPolicyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async getPmRecords(
    companyId: string,
    operator: string,
    searchType?: string,
    searchValue?: string,
    showAll?: string,
    tempOnly?: string,
    requestedPlantId?: string,
  ): Promise<PmRecordResponseDto[]> {
    const plantId = await resolveActivePlantId(this.dataSource, companyId, operator, requestedPlantId, AppModule.PM);
    const records = await this.pmRepository.findRecords({
      companyId,
      plantId: plantId ?? undefined,
      searchType,
      searchValue,
      showAll,
      tempOnly,
      userId: operator,
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
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId, AppModule.PM),
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
    equipmentId: string,
    checkTypeCode: string,
    operator: string,
  ): Promise<PmCheckTemplateResponseDto[]> {
    const activePlantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId, AppModule.PM),
    );
    const templates = await this.pmRepository.findTemplates(companyId, activePlantId, equipmentId, checkTypeCode);
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

  async createPmRecord(
    companyId: string,
    request: SavePmRecordDto,
    operator: string,
  ): Promise<PmRecordResponseDto> {
    return this.saveDraft(companyId, request, operator, 'create');
  }

  async updatePmRecord(
    companyId: string,
    id: string,
    request: SavePmRecordDto,
    operator: string,
  ): Promise<PmRecordResponseDto> {
    return this.saveDraft(companyId, { ...request, pmRecord: { ...request.pmRecord, id } }, operator, 'update');
  }

  private async saveDraft(
    companyId: string,
    request: SavePmRecordDto,
    operator: string,
    mode: 'create' | 'update',
  ): Promise<PmRecordResponseDto> {
    const { pmRecord, checkItems } = request;
    const plantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, pmRecord.plantId, AppModule.PM),
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
      if (pmRecord.status && pmRecord.status !== DocStatus.TEMP) {
        throw new BadRequestException('예방점검은 임시저장 상태로만 저장할 수 있습니다.');
      }

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
        this.permissionPolicyService.assertOwnDraft({
          status: record.status,
          ownerId: record.createdBy,
          operatorId: operator,
        });
        if (record.status !== DocStatus.TEMP) {
          throw new BadRequestException('임시저장 상태의 예방점검만 수정할 수 있습니다.');
        }
      }

      const values = this.normalizeHeader(pmRecord);
      Object.assign(record, values, { updatedBy: operator });
      await queryRunner.manager.getRepository(PmRecord).save(record);
      if (record.fileGroupId != null) {
        await this.fileStorageService.bindGroupToReference({
          manager: queryRunner.manager,
          companyId,
          groupNo: record.fileGroupId,
          refModule: AppModule.PM,
          refNo: pmId,
          operatorId: operator,
        });
      }

      const itemRepository = queryRunner.manager.getRepository(PmRecordItem);
      await itemRepository.delete({ companyId, plantId, pmRecordId: pmId });
      if (checkItems.length > 0) {
        await itemRepository.save(
          checkItems.map((item, index) =>
            itemRepository.create(this.toItemEntity(companyId, plantId, pmId, item, index)),
          ),
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

  async deletePmRecord(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<void> {
    const activePlantId = this.requirePlantId(
      await resolveActivePlantId(this.dataSource, companyId, operator, plantId, AppModule.PM),
    );
    let fileGroupId: string | number | null = null;
    await this.dataSource.transaction(async (manager) => {
      const record = await this.findLockedRecord(manager, companyId, activePlantId, id);
      this.permissionPolicyService.assertOwnDraft({
        status: record.status,
        ownerId: record.createdBy,
        operatorId: operator,
      });
      if (record.status !== DocStatus.TEMP) {
        throw new BadRequestException('임시저장 상태의 예방점검만 삭제할 수 있습니다.');
      }
      fileGroupId = record.fileGroupId;
      record.deleteYn = 'Y';
      record.updatedBy = operator;
      await manager.getRepository(PmRecord).save(record);
    });
    await this.fileStorageService.deleteGroupByCompany(companyId, fileGroupId, operator);
  }

  private requirePlantId(plantId: string | null): string {
    if (!plantId) throw new BadRequestException('활성 사업장을 확인할 수 없습니다.');
    return plantId;
  }

  private normalizeHeader(
    input: PmRecordHeaderDto,
  ): Partial<PmRecord> {
    const workDate = input.workDate ? toDateOnly(input.workDate) : null;
    if (!workDate) {
      throw new BadRequestException('예방점검 실적은 점검일이 필요합니다.');
    }

    return {
      title: input.title?.trim() || null,
      equipmentId: input.equipmentId,
      departmentId: input.departmentId,
      checkTypeCode: input.checkTypeCode,
      workDate,
      workerId: input.workerId,
      judgeCode: input.judgeCode,
      remarks: input.remarks ?? null,
      approvalId: input.approvalId ?? null,
      fileGroupId: input.fileGroupId ?? null,
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


  private toItemEntity(
    companyId: string,
    plantId: string,
    pmRecordId: string,
    item: PmRecordItemDto,
    index: number,
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
      checkValue: numberString(item.checkValue),
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
      workDate: record.workDate,
      workerId: record.workerId,
      judgeCode: record.judgeCode,
      remarks: record.remarks,
      approvalId: record.approvalId,
      fileGroupId: record.fileGroupId == null ? null : Number(record.fileGroupId),
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
