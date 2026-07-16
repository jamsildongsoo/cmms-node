import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('purchase_request')
export class PurchaseRequest extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'id', length: 50 })
  id!: string;

  @Column({ name: 'plant_id', length: 50 })
  plantId!: string;

  @Column({ name: 'warehouse_id', length: 50 })
  warehouseId!: string;

  @Column({ name: 'requester_id', length: 50 })
  requesterId!: string;

  @Column({ name: 'request_date', type: 'date' })
  requestDate!: Date | string;

  @Column({ type: 'varchar',  name: 'request_type', length: 50, nullable: true })
  requestType!: string | null;

  @Column({ type: 'varchar',  name: 'vendor_id', length: 50, nullable: true })
  vendorId!: string | null;

  @Column({ name: 'order_date', type: 'date', nullable: true })
  orderDate!: Date | string | null;

  @Column({ name: 'eta_date', type: 'date', nullable: true })
  etaDate!: Date | string | null;

  @Column({ name: 'ship_start_date', type: 'date', nullable: true })
  shipStartDate!: Date | string | null;

  @Column({ name: 'status', length: 1, default: 'T' })
  status!: string;

  @Column({ type: 'varchar',  name: 'proc_status', length: 1, nullable: true })
  procStatus!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;
}
