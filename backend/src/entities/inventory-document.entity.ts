import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { InventoryDocumentItem } from './inventory-document-item.entity';

@Entity('inventory_document')
export class InventoryDocument extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'id', length: 50 })
  id!: string;

  @Column({ name: 'tx_date', type: 'date' })
  txDate!: Date | string;

  @Column({ name: 'ref_module', type: 'varchar', length: 50, nullable: true })
  refModule!: string | null;

  @Column({ name: 'ref_no', type: 'varchar', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ name: 'reverse_document_id', type: 'varchar', length: 50, nullable: true })
  reverseDocumentId!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;

  @OneToMany(() => InventoryDocumentItem, (item) => item.document)
  items?: InventoryDocumentItem[];
}
