import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('code_item')
export class CodeItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'group_id', length: 50 })
  groupId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'legal_inspect_yn', type: 'char', length: 1, default: 'N' })
  legalInspectYn!: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;
}
