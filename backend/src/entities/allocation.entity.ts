import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('allocation')
export class Allocation {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'allocation_type', length: 20 })
  allocationType!: 'PO' | 'MOVE';

  @PrimaryColumn({ name: 'doc_id', length: 50 })
  docId!: string;

  @PrimaryColumn({ name: 'doc_item_no', type: 'integer' })
  docItemNo!: number;

  @PrimaryColumn({ name: 'pr_id', length: 50 })
  prId!: string;

  @PrimaryColumn({ name: 'pr_item_no', type: 'integer' })
  prItemNo!: number;

  @Column({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @Column({ name: 'allocation_qty', type: 'numeric', precision: 15, scale: 4 })
  allocationQty!: string;
}
