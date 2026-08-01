import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

/** 회사 단위 월마감 상태. 상세 수불 집계와 별도로 마감 완료 여부를 보장한다. */
@Entity('inventory_closing')
export class InventoryClosing extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'closing_ym', type: 'char', length: 6 })
  closingYm!: string;

  @Column({ length: 10 })
  status!: string;

  @Column({ name: 'closed_at', type: 'timestamptz' })
  closedAt!: Date;

  @Column({ name: 'closed_by', length: 50 })
  closedBy!: string;
}
