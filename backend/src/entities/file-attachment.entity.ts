import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/** 첨부파일 그룹 — file-storage 서비스가 raw SQL로 사용. group_no는 자동 증가(BIGSERIAL) */
@Entity('file_attachment')
export class FileAttachment extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryGeneratedColumn({ name: 'group_no', type: 'bigint' })
  groupNo!: string;

  @Column({ name: 'ref_no', type: 'varchar', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ name: 'ref_module', type: 'varchar', length: 50, nullable: true })
  refModule!: string | null;
}
