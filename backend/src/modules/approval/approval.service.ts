import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { DocStatus } from '../../common/constants/status.constants';
import { addDateOnly, toDateOnly } from '../../common/utils/date-only.util';
import {
  ApprovalStepType,
  ApprovalResult,
  ApprovalAction,
} from '../../common/constants/approval.constants';

export interface ApprovalSubmitRequest {
  approval: {
    id?: string | null;
    title: string;
    content?: string | null;
    fileGroupId?: string | number | null;
    status?: string;
  };
  steps?: Array<{
    approverId: string;
    approvalType: string; // D, A, G, R
  }>;
  refNo?: string | null;
  refModule?: string | null;
}

export interface ApprovalActionRequest {
  action: ApprovalAction;
  comments?: string | null;
}

export interface ApprovalDetailResponse {
  approval: any;
  steps: any[];
}

/**
 * [동시성 규칙] 결재 문서를 변경하는 모든 경로(상신/재상신/결재처리)는
 * 트랜잭션 시작 시 부모 approval 행을 `SELECT … FOR UPDATE`로 선행 잠근다.
 * 이 단일 락이 동시 요청(더블클릭·재상신 겹침)을 직렬화해 이중 처리를 막는다.
 * 새 변경 경로를 추가할 때도 반드시 이 규칙을 따른다.
 */
@Injectable()
export class ApprovalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

  async submitApproval(companyId: string, request: ApprovalSubmitRequest, operator: string): Promise<any> {
    const { approval, steps, refNo, refModule } = request;
    const hasApprover = steps && steps.some((s) => s.approvalType === ApprovalStepType.APPROVAL || s.approvalType === ApprovalStepType.AGREEMENT);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let appNo = approval.id;
      const isNew = !appNo || appNo.trim() === '';

      if (isNew) {
        const userDeptRows = await qr.query(
          `SELECT department_id FROM users WHERE company_id = $1 AND id = $2`,
          [companyId, operator],
        );
        const userDept = userDeptRows[0]?.department_id ?? null;
        appNo = await this.sequenceService.generateNextNo(companyId, AppModule.APR, userDept);
      } else {
        // [동시성 규칙] 모든 결재 변경은 부모 approval 행을 FOR UPDATE로 선행 잠근다.
        // 재상신 vs 결재처리 동시 요청을 직렬화해 이중 처리/상태 뒤틀림을 막는다.
        const existing = await qr.query(
          `SELECT * FROM approval WHERE company_id = $1 AND id = $2 AND delete_yn = 'N' FOR UPDATE`,
          [companyId, appNo],
        );
        if (!existing.length) {
          throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
        }
        if (existing[0].status !== DocStatus.TEMP) {
          throw new BadRequestException('임시저장 상태에서만 재상신할 수 있습니다.');
        }
        await qr.query(
          `DELETE FROM approval_step WHERE company_id = $1 AND approval_id = $2`,
          [companyId, appNo],
        );
      }

      const status = hasApprover ? DocStatus.IN_PROGRESS : DocStatus.TEMP;

      if (isNew) {
        await qr.query(
          `INSERT INTO approval 
            (company_id, id, title, content, drafter_id, file_group_id, status, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 'N')`,
          [
            companyId, appNo, approval.title, approval.content ?? null, operator,
            approval.fileGroupId ?? null, status, operator
          ],
        );
      } else {
        await qr.query(
          `UPDATE approval 
           SET title = $3, content = $4, file_group_id = $5, status = $6, updated_by = $7
           WHERE company_id = $1 AND id = $2`,
          [
            companyId, appNo, approval.title, approval.content ?? null,
            approval.fileGroupId ?? null, status, operator
          ],
        );
      }

      await qr.query(
        `INSERT INTO approval_step 
          (company_id, approval_id, step_no, approver_id, approval_type, approval_result, action_at, comments)
         VALUES ($1, $2, 0, $3, '${ApprovalStepType.DRAFT}', '${ApprovalResult.APPROVED}', NOW(), '상신함')`,
        [companyId, appNo, operator],
      );

      if (steps && steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await qr.query(
            `INSERT INTO approval_step 
              (company_id, approval_id, step_no, approver_id, approval_type, approval_result, action_at, comments)
             VALUES ($1, $2, $3, $4, $5, NULL, NULL, NULL)`,
            [companyId, appNo, i + 1, step.approverId, step.approvalType],
          );
        }
      }

      if (hasApprover && refNo && refModule) {
        await this.updateLinkedModuleStatus(qr, companyId, refModule as string, refNo as string, appNo!, DocStatus.IN_PROGRESS, operator);
      }

      await qr.commitTransaction();

      const saved = await this.dataSource.query(
        `SELECT * FROM approval WHERE company_id = $1 AND id = $2`,
        [companyId, appNo],
      );
      return saved[0];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async getSentApprovals(companyId: string, userId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT * FROM approval WHERE company_id = $1 AND drafter_id = $2 AND delete_yn = 'N' ORDER BY id DESC`,
      [companyId, userId],
    );
  }

  async getPendingApprovals(companyId: string, userId: string): Promise<any[]> {
    const mySteps = await this.dataSource.query(
      `SELECT approval_id, step_no FROM approval_step 
       WHERE company_id = $1 AND approver_id = $2 
         AND approval_result IS NULL
         AND (approval_type = '${ApprovalStepType.APPROVAL}' OR approval_type = '${ApprovalStepType.AGREEMENT}')`,
      [companyId, userId],
    );

    const pendingApprovals: any[] = [];
    for (const step of mySteps) {
      const isCurrent = await this.isCurrentTurn(companyId, step.approval_id, userId);
      if (isCurrent) {
        const rows = await this.dataSource.query(
          `SELECT * FROM approval WHERE company_id = $1 AND id = $2 AND status = '${DocStatus.IN_PROGRESS}' AND delete_yn = 'N'`,
          [companyId, step.approval_id],
        );
        if (rows.length > 0) {
          pendingApprovals.push(rows[0]);
        }
      }
    }

    return pendingApprovals;
  }

  async getReferencedApprovals(companyId: string, userId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT a.* FROM approval a
       JOIN approval_step s ON a.company_id = s.company_id AND a.id = s.approval_id
       WHERE a.company_id = $1 AND s.approver_id = $2 AND s.approval_type = '${ApprovalStepType.REFERENCE}' AND a.delete_yn = 'N'
       ORDER BY a.id DESC`,
      [companyId, userId],
    );
  }

  async getProcessedApprovals(companyId: string, userId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT DISTINCT a.* FROM approval a
       JOIN approval_step s ON a.company_id = s.company_id AND a.id = s.approval_id
       WHERE a.company_id = $1 
         AND s.approver_id = $2 
         AND s.approval_result IS NOT NULL
         AND (s.approval_type = '${ApprovalStepType.APPROVAL}' OR s.approval_type = '${ApprovalStepType.AGREEMENT}')
         AND a.delete_yn = 'N'
       ORDER BY a.id DESC`,
      [companyId, userId],
    );
  }

  async getApprovalDetails(companyId: string, id: string): Promise<ApprovalDetailResponse> {
    const rows = await this.dataSource.query(
      `SELECT * FROM approval WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
      [companyId, id],
    );
    if (!rows.length) {
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    }

    const steps = await this.dataSource.query(
      `SELECT 
        step_no as "stepNo",
        approver_id as "approverId",
        approval_type as "approvalType",
        approval_result as "approvalResult",
        action_at as "actionAt",
        comments
      FROM approval_step 
      WHERE company_id = $1 AND approval_id = $2 
      ORDER BY step_no ASC`,
      [companyId, id],
    );

    return {
      approval: rows[0],
      steps,
    };
  }

  async processApprovalAction(companyId: string, id: string, request: ApprovalActionRequest, approverId: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const approvals = await qr.query(
        `SELECT * FROM approval WHERE company_id = $1 AND id = $2 AND delete_yn = 'N' FOR UPDATE`,
        [companyId, id],
      );
      if (!approvals.length) {
        throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
      }
      const approval = approvals[0];
      if (approval.status !== DocStatus.IN_PROGRESS) {
        throw new BadRequestException('이미 종료된 결재 문서입니다.');
      }

      const steps = await qr.query(
        `SELECT * FROM approval_step WHERE company_id = $1 AND approval_id = $2 ORDER BY step_no ASC`,
        [companyId, id],
      );

      const currentStep = steps.find((s: any) => (s.approval_type === ApprovalStepType.APPROVAL || s.approval_type === ApprovalStepType.AGREEMENT) && s.approval_result === null);
      if (!currentStep) {
        throw new BadRequestException('결재 대기 중인 단계가 없습니다.');
      }
      if (currentStep.approver_id !== approverId) {
        throw new BadRequestException('결재할 수 있는 권한이 없거나 대기 중이 아닙니다.');
      }

      const resultValue = request.action === ApprovalAction.APPROVE ? ApprovalResult.APPROVED : ApprovalResult.REJECTED;
      await qr.query(
        `UPDATE approval_step 
         SET approval_result = $4, action_at = NOW(), comments = $5
         WHERE company_id = $1 AND approval_id = $2 AND step_no = $3`,
        [companyId, id, currentStep.step_no, resultValue, request.comments ?? null],
      );

      if (request.action === ApprovalAction.APPROVE) {
        const remainingSteps = steps.filter(
          (s: any) =>
            (s.approval_type === ApprovalStepType.APPROVAL || s.approval_type === ApprovalStepType.AGREEMENT) &&
            s.step_no !== currentStep.step_no &&
            s.approval_result === null
        );

        if (remainingSteps.length === 0) {
          await qr.query(
            `UPDATE approval SET status = '${DocStatus.CONFIRMED}', updated_by = $3 WHERE company_id = $1 AND id = $2`,
            [companyId, id, approverId],
          );
          await this.propagateFinalConfirmation(qr, companyId, id, approverId);
        }
      } else {
        await qr.query(
          `UPDATE approval SET status = '${DocStatus.REJECTED}', updated_by = $3 WHERE company_id = $1 AND id = $2`,
          [companyId, id, approverId],
        );
        await this.propagateRejection(qr, companyId, id, approverId);
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async updateLinkedModuleStatus(qr: any, companyId: string, refModule: string, refNo: string, approvalId: string, status: string, operator: string) {
    const mod = refModule.toUpperCase();
    if (mod === AppModule.PM) {
      await qr.query(
        `UPDATE pm_record SET approval_id = $3, status = $4, updated_by = $5
         WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
        [companyId, refNo, approvalId, status, operator],
      );
    } else if (mod === AppModule.WO) {
      await qr.query(
        `UPDATE work_order SET approval_id = $3, status = $4, updated_by = $5
         WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
        [companyId, refNo, approvalId, status, operator],
      );
    } else if (mod === AppModule.WP) {
      await qr.query(
        `UPDATE work_permit SET approval_id = $3, status = $4, updated_by = $5
         WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
        [companyId, refNo, approvalId, status, operator],
      );
    }
  }

  private async propagateFinalConfirmation(qr: any, companyId: string, approvalId: string, operator: string) {
    const pms = await qr.query(`SELECT * FROM pm_record WHERE company_id = $1 AND approval_id = $2`, [companyId, approvalId]);
    for (const pm of pms) {
      await qr.query(`UPDATE pm_record SET status = '${DocStatus.CONFIRMED}', updated_by = $3 WHERE company_id = $1 AND id = $2`, [companyId, pm.id, operator]);
      if (pm.step_stage === 'R') {
        await this.updateCheckCycleSchedule(qr, companyId, pm, operator);
      }
    }

    await qr.query(`UPDATE work_order SET status = '${DocStatus.CONFIRMED}', updated_by = $3 WHERE company_id = $1 AND approval_id = $2`, [companyId, approvalId, operator]);
    await qr.query(`UPDATE work_permit SET status = '${DocStatus.CONFIRMED}', updated_by = $3 WHERE company_id = $1 AND approval_id = $2`, [companyId, approvalId, operator]);
  }

  private async propagateRejection(qr: any, companyId: string, approvalId: string, operator: string) {
    await qr.query(`UPDATE pm_record SET status = '${DocStatus.REJECTED}', updated_by = $3 WHERE company_id = $1 AND approval_id = $2`, [companyId, approvalId, operator]);
    await qr.query(`UPDATE work_order SET status = '${DocStatus.REJECTED}', updated_by = $3 WHERE company_id = $1 AND approval_id = $2`, [companyId, approvalId, operator]);
    await qr.query(`UPDATE work_permit SET status = '${DocStatus.REJECTED}', updated_by = $3 WHERE company_id = $1 AND approval_id = $2`, [companyId, approvalId, operator]);
  }

  private async updateCheckCycleSchedule(qr: any, companyId: string, pm: any, operator: string) {
    if (pm.ref_no) {
      const confirmedResults = await qr.query(
        `SELECT id FROM pm_record
         WHERE company_id = $1
           AND plant_id = $2
           AND step_stage = 'R'
           AND ref_module = 'PM'
           AND ref_no = $3
           AND status IN ($4, $5)
           AND id <> $6
           AND delete_yn = 'N'`,
        [companyId, pm.plant_id, pm.ref_no, DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED, pm.id],
      );
      if (confirmedResults.length > 0) {
        throw new BadRequestException('이미 확정된 예방점검 실적이 있는 계획입니다.');
      }
    }

    const cycles = await qr.query(
      `SELECT * FROM equipment_check_cycle 
       WHERE company_id = $1 AND plant_id = $2 AND equipment_id = $3 AND check_type_code = $4 AND delete_yn = 'N'`,
      [companyId, pm.plant_id, pm.equipment_id, pm.check_type_code],
    );

    if (cycles.length > 0) {
      const cycle = cycles[0];
      const workDate = toDateOnly(pm.work_date);
      const nextDateStr = addDateOnly(workDate, Number(cycle.cycle_val), cycle.cycle_unit);

      await qr.query(
        `UPDATE equipment_check_cycle 
         SET last_check_date = $5, next_check_date = $6, updated_by = $7
         WHERE company_id = $1 AND plant_id = $2 AND equipment_id = $3 AND check_type_code = $4`,
        [companyId, pm.plant_id, pm.equipment_id, pm.check_type_code, workDate, nextDateStr, operator],
      );
    }
  }

  private async isCurrentTurn(companyId: string, approvalId: string, userId: string): Promise<boolean> {
    const steps = await this.dataSource.query(
      `SELECT * FROM approval_step 
       WHERE company_id = $1 AND approval_id = $2 
       ORDER BY step_no ASC`,
      [companyId, approvalId],
    );
    const activeStep = steps.find((s: any) => (s.approval_type === ApprovalStepType.APPROVAL || s.approval_type === ApprovalStepType.AGREEMENT) && s.approval_result === null);
    return activeStep ? activeStep.approver_id === userId : false;
  }
}
