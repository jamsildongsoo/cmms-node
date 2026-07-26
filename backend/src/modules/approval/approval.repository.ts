import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Approval } from '../../entities/approval.entity';
import { ApprovalStep } from '../../entities/approval-step.entity';
import { ApprovalStepType } from '../../common/constants/approval.constants';
import { DocStatus } from '../../common/constants/status.constants';

@Injectable()
export class ApprovalRepository {
  constructor(
    @InjectRepository(Approval)
    private readonly approvals: Repository<Approval>,
    @InjectRepository(ApprovalStep)
    private readonly steps: Repository<ApprovalStep>,
  ) {}

  findSent(companyId: string, drafterId: string): Promise<Approval[]> {
    return this.approvals.find({
      where: { companyId, drafterId, deleteYn: 'N' },
      order: { id: 'DESC' },
    });
  }

  async findPending(companyId: string, userId: string): Promise<Approval[]> {
    const mySteps = await this.steps.find({
      where: [
        {
          companyId,
          approverId: userId,
          approvalType: ApprovalStepType.APPROVAL,
          approvalResult: IsNull(),
        },
        {
          companyId,
          approverId: userId,
          approvalType: ApprovalStepType.AGREEMENT,
          approvalResult: IsNull(),
        },
      ],
    });
    const ids = [...new Set(mySteps.map((step) => step.approvalId))];
    if (ids.length === 0) return [];

    const approvals = await this.approvals.find({
      where: {
        companyId,
        id: In(ids),
        status: DocStatus.IN_PROGRESS,
        deleteYn: 'N',
      },
      relations: { steps: true },
      order: { id: 'DESC' },
    });
    return approvals.filter((approval) => {
      const current = [...(approval.steps || [])]
        .sort((a, b) => a.stepNo - b.stepNo)
        .find(
          (step) =>
            [ApprovalStepType.APPROVAL, ApprovalStepType.AGREEMENT].includes(
              step.approvalType as ApprovalStepType,
            ) && step.approvalResult === null,
        );
      return current?.approverId === userId;
    });
  }

  async findReferenced(companyId: string, userId: string): Promise<Approval[]> {
    const steps = await this.steps.find({
      where: {
        companyId,
        approverId: userId,
        approvalType: ApprovalStepType.REFERENCE,
      },
    });
    return this.findByIds(companyId, steps.map((step) => step.approvalId));
  }

  async findProcessed(companyId: string, userId: string): Promise<Approval[]> {
    const steps = await this.steps.find({
      where: [
        {
          companyId,
          approverId: userId,
          approvalType: ApprovalStepType.APPROVAL,
          approvalResult: Not(IsNull()),
        },
        {
          companyId,
          approverId: userId,
          approvalType: ApprovalStepType.AGREEMENT,
          approvalResult: Not(IsNull()),
        },
      ],
    });
    return this.findByIds(companyId, steps.map((step) => step.approvalId));
  }

  findDetail(companyId: string, id: string): Promise<Approval | null> {
    return this.approvals.findOne({
      where: { companyId, id, deleteYn: 'N' },
      relations: { steps: true },
      order: { steps: { stepNo: 'ASC' } },
    });
  }

  private findByIds(companyId: string, rawIds: string[]): Promise<Approval[]> {
    const ids = [...new Set(rawIds)];
    if (ids.length === 0) return Promise.resolve([]);
    return this.approvals.find({
      where: { companyId, id: In(ids), deleteYn: 'N' },
      order: { id: 'DESC' },
    });
  }
}
