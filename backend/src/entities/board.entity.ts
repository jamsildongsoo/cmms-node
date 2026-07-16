import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('board')
export class Board extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string | number;

  @Column({ name: 'board_type_code', length: 50 })
  boardTypeCode!: string;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'notice_yn', length: 1, default: 'N' })
  noticeYn!: string;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;

  @Column({ type: 'varchar',  name: 'ref_no', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ type: 'varchar',  name: 'ref_module', length: 50, nullable: true })
  refModule!: string | null;
}
