import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { Approval } from '../../entities/approval.entity';
import { ApprovalStep } from '../../entities/approval-step.entity';
import { EquipmentCheckCycle } from '../../entities/equipment-check-cycle.entity';
import { PmRecord } from '../../entities/pm-record.entity';
import { User } from '../../entities/users.entity';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkPermit } from '../../entities/work-permit.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import {
  ApprovalAction,
  ApprovalResult,
  ApprovalStepType,
} from '../../common/constants/approval.constants';
import { DocStatus } from '../../common/constants/status.constants';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { addDateOnly } from '../../common/utils/date-only.util';
import { ApprovalActionDto } from './dto/approval-action.dto';
import {
  ApprovalDetailResponseDto,
  ApprovalResponseDto,
  ApprovalStepResponseDto,
} from './dto/approval-response.dto';
import { ApprovalSubmitDto } from './dto/approval-submit.dto';
import { ApprovalRepository } from './approval.repository';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import { FileStorageService } from '../file/file-storage.service';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly approvalRepository: ApprovalRepository,
    private readonly permissionPolicyService: PermissionPolicyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async createApproval(
    companyId: string,
    request: ApprovalSubmitDto,
    operator: string,
  ): Promise<ApprovalResponseDto> {
    return this.saveApproval(companyId, request, operator, null);
  }

  async updateApproval(
    companyId: string,
    id: string,
    request: ApprovalSubmitDto,
    operator: string,
    roleId: string,
  ): Promise<ApprovalResponseDto> {
    return this.saveApproval(companyId, request, operator, id.trim(), roleId);
  }

  private async saveApproval(
    companyId: string,
    request: ApprovalSubmitDto,
    operator: string,
    existingId: string | null,
    roleId?: string,
  ): Promise<ApprovalResponseDto> {
    const { approval: input, steps, refNo, refModule } = request;
    this.validateReference(refModule ?? null, refNo ?? null);
    const hasApprover = !!steps?.some((step) =>
      [ApprovalStepType.APPROVAL, ApprovalStepType.AGREEMENT].includes(
        step.approvalType as ApprovalStepType,
      ),
    );
    const status =
      input.status === DocStatus.TEMP
        ? DocStatus.TEMP
        : hasApprover
          ? DocStatus.IN_PROGRESS
          : DocStatus.TEMP;

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let approvalId = existingId || '';
    try {
      const repository = runner.manager.getRepository(Approval);
      const stepRepository = runner.manager.getRepository(ApprovalStep);
      const isNew = !approvalId;
      let entity: Approval;

      if (isNew) {
        const drafter = await runner.manager.getRepository(User).findOne({
          where: { companyId, id: operator, deleteYn: 'N' },
        });
        approvalId = await this.sequenceService.generateNextNo(
          companyId,
          AppModule.APR,
          drafter?.departmentId ?? null,
          companyId,
        );
        entity = repository.create({
          companyId,
          id: approvalId,
          drafterId: operator,
          createdBy: operator,
          updatedBy: operator,
          deleteYn: 'N',
        });
      } else {
        entity = await this.findLockedApproval(
          runner.manager,
          companyId,
          approvalId,
        );
        const canEditOwnTemp = await this.permissionPolicyService.assertCanUpdateOwnTempOrPermission({
          companyId,
          roleId: roleId ?? '',
          module: AppModule.APR,
          status: entity.status,
          ownerId: entity.drafterId,
          operatorId: operator,
          resourceLabel: '전자결재',
        });
        if (entity.status !== DocStatus.TEMP) {
          throw new BadRequestException('임시저장 상태에서만 재상신할 수 있습니다.');
        }
        if (canEditOwnTemp) this.assertDraftOwner(entity, operator);
        if (steps) {
          await stepRepository.delete({
            companyId,
            approvalId,
            stepNo: MoreThan(0),
          });
        }
      }

      Object.assign(entity, {
        title: input.title,
        content: input.content ?? null,
        fileGroupId: input.fileGroupId ?? null,
        status,
        refModule: refModule?.toUpperCase() || null,
        refNo: refNo?.trim() || null,
        updatedBy: operator,
      });
      await repository.save(entity);
      if (entity.fileGroupId != null) {
        await this.fileStorageService.bindGroupToReference({
          manager: runner.manager,
          companyId,
          groupNo: entity.fileGroupId,
          refModule: AppModule.APR,
          refNo: approvalId,
          operatorId: operator,
        });
      }

      if (isNew) {
        await stepRepository.save(
          stepRepository.create({
            companyId,
            approvalId,
            stepNo: 0,
            approverId: operator,
            approvalType: ApprovalStepType.DRAFT,
            approvalResult: ApprovalResult.APPROVED,
            actionAt: new Date(),
            comments: '상신함',
          }),
        );
      }
      if (steps?.length) {
        await stepRepository.save(
          steps.map((step, index) =>
            stepRepository.create({
              companyId,
              approvalId,
              stepNo: index + 1,
              approverId: step.approverId,
              approvalType: step.approvalType,
              approvalResult: null,
              actionAt: null,
              comments: null,
            }),
          ),
        );
      }

      if (status === DocStatus.IN_PROGRESS && entity.refModule && entity.refNo) {
        await this.updateLinkedDocument(
          runner.manager,
          entity,
          DocStatus.IN_PROGRESS,
          operator,
        );
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

    const saved = await this.approvalRepository.findDetail(companyId, approvalId);
    if (!saved) throw new NotFoundException('저장된 결재 문서를 찾을 수 없습니다.');
    return this.toApprovalResponse(saved);
  }

  async getSentApprovals(companyId: string, userId: string): Promise<ApprovalResponseDto[]> {
    return (await this.approvalRepository.findSent(companyId, userId)).map((item) =>
      this.toApprovalResponse(item),
    );
  }

  async getPendingApprovals(companyId: string, userId: string): Promise<ApprovalResponseDto[]> {
    return (await this.approvalRepository.findPending(companyId, userId)).map((item) =>
      this.toApprovalResponse(item),
    );
  }

  async getReferencedApprovals(companyId: string, userId: string): Promise<ApprovalResponseDto[]> {
    return (await this.approvalRepository.findReferenced(companyId, userId)).map((item) =>
      this.toApprovalResponse(item),
    );
  }

  async getProcessedApprovals(companyId: string, userId: string): Promise<ApprovalResponseDto[]> {
    return (await this.approvalRepository.findProcessed(companyId, userId)).map((item) =>
      this.toApprovalResponse(item),
    );
  }

  async getApprovalDetails(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<ApprovalDetailResponseDto> {
    const approval = await this.approvalRepository.findDetail(companyId, id);
    if (!approval) throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    this.assertCanReadApproval(approval, userId);
    return {
      approval: this.toApprovalResponse(approval),
      steps: [...(approval.steps || [])]
        .sort((a, b) => a.stepNo - b.stepNo)
        .map((step) => this.toStepResponse(step)),
    };
  }

  async deleteApproval(
    companyId: string,
    id: string,
    operator: string,
    roleId: string,
  ): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let fileGroupId: string | number | null = null;
    try {
      const approval = await this.findLockedApproval(runner.manager, companyId, id);
      fileGroupId = approval.fileGroupId;
      const canDeleteOwnTemp = await this.permissionPolicyService.assertCanDeleteOwnTempOrPermission({
        companyId,
        roleId,
        module: AppModule.APR,
        status: approval.status,
        ownerId: approval.drafterId,
        operatorId: operator,
        resourceLabel: '전자결재',
      });
      if (approval.status !== DocStatus.TEMP) {
        throw new BadRequestException('임시저장 문서만 삭제할 수 있습니다.');
      }
      if (canDeleteOwnTemp) this.assertDraftOwner(approval, operator);
      approval.deleteYn = 'Y';
      approval.updatedBy = operator;
      await runner.manager.getRepository(Approval).save(approval);
      await runner.commitTransaction();
      await this.fileStorageService.deleteGroupByCompany(companyId, fileGroupId, operator);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async processApprovalAction(
    companyId: string,
    id: string,
    request: ApprovalActionDto,
    approverId: string,
  ): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const approval = await this.findLockedApproval(runner.manager, companyId, id);
      if (approval.status !== DocStatus.IN_PROGRESS) {
        throw new BadRequestException('이미 종료된 결재 문서입니다.');
      }

      const repository = runner.manager.getRepository(ApprovalStep);
      const steps = await repository.find({
        where: { companyId, approvalId: id },
        order: { stepNo: 'ASC' },
      });
      const current = steps.find(
        (step) =>
          [ApprovalStepType.APPROVAL, ApprovalStepType.AGREEMENT].includes(
            step.approvalType as ApprovalStepType,
          ) && step.approvalResult === null,
      );
      if (!current) throw new BadRequestException('결재 대기 중인 단계가 없습니다.');
      if (current.approverId !== approverId) {
        throw new BadRequestException('결재할 수 있는 권한이 없거나 대기 중이 아닙니다.');
      }

      current.approvalResult =
        request.action === ApprovalAction.APPROVE
          ? ApprovalResult.APPROVED
          : ApprovalResult.REJECTED;
      current.actionAt = new Date();
      current.comments = request.comments ?? null;
      await repository.save(current);

      if (request.action === ApprovalAction.REJECT) {
        approval.status = DocStatus.REJECTED;
        approval.updatedBy = approverId;
        await runner.manager.getRepository(Approval).save(approval);
        await this.updateLinkedDocument(
          runner.manager,
          approval,
          DocStatus.REJECTED,
          approverId,
        );
      } else {
        const hasRemaining = steps.some(
          (step) =>
            step.stepNo !== current.stepNo &&
            [ApprovalStepType.APPROVAL, ApprovalStepType.AGREEMENT].includes(
              step.approvalType as ApprovalStepType,
            ) &&
            step.approvalResult === null,
        );
        if (!hasRemaining) {
          approval.status = DocStatus.CONFIRMED;
          approval.updatedBy = approverId;
          await runner.manager.getRepository(Approval).save(approval);
          await this.updateLinkedDocument(
            runner.manager,
            approval,
            DocStatus.CONFIRMED,
            approverId,
          );
        }
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async findLockedApproval(
    manager: EntityManager,
    companyId: string,
    id: string,
  ): Promise<Approval> {
    const approval = await manager
      .getRepository(Approval)
      .createQueryBuilder('approval')
      .setLock('pessimistic_write')
      .where('approval.companyId = :companyId', { companyId })
      .andWhere('approval.id = :id', { id })
      .andWhere('approval.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getOne();
    if (!approval) throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    return approval;
  }

  private assertDraftOwner(approval: Approval, userId: string): void {
    if (approval.drafterId !== userId) {
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    }
  }

  private assertCanReadApproval(approval: Approval, userId: string): void {
    if (approval.drafterId === userId) return;
    if (approval.status === DocStatus.TEMP) {
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    }
    const isParticipant = (approval.steps || []).some(
      (step) => step.approverId === userId,
    );
    if (!isParticipant) {
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    }
  }

  private async updateLinkedDocument(
    manager: EntityManager,
    approval: Approval,
    status: DocStatus,
    operator: string,
  ): Promise<void> {
    if (!approval.refModule || !approval.refNo) return;
    const values = { approvalId: approval.id, status, updatedBy: operator };
    let affected = 0;
    if (approval.refModule === AppModule.PM) {
      const repository = manager.getRepository(PmRecord);
      const record = await repository.findOne({
        where: {
          companyId: approval.companyId,
          id: approval.refNo,
          deleteYn: 'N',
        },
      });
      if (record) {
        Object.assign(record, values);
        await repository.save(record);
        affected = 1;
        if (status === DocStatus.CONFIRMED && record.stepStage === 'R') {
          await this.updateCheckCycle(manager, record, operator);
        }
      }
    } else if (approval.refModule === AppModule.WO) {
      const result = await manager.getRepository(WorkOrder).update(
        { companyId: approval.companyId, id: approval.refNo, deleteYn: 'N' },
        values,
      );
      affected = result.affected || 0;
    } else if (approval.refModule === AppModule.WP) {
      const result = await manager.getRepository(WorkPermit).update(
        { companyId: approval.companyId, id: approval.refNo, deleteYn: 'N' },
        values,
      );
      affected = result.affected || 0;
    } else if (approval.refModule === AppModule.PUR) {
      const result = await manager.getRepository(PurchaseRequest).update(
        { companyId: approval.companyId, id: approval.refNo, deleteYn: 'N' },
        values,
      );
      affected = result.affected || 0;
    }
    if (affected === 0) {
      throw new NotFoundException('연계된 원본 문서를 찾을 수 없습니다.');
    }
  }

  private async updateCheckCycle(
    manager: EntityManager,
    record: PmRecord,
    operator: string,
  ): Promise<void> {
    if (record.refNo) {
      const duplicate = await manager.getRepository(PmRecord).count({
        where: {
          companyId: record.companyId,
          plantId: record.plantId,
          stepStage: 'R',
          refModule: AppModule.PM,
          refNo: record.refNo,
          status: DocStatus.CONFIRMED,
          deleteYn: 'N',
        },
      });
      if (duplicate > 1) {
        throw new BadRequestException('이미 확정된 예방점검 실적이 있는 계획입니다.');
      }
    }
    const repository = manager.getRepository(EquipmentCheckCycle);
    const cycle = await repository.findOne({
      where: {
        companyId: record.companyId,
        plantId: record.plantId,
        equipmentId: record.equipmentId,
        checkTypeCode: record.checkTypeCode,
        deleteYn: 'N',
      },
    });
    if (!cycle || !record.workDate) return;
    cycle.lastCheckDate = record.workDate;
    cycle.nextCheckDate = addDateOnly(record.workDate, cycle.cycleVal, cycle.cycleUnit);
    cycle.updatedBy = operator;
    await repository.save(cycle);
  }

  private validateReference(refModule: string | null, refNo: string | null): void {
    if (!!refModule !== !!refNo) {
      throw new BadRequestException('연계 모듈과 원본 문서번호를 모두 입력해야 합니다.');
    }
    if (
      refModule &&
      ![AppModule.PM, AppModule.WO, AppModule.WP, AppModule.PUR].includes(
        refModule.toUpperCase() as AppModule,
      )
    ) {
      throw new BadRequestException('지원하지 않는 연계 모듈입니다.');
    }
  }

  private toApprovalResponse(entity: Approval): ApprovalResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      content: entity.content,
      drafterId: entity.drafterId,
      fileGroupId: entity.fileGroupId == null ? null : Number(entity.fileGroupId),
      status: entity.status,
      refModule: entity.refModule,
      refNo: entity.refNo,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toStepResponse(step: ApprovalStep): ApprovalStepResponseDto {
    return {
      stepNo: step.stepNo,
      approverId: step.approverId,
      approvalType: step.approvalType,
      approvalResult: step.approvalResult,
      actionAt: step.actionAt?.toISOString() ?? null,
      comments: step.comments,
    };
  }
}
