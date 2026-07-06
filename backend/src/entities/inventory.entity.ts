import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('inventory')
export class Inventory extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 150 })
  name!: string;

  @Column({ type: 'varchar',  name: 'inv_type_code', length: 50, nullable: true })
  invTypeCode!: string | null;

  @Column({ type: 'varchar',  name: 'department_id', length: 50, nullable: true })
  departmentId!: string | null;

  @Column({ type: 'varchar',  length: 20, nullable: true })
  unit!: string | null;

  @Column({ type: 'varchar',  name: 'maker_name', length: 100, nullable: true })
  makerName!: string | null;

  @Column({ type: 'text', nullable: true })
  spec!: string | null;

  @Column({ type: 'varchar',  length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar',  name: 'serial_number', length: 100, nullable: true })
  serialNumber!: string | null;

  @Column({ name: 'safety_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  safetyQty!: string;

  @Column({ name: 'reorder_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  reorderQty!: string;

  @Column({ name: 'lead_time_days', type: 'integer', default: 0 })
  leadTimeDays!: number;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;
}
