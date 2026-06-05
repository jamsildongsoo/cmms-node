import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('equipment_check_item')
export class EquipmentCheckItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'equipment_id', length: 50 })
  equipmentId!: string;

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

  @Column({ type: 'varchar',  length: 20, nullable: true })
  unit!: string | null;
}
