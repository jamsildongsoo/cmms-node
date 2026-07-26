import { Entity, PrimaryColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ApprovalStep } from './approval-step.entity';
import { User } from './users.entity';

@Entity('approval')
export class Approval extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'id', length: 50 })
  id!: string;

  @Column({ name: 'title', length: 150 })
  title!: string;

  @Column({ name: 'content', type: 'jsonb', nullable: true })
  content!: Record<string, unknown> | null;

  @Column({ name: 'drafter_id', length: 50 })
  drafterId!: string;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;

  @Column({ name: 'status', length: 1, default: 'T' })
  status!: string;

  @Column({ name: 'ref_module', type: 'varchar', length: 20, nullable: true })
  refModule!: string | null;

  @Column({ name: 'ref_no', type: 'varchar', length: 50, nullable: true })
  refNo!: string | null;

  @OneToMany(() => ApprovalStep, (step) => step.approval)
  steps?: ApprovalStep[];

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'drafter_id', referencedColumnName: 'id' },
  ])
  drafter?: User;
}
