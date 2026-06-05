import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/** 문서번호 채번기 — 채번 SequenceService가 raw SQL로 사용 */
@Entity('sequence_generator')
export class SequenceGenerator extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'ref_module', length: 50 })
  refModule!: string;

  @PrimaryColumn({ name: 'department_id', length: 50 })
  departmentId!: string;

  @PrimaryColumn({ name: 'year_month', type: 'char', length: 6 })
  yearMonth!: string;

  @Column({ name: 'last_seq', type: 'int', default: 0 })
  lastSeq!: number;
}
