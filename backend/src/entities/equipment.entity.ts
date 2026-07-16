import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('equipment')
export class Equipment extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar',  length: 150, nullable: true })
  location!: string | null;

  @Column({ type: 'varchar',  name: 'eq_type_code', length: 50, nullable: true })
  eqTypeCode!: string | null;

  @Column({ name: 'install_date', type: 'date', nullable: true })
  installDate!: Date | null;

  @Column({ name: 'work_permit_yn', type: 'char', length: 1, default: 'N' })
  workPermitYn!: string;

  @Column({ type: 'varchar',  name: 'maker_name', length: 100, nullable: true })
  makerName!: string | null;

  @Column({ type: 'text', nullable: true })
  spec!: string | null;

  @Column({ type: 'varchar',  length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar',  name: 'serial_number', length: 100, nullable: true })
  serialNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;

  // Transient fields (DB 컬럼에 없음, API 응답으로 채워짐)
  lastCheckDate?: string | null;
  nextCheckDate?: string | null;
}
