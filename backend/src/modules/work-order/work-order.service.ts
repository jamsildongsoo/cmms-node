import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { DocStatus } from '../../common/constants/status.constants';
import { toFixedSafe } from '../../common/utils/decimal.util';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkOrderItem } from '../../entities/work-order-item.entity';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import {
  SaveWorkOrderDto,
  WorkOrderDetailsDto,
  WorkOrderItemDto,
  WorkOrderItemResponseDto,
  WorkOrderResponseDto,
} from './dto/work-order.dto';
import { WorkOrderRepository } from './work-order.repository';
import { FileStorageService } from '../file/file-storage.service';

@Injectable()
export class WorkOrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly workOrderRepository: WorkOrderRepository,
    private readonly permissionPolicyService: PermissionPolicyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async getWorkOrdersByCompany(
    companyId: string,
    operator: string,
    searchType?: string,
    searchValue?: string,
    tempOnly?: string,
    requestedPlantId?: string,
  ): Promise<WorkOrderResponseDto[]> {
    const plantId = await resolveActivePlantId(this.dataSource, companyId, operator, requestedPlantId, AppModule.WO);
    return (
      await this.workOrderRepository.findAll(
        companyId,
        plantId ?? undefined,
        searchType,
        searchValue,
        tempOnly,
        operator,
      )
    ).map((entity) => this.toResponse(entity));
  }

  async getWorkOrderDetails(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<WorkOrderDetailsDto> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      plantId,
      AppModule.WO,
    );
    if (!activePlantId) throw new BadRequestException('사업장을 확인할 수 없습니다.');
    const workOrder = await this.workOrderRepository.findOne(
      companyId,
      activePlantId,
      id,
    );
    if (!workOrder) throw new NotFoundException('작업 지시를 찾을 수 없습니다.');
    const items = await this.workOrderRepository.findItems(
      companyId,
      activePlantId,
      id,
    );
    return {
      workOrder: this.toResponse(workOrder),
      workItems: items.map((item) => this.toItemResponse(item)),
    };
  }

  async createWorkOrder(
    companyId: string,
    request: SaveWorkOrderDto,
    operator: string,
  ): Promise<WorkOrderResponseDto> {
    return this.saveDraft(companyId, request, operator, 'create');
  }

  async updateWorkOrder(
    companyId: string,
    id: string,
    request: SaveWorkOrderDto,
    operator: string,
  ): Promise<WorkOrderResponseDto> {
    return this.saveDraft(companyId, { ...request, workOrder: { ...request.workOrder, id } }, operator, 'update');
  }

  private async saveDraft(
    companyId: string,
    request: SaveWorkOrderDto,
    operator: string,
    mode: 'create' | 'update',
  ): Promise<WorkOrderResponseDto> {
    const { workOrder: input, workItems } = request;
    const plantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      input.plantId,
      AppModule.WO,
    );
    if (!plantId) throw new BadRequestException('사업장을 확인할 수 없습니다.');
    if (input.status !== DocStatus.TEMP) {
      throw new BadRequestException('작업지시는 임시저장 상태로만 저장할 수 있습니다.');
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let id = input.id?.trim() || '';
    if (mode === 'create' && id) {
      throw new BadRequestException('신규 작업지시에는 문서번호를 지정할 수 없습니다.');
    }
    if (mode === 'update' && !id) {
      throw new BadRequestException('수정할 작업지시 문서번호가 필요합니다.');
    }
    try {
      const repository = runner.manager.getRepository(WorkOrder);
      let entity: WorkOrder;
      if (!id) {
        id = await this.sequenceService.generateNextNo(
          companyId,
          AppModule.WO,
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
        this.permissionPolicyService.assertOwnDraft({
          status: entity.status,
          ownerId: entity.createdBy,
          operatorId: operator,
        });
        if (entity.status !== DocStatus.TEMP) {
          throw new BadRequestException('임시저장 상태의 작업지시만 수정할 수 있습니다.');
        }
      }
      Object.assign(entity, {
        equipmentId: input.equipmentId,
        title: input.title,
        stepStage: input.stepStage,
        woTypeCode: input.woTypeCode,
        departmentId: input.departmentId,
        workerId: input.workerId ?? null,
        workDate: input.workDate ?? null,
        cost: toFixedSafe(input.cost, 2),
        manHours: toFixedSafe(input.manHours, 2),
        manHoursUnit: input.manHoursUnit || 'H',
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
          refModule: AppModule.WO,
          refNo: id,
          operatorId: operator,
        });
      }
      await this.replaceItems(
        runner.manager,
        companyId,
        plantId,
        id,
        workItems,
      );
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    const saved = await this.workOrderRepository.findOne(companyId, plantId, id);
    if (!saved) throw new NotFoundException('저장된 작업지시를 찾을 수 없습니다.');
    return this.toResponse(saved);
  }

  async deleteWorkOrder(
    companyId: string,
    plantId: string,
    id: string,
    operator: string,
  ): Promise<void> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      plantId,
      AppModule.WO,
    );
    if (!activePlantId) throw new BadRequestException('사업장을 확인할 수 없습니다.');
    const repository = this.dataSource.getRepository(WorkOrder);
    const entity = await repository.findOne({
      where: { companyId, plantId: activePlantId, id, deleteYn: 'N' },
    });
    if (!entity) throw new NotFoundException('작업 지시를 찾을 수 없습니다.');
    this.permissionPolicyService.assertOwnDraft({
      status: entity.status,
      ownerId: entity.createdBy,
      operatorId: operator,
    });
    if (entity.status !== DocStatus.TEMP) {
      throw new BadRequestException('임시저장 상태의 작업지시만 삭제할 수 있습니다.');
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
  ): Promise<WorkOrder> {
    const entity = await manager
      .getRepository(WorkOrder)
      .createQueryBuilder('wo')
      .setLock('pessimistic_write')
      .where('wo.companyId = :companyId', { companyId })
      .andWhere('wo.plantId = :plantId', { plantId })
      .andWhere('wo.id = :id', { id })
      .andWhere('wo.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getOne();
    if (!entity) throw new NotFoundException('작업 지시를 찾을 수 없습니다.');
    return entity;
  }

  private async replaceItems(
    manager: EntityManager,
    companyId: string,
    plantId: string,
    workOrderId: string,
    items: WorkOrderItemDto[],
  ): Promise<void> {
    const repository = manager.getRepository(WorkOrderItem);
    await repository.delete({ companyId, plantId, workOrderId });
    if (!items.length) return;
    await repository.save(
      items.map((item, index) =>
        repository.create({
          companyId,
          plantId,
          workOrderId,
          itemNo: index + 1,
          workName: item.workName,
          workMethod: item.workMethod ?? null,
          workResult: item.workResult ?? null,
        }),
      ),
    );
  }

  private toResponse(entity: WorkOrder): WorkOrderResponseDto {
    return {
      companyId: entity.companyId,
      plantId: entity.plantId,
      id: entity.id,
      equipmentId: entity.equipmentId,
      equipmentName: entity.equipment?.name ?? null,
      title: entity.title,
      stepStage: entity.stepStage,
      woTypeCode: entity.woTypeCode,
      departmentId: entity.departmentId,
      workerId: entity.workerId,
      workDate: entity.workDate,
      cost: Number(entity.cost),
      manHours: Number(entity.manHours),
      manHoursUnit: entity.manHoursUnit,
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

  private toItemResponse(item: WorkOrderItem): WorkOrderItemResponseDto {
    return {
      itemNo: item.itemNo,
      workName: item.workName,
      workMethod: item.workMethod,
      workResult: item.workResult,
    };
  }
}
