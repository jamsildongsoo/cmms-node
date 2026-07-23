import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

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
}
