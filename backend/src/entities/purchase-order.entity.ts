import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('purchase_order')
export class PurchaseOrder extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'id', length: 50 })
  id!: string;

  /** Legacy 1:1 link. New integrated orders use allocation rows. */
  @Column({ name: 'purchase_request_id', type: 'varchar', length: 50, nullable: true })
  purchaseRequestId!: string | null;

  @Column({ name: 'plant_id', length: 50 })
  plantId!: string;

  @Column({ name: 'warehouse_id', type: 'varchar', length: 50, nullable: true })
  warehouseId!: string | null;

  @Column({ name: 'requester_id', length: 50 })
  requesterId!: string;

  @Column({ name: 'department_id', type: 'varchar', length: 50, nullable: true })
  departmentId!: string | null;

  @Column({ name: 'order_date', type: 'date' })
  orderDate!: string;

  @Column({ name: 'eta_date', type: 'date', nullable: true })
  etaDate!: string | null;

  @Column({ name: 'ship_start_date', type: 'date', nullable: true })
  shipStartDate!: string | null;

  @Column({ name: 'status', length: 1, default: 'T' })
  status!: string;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'close_reason', type: 'text', nullable: true })
  closeReason!: string | null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.order)
  items?: PurchaseOrderItem[];
}
