import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { InventoryDocument } from './inventory-document.entity';

@Entity('inventory_document_item')
export class InventoryDocumentItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'document_id', length: 50 })
  documentId!: string;

  @PrimaryColumn({ name: 'item_no', type: 'integer' })
  itemNo!: number;

  @Column({ name: 'warehouse_id', length: 50 })
  warehouseId!: string;

  @Column({ name: 'inventory_id', length: 50 })
  inventoryId!: string;

  @Column({ name: 'ref_line_no', type: 'varchar', length: 20, nullable: true })
  refLineNo!: string | null;

  @Column({ name: 'tx_type_code', length: 50 })
  txTypeCode!: string;

  @Column({ name: 'tx_reason_code', length: 50, default: 'GENERAL' })
  txReasonCode!: string;

  @Column({ name: 'qty', type: 'numeric', precision: 15, scale: 4 })
  qty!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 19, scale: 4, default: '0' })
  unitPrice!: string;

  @ManyToOne(() => InventoryDocument, (document) => document.items, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'document_id', referencedColumnName: 'id' },
  ])
  document?: InventoryDocument;
}
