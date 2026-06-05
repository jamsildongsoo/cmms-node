import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('inventory_monthly_closing')
export class InventoryMonthlyClosing extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'warehouse_id', length: 50 })
  warehouseId!: string;

  @PrimaryColumn({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @PrimaryColumn({ name: 'closing_ym', type: 'char', length: 6 })
  closingYm!: string;

  @Column({ name: 'in_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  inQty!: string;

  @Column({ name: 'in_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  inAmount!: string;

  @Column({ name: 'out_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  outQty!: string;

  @Column({ name: 'out_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  outAmount!: string;

  @Column({ name: 'move_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  moveQty!: string;

  @Column({ name: 'move_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  moveAmount!: string;

  @Column({ name: 'adj_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  adjQty!: string;

  @Column({ name: 'adj_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  adjAmount!: string;

  @Column({ name: 'closing_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  closingQty!: string;

  @Column({ name: 'closing_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  closingAmount!: string;
}
