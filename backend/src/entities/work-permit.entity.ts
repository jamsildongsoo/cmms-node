import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

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

  @Column({ type: 'varchar',  name: 'work_order_id', length: 50, nullable: true })
  workOrderId!: string | null;

  @Column({ name: 'title', length: 150 })
  title!: string;

  @Column({ name: 'step_stage', length: 1 })
  stepStage!: string; // P: 계획, R: 실적

  @Column({ name: 'permit_type_codes', type: 'text' })
  permitTypeCodes!: string;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt!: Date | string | null;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt!: Date | string | null;

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
  jsonGeneral!: any;

  @Column({ name: 'json_fire', type: 'jsonb', nullable: true })
  jsonFire!: any;

  @Column({ name: 'json_confined', type: 'jsonb', nullable: true })
  jsonConfined!: any;

  @Column({ name: 'json_electric', type: 'jsonb', nullable: true })
  jsonElectric!: any;

  @Column({ name: 'json_high_place', type: 'jsonb', nullable: true })
  jsonHighPlace!: any;

  @Column({ name: 'json_excavation', type: 'jsonb', nullable: true })
  jsonExcavation!: any;

  @Column({ name: 'json_heavy_load', type: 'jsonb', nullable: true })
  jsonHeavyLoad!: any;

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
}
