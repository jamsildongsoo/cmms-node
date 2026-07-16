import { Entity, PrimaryColumn, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('inventory_history')
export class InventoryHistory extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'warehouse_id', length: 50 })
  warehouseId!: string;

  @PrimaryColumn({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @PrimaryGeneratedColumn({ name: 'history_no', type: 'bigint' })
  historyNo!: string | number;

  @Column({ name: 'tx_type_code', length: 50 })
  txTypeCode!: string;

  @Column({ name: 'qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  qty!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 19, scale: 4, default: '0' })
  unitPrice!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  amount!: string;

  @Column({ name: 'tx_date', type: 'date' })
  txDate!: Date | string;

  @Column({ name: 'user_id', length: 50 })
  userId!: string;

  @Column({ type: 'varchar',  name: 'ref_no', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ type: 'varchar',  name: 'ref_module', length: 50, nullable: true })
  refModule!: string | null;

  @Column({ type: 'varchar',  name: 'doc_no', length: 50, nullable: true })
  docNo!: string | null;

  @Column({ type: 'varchar',  name: 'ref_line_no', length: 20, nullable: true })
  refLineNo!: string | null;
}
