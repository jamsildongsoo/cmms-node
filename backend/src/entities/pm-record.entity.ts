import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Department } from './department.entity';
import { Equipment } from './equipment.entity';
import { User } from './users.entity';
import { PmRecordItem } from './pm-record-item.entity';
import { BaseEntity } from './base.entity';

@Entity('pm_record')
export class PmRecord extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'id', length: 50 })
  id!: string;

  @Column({ name: 'title', type: 'varchar', length: 150, nullable: true })
  title!: string | null;

  @Column({ name: 'equipment_id', length: 50 })
  equipmentId!: string;

  @Column({ name: 'department_id', length: 50 })
  departmentId!: string;

  @Column({ name: 'check_type_code', length: 50 })
  checkTypeCode!: string;

  @Column({ name: 'work_date', type: 'date', nullable: true })
  workDate!: string | null;

  @Column({ name: 'worker_id', length: 50 })
  workerId!: string;

  @Column({ name: 'judge_code', length: 20 })
  judgeCode!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ type: 'varchar',  name: 'approval_id', length: 50, nullable: true })
  approvalId!: string | null;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;

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
  worker?: User;

  @OneToMany(() => PmRecordItem, (item) => item.pmRecord)
  checkItems?: PmRecordItem[];
}
