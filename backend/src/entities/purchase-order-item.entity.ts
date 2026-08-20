import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('purchase_order_item')
export class PurchaseOrderItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'order_id', length: 50 })
  orderId!: string;

  @PrimaryColumn({ name: 'item_no', type: 'integer' })
  itemNo!: number;

  /** Legacy 1:1 link. PR linkage is managed by allocation. */
  @Column({ name: 'purchase_request_id', type: 'varchar', length: 50, nullable: true })
  purchaseRequestId!: string | null;

  @Column({ name: 'purchase_request_item_no', type: 'integer', nullable: true })
  purchaseRequestItemNo!: number | null;

  @Column({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @Column({ name: 'ordered_qty', type: 'numeric', precision: 15, scale: 4 })
  orderedQty!: string;

  @Column({ type: 'varchar', name: 'unit', length: 20, nullable: true })
  unit!: string | null;

  @ManyToOne(() => PurchaseOrder, (order) => order.items, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'order_id', referencedColumnName: 'id' },
  ])
  order?: PurchaseOrder;
}
