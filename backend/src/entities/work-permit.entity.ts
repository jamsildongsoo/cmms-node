import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Department } from './department.entity';
import { Equipment } from './equipment.entity';
import { BaseEntity } from './base.entity';
import { User } from './users.entity';

export interface WorkPermitCheckItem {
  question: string;
  checked: boolean;
  remarks: string;
}

@Entity('work_permit')
export class WorkPermit extends BaseEntity {
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

  @Column({ name: 'permit_type_codes', type: 'text' })
  permitTypeCodes!: string;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt!: Date | null;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt!: Date | null;

  @Column({ name: 'department_id', length: 50 })
  departmentId!: string;

  @Column({ name: 'supervisor_id', length: 50 })
  supervisorId!: string;

  @Column({ name: 'work_summary', type: 'text', nullable: true })
  workSummary!: string | null;

  @Column({ name: 'risk_factors', type: 'text', nullable: true })
  riskFactors!: string | null;

  @Column({ name: 'safety_measures', type: 'text', nullable: true })
  safetyMeasures!: string | null;

  @Column({ name: 'json_general', type: 'jsonb', nullable: true })
  jsonGeneral!: WorkPermitCheckItem[] | null;

  @Column({ name: 'json_fire', type: 'jsonb', nullable: true })
  jsonFire!: WorkPermitCheckItem[] | null;

  @Column({ name: 'json_confined', type: 'jsonb', nullable: true })
  jsonConfined!: WorkPermitCheckItem[] | null;

  @Column({ name: 'json_electric', type: 'jsonb', nullable: true })
  jsonElectric!: WorkPermitCheckItem[] | null;

  @Column({ name: 'json_high_place', type: 'jsonb', nullable: true })
  jsonHighPlace!: WorkPermitCheckItem[] | null;

  @Column({ name: 'json_excavation', type: 'jsonb', nullable: true })
  jsonExcavation!: WorkPermitCheckItem[] | null;

  @Column({ name: 'json_heavy_load', type: 'jsonb', nullable: true })
  jsonHeavyLoad!: WorkPermitCheckItem[] | null;

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
    { name: 'supervisor_id', referencedColumnName: 'id' },
  ])
  supervisor?: User;
}
