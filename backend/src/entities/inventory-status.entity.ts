import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('inventory_status')
export class InventoryStatus extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'warehouse_id', length: 50 })
  warehouseId!: string;

  @PrimaryColumn({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @Column({ name: 'qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  qty!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  amount!: string;
}
