import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Approval } from './approval.entity';
import { User } from './users.entity';

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
  approvalType!: string;

  @Column({ name: 'approval_result', type: 'varchar', length: 1, nullable: true })
  approvalResult!: string | null;

  @Column({ name: 'action_at', type: 'timestamptz', nullable: true })
  actionAt!: Date | null;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments!: string | null;

  @ManyToOne(() => Approval, (approval) => approval.steps, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'approval_id', referencedColumnName: 'id' },
  ])
  approval?: Approval;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'approver_id', referencedColumnName: 'id' },
  ])
  approver?: User;
}
