import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('approval_step')
export class ApprovalStep {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'approval_id', length: 50 })
  approvalId!: string;

  @PrimaryColumn({ name: 'step_no', type: 'integer' })
  stepNo!: number;

  @Column({ name: 'approver_id', length: 50 })
  approverId!: string;

  @Column({ name: 'approval_type', length: 1 })
  approvalType!: string; // D: 기안, A: 결재, G: 합의, R: 참조

  @Column({ type: 'varchar',  name: 'approval_result', length: 1, nullable: true })
  approvalResult!: string | null; // null(대기)/Y(승인)/N(반려)

  @Column({ name: 'action_at', type: 'timestamptz', nullable: true })
  actionAt!: Date | string | null;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments!: string | null;
}
