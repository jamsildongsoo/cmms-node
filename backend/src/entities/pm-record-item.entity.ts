import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('pm_record_item')
export class PmRecordItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'pm_record_id', length: 50 })
  pmRecordId!: string;

  @PrimaryColumn({ name: 'item_no', type: 'integer' })
  itemNo!: number;

  @Column({ name: 'check_name', length: 150 })
  checkName!: string;

  @Column({ type: 'varchar',  name: 'check_method', length: 250, nullable: true })
  checkMethod!: string | null;

  @Column({ name: 'min_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  minValue!: string | null;

  @Column({ name: 'max_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  maxValue!: string | null;

  @Column({ name: 'base_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  baseValue!: string | null;

  @Column({ type: 'varchar',  name: 'unit', length: 20, nullable: true })
  unit!: string | null;

  @Column({ name: 'check_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  checkValue!: string | null;
}
