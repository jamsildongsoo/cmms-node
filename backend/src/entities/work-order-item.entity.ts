import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('work_order_item')
export class WorkOrderItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'work_order_id', length: 50 })
  workOrderId!: string;

  @PrimaryColumn({ name: 'item_no', type: 'integer' })
  itemNo!: number;

  @Column({ name: 'work_name', length: 150 })
  workName!: string;

  @Column({ type: 'varchar',  name: 'work_method', length: 250, nullable: true })
  workMethod!: string | null;

  @Column({ name: 'work_result', type: 'text', nullable: true })
  workResult!: string | null;
}
