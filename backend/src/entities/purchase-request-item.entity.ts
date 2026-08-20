import { Entity, PrimaryColumn, Column, JoinColumn, ManyToOne } from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_item')
export class PurchaseRequestItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'request_id', length: 50 })
  requestId!: string;

  @PrimaryColumn({ name: 'item_no', type: 'integer' })
  itemNo!: number;

  @Column({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @Column({ name: 'qty', type: 'numeric', precision: 15, scale: 4 })
  qty!: string;

  @Column({ type: 'varchar',  name: 'unit', length: 20, nullable: true })
  unit!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;

  @ManyToOne(() => PurchaseRequest, (request) => request.items, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'request_id', referencedColumnName: 'id' },
  ])
  request?: PurchaseRequest;
}
