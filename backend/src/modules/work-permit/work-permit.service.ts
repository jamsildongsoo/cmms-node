import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { DocStatus } from '../../common/constants/status.constants';
import {
  WorkPermit,
  WorkPermitCheckItem,
} from '../../entities/work-permit.entity';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import {
  SaveWorkPermitDto,
  WorkPermitResponseDto,
} from './dto/work-permit.dto';
import { WorkPermitRepository } from './work-permit.repository';
import { FileStorageService } from '../file/file-storage.service';

@Injectable()
export class WorkPermitService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly workPermitRepository: WorkPermitRepository,
    private readonly permissionPolicyService: PermissionPolicyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async getWorkPermitsByCompany(
    companyId: string,
    operator: string,
    searchType?: string,
    searchValue?: string,
    tempOnly?: string,
    requestedPlantId?: string,
  ): Promise<WorkPermitResponseDto[]> {
    const plantId = await resolveActivePlantId(this.dataSource, companyId, operator, requestedPlantId, AppModule.WP);
    return (
      await this.workPermitRepository.findAll(
        companyId,
        plantId ?? undefined,
        searchType,
        searchValue,
        tempOnly,
        operator,
      )
    ).map((entity) => this.toResponse(entity));
  }

  async getWorkPermitDetails(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<WorkPermitResponseDto> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      plantId,
      AppModule.WP,
    );
    if (!activePlantId) throw new BadRequestException('사업장을 확인할 수 없습니다.');
    const entity = await this.workPermitRepository.findOne(
      companyId,
      activePlantId,
      id,
    );
    if (!entity) throw new NotFoundException('작업허가서를 찾을 수 없습니다.');
    return this.toResponse(entity);
  }

  async saveWorkPermit(
    companyId: string,
    input: SaveWorkPermitDto,
    operator: string,
    mode: 'create' | 'update',
    roleId?: string,
  ): Promise<WorkPermitResponseDto> {
    const plantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      input.plantId,
      AppModule.WP,
    );
    if (!plantId) throw new BadRequestException('사업장을 확인할 수 없습니다.');
    if (input.status !== DocStatus.TEMP) {
      throw new BadRequestException('작업허가는 임시저장 상태로만 저장할 수 있습니다.');
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let id = input.id?.trim() || '';
    if (mode === 'create' && id) {
      throw new BadRequestException('신규 작업허가서에는 문서번호를 지정할 수 없습니다.');
    }
    if (mode === 'update' && !id) {
      throw new BadRequestException('수정할 작업허가서 문서번호가 필요합니다.');
    }
    try {
      const repository = runner.manager.getRepository(WorkPermit);
      let entity: WorkPermit;
      if (!id) {
        id = await this.sequenceService.generateNextNo(
          companyId,
          AppModule.WP,
          input.departmentId,
        );
        entity = repository.create({
          companyId,
          plantId,
          id,
          createdBy: operator,
          deleteYn: 'N',
        });
      } else {
        entity = await this.findLocked(
          runner.manager,
          companyId,
          plantId,
          id,
        );
        await this.permissionPolicyService.assertCanUpdateOwnTempOrPermission({
          companyId,
          roleId: roleId ?? '',
          userId: operator,
          module: AppModule.WP,
          status: entity.status,
          ownerId: entity.createdBy,
          operatorId: operator,
          resourceLabel: '작업허가',
        });
        if (entity.status !== DocStatus.TEMP) {
          throw new BadRequestException('임시저장 상태의 작업허가서만 수정할 수 있습니다.');
        }
      }
      Object.assign(entity, {
        equipmentId: input.equipmentId,
        workOrderId: input.workOrderId ?? null,
        title: input.title,
        stepStage: input.stepStage,
        permitTypeCodes: input.permitTypeCodes,
        startAt: input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt ? new Date(input.endAt) : null,
        departmentId: input.departmentId,
        supervisorId: input.supervisorId,
        workSummary: input.workSummary ?? null,
        riskFactors: input.riskFactors ?? null,
        safetyMeasures: input.safetyMeasures ?? null,
        jsonGeneral: this.parseChecks(input.jsonGeneral),
        jsonFire: this.parseChecks(input.jsonFire),
        jsonConfined: this.parseChecks(input.jsonConfined),
        jsonElectric: this.parseChecks(input.jsonElectric),
        jsonHighPlace: this.parseChecks(input.jsonHighPlace),
        jsonExcavation: this.parseChecks(input.jsonExcavation),
        jsonHeavyLoad: this.parseChecks(input.jsonHeavyLoad),
        remarks: input.remarks ?? null,
        fileGroupId: input.fileGroupId ?? null,
        refNo: input.refNo ?? null,
        refModule: input.refModule ?? null,
        approvalId: input.approvalId ?? null,
        status: input.status || DocStatus.TEMP,
        updatedBy: operator,
      });
      await repository.save(entity);
      if (entity.fileGroupId != null) {
        await this.fileStorageService.bindGroupToReference({
          manager: runner.manager,
          companyId,
          groupNo: entity.fileGroupId,
          refModule: AppModule.WP,
          refNo: id,
          operatorId: operator,
        });
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    const saved = await this.workPermitRepository.findOne(companyId, plantId, id);
    if (!saved) throw new NotFoundException('저장된 작업허가서를 찾을 수 없습니다.');
    return this.toResponse(saved);
  }

  async deleteWorkPermit(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
    roleId: string,
  ): Promise<void> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      plantId,
      AppModule.WP,
    );
    if (!activePlantId) throw new BadRequestException('사업장을 확인할 수 없습니다.');
    const repository = this.dataSource.getRepository(WorkPermit);
    const entity = await repository.findOne({
      where: { companyId, plantId: activePlantId, id, deleteYn: 'N' },
    });
    if (!entity) throw new NotFoundException('작업허가서를 찾을 수 없습니다.');
    await this.permissionPolicyService.assertCanDeleteOwnTempOrPermission({
      companyId,
      roleId,
      userId: operator,
      module: AppModule.WP,
      status: entity.status,
      ownerId: entity.createdBy,
      operatorId: operator,
      resourceLabel: '작업허가',
    });
    if (entity.status !== DocStatus.TEMP) {
      throw new BadRequestException('임시저장 상태의 작업허가서만 삭제할 수 있습니다.');
    }
    const fileGroupId = entity.fileGroupId;
    entity.deleteYn = 'Y';
    entity.updatedBy = operator;
    await repository.save(entity);
    await this.fileStorageService.deleteGroupByCompany(companyId, fileGroupId, operator);
  }

  private async findLocked(
    manager: EntityManager,
    companyId: string,
    plantId: string,
    id: string,
  ): Promise<WorkPermit> {
    const entity = await manager
      .getRepository(WorkPermit)
      .createQueryBuilder('wp')
      .setLock('pessimistic_write')
      .where('wp.companyId = :companyId', { companyId })
      .andWhere('wp.plantId = :plantId', { plantId })
      .andWhere('wp.id = :id', { id })
      .andWhere('wp.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getOne();
    if (!entity) throw new NotFoundException('작업허가서를 찾을 수 없습니다.');
    return entity;
  }

  private parseChecks(
    value?: WorkPermitCheckItem[] | string | null,
  ): WorkPermitCheckItem[] | null {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('작업허가 체크시트 형식이 올바르지 않습니다.');
      }
      return parsed as WorkPermitCheckItem[];
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('작업허가 체크시트 JSON 형식이 올바르지 않습니다.');
    }
  }

  private toResponse(entity: WorkPermit): WorkPermitResponseDto {
    return {
      companyId: entity.companyId,
      plantId: entity.plantId,
      id: entity.id,
      equipmentId: entity.equipmentId,
      equipmentName: entity.equipment?.name ?? null,
      workOrderId: entity.workOrderId,
      title: entity.title,
      stepStage: entity.stepStage,
      permitTypeCodes: entity.permitTypeCodes,
      startAt: entity.startAt?.toISOString() ?? null,
      endAt: entity.endAt?.toISOString() ?? null,
      departmentId: entity.departmentId,
      supervisorId: entity.supervisorId,
      workSummary: entity.workSummary,
      riskFactors: entity.riskFactors,
      safetyMeasures: entity.safetyMeasures,
      jsonGeneral: entity.jsonGeneral,
      jsonFire: entity.jsonFire,
      jsonConfined: entity.jsonConfined,
      jsonElectric: entity.jsonElectric,
      jsonHighPlace: entity.jsonHighPlace,
      jsonExcavation: entity.jsonExcavation,
      jsonHeavyLoad: entity.jsonHeavyLoad,
      remarks: entity.remarks,
      fileGroupId:
        entity.fileGroupId == null ? null : Number(entity.fileGroupId),
      refNo: entity.refNo,
      refModule: entity.refModule,
      approvalId: entity.approvalId,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      createdBy: entity.createdBy,
    };
  }
}
