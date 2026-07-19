import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Department } from './department.entity';
import { Equipment } from './equipment.entity';
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

  @Column({ name: 'step_stage', length: 1, default: 'R' })
  stepStage!: string; // P: 계획, R: 실적

  @Column({ name: 'cycle_from', type: 'date', nullable: true })
  cycleFrom!: Date | string | null;

  @Column({ name: 'cycle_end', type: 'date', nullable: true })
  cycleEnd!: Date | string | null;

  @Column({ name: 'close_yn', type: 'char', length: 1, default: 'N' })
  closeYn!: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: Date | string;

  @Column({ name: 'worker_id', length: 50 })
  workerId!: string;

  @Column({ name: 'judge_code', length: 20 })
  judgeCode!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ type: 'varchar',  name: 'cert_number', length: 100, nullable: true })
  certNumber!: string | null;

  @Column({ name: 'cert_expire_date', type: 'date', nullable: true })
  certExpireDate!: Date | string | null;

  @Column({ type: 'varchar',  name: 'cert_agency', length: 100, nullable: true })
  certAgency!: string | null;

  @Column({ type: 'varchar',  name: 'approval_id', length: 50, nullable: true })
  approvalId!: string | null;

  @Column({ type: 'varchar',  name: 'ref_no', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ type: 'varchar',  name: 'ref_module', length: 50, nullable: true })
  refModule!: string | null;

  @Column({ name: 'status', length: 1, default: 'T' })
  status!: string;
}
