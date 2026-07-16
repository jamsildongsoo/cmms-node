import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('purchase_request_item')
export class PurchaseRequestItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'request_id', length: 50 })
  requestId!: string;

  @PrimaryColumn({ name: 'line_no', type: 'integer' })
  lineNo!: number;

  @Column({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @Column({ name: 'qty', type: 'numeric', precision: 15, scale: 4 })
  qty!: string;

  @Column({ type: 'varchar',  name: 'unit', length: 20, nullable: true })
  unit!: string | null;

  @Column({ name: 'received_qty', type: 'numeric', precision: 15, scale: 4, default: '0' })
  receivedQty!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;
}
