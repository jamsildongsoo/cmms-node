import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('equipment_check_cycle')
export class EquipmentCheckCycle extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'equipment_id', length: 50 })
  equipmentId!: string;

  @PrimaryColumn({ name: 'check_type_code', length: 50 })
  checkTypeCode!: string;

  @Column({ name: 'cycle_val', type: 'integer' })
  cycleVal!: number;

  @Column({ name: 'cycle_unit', length: 10 })
  cycleUnit!: string;

  @Column({ name: 'last_check_date', type: 'date', nullable: true })
  lastCheckDate!: Date | string | null;

  @Column({ name: 'next_check_date', type: 'date', nullable: true })
  nextCheckDate!: Date | string | null;
}
