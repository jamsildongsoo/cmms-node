import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Department } from './department.entity';
import { Equipment } from './equipment.entity';
import { BaseEntity } from './base.entity';
import { User } from './users.entity';
import { WorkOrderItem } from './work-order-item.entity';

@Entity('work_order')
export class WorkOrder extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'id', length: 50 })
  id!: string;

  @Column({ name: 'equipment_id', length: 50 })
  equipmentId!: string;

  @Column({ name: 'title', length: 150 })
  title!: string;

  @Column({ name: 'step_stage', length: 1 })
  stepStage!: string; // P: 계획, R: 실적

  @Column({ name: 'wo_type_code', length: 50 })
  woTypeCode!: string;

  @Column({ name: 'department_id', length: 50 })
  departmentId!: string;

  @Column({ type: 'varchar',  name: 'worker_id', length: 50, nullable: true })
  workerId!: string | null;

  @Column({ name: 'work_date', type: 'date', nullable: true })
  workDate!: string | null;

  @Column({ name: 'cost', type: 'numeric', precision: 15, scale: 2, default: '0' })
  cost!: string;

  @Column({ name: 'man_hours', type: 'numeric', precision: 8, scale: 2, default: '0' })
  manHours!: string;

  @Column({ name: 'man_hours_unit', length: 10, default: 'H' })
  manHoursUnit!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;

  @Column({ type: 'varchar',  name: 'ref_no', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ type: 'varchar',  name: 'ref_module', length: 50, nullable: true })
  refModule!: string | null;

  @Column({ type: 'varchar',  name: 'approval_id', length: 50, nullable: true })
  approvalId!: string | null;

  @Column({ name: 'status', length: 1, default: 'T' })
  status!: string;

  @ManyToOne(() => Equipment, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'plant_id', referencedColumnName: 'plantId' },
    { name: 'equipment_id', referencedColumnName: 'id' },
  ])
  equipment?: Equipment;

  @ManyToOne(() => Department, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'department_id', referencedColumnName: 'id' },
  ])
  department?: Department;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'worker_id', referencedColumnName: 'id' },
  ])
  worker?: User | null;

  @OneToMany(() => WorkOrderItem, (item) => item.workOrder)
  items?: WorkOrderItem[];
}
