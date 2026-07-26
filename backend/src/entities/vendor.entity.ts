import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('vendor')
export class Vendor extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', name: 'biz_no', length: 50, nullable: true })
  bizNo!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contact!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manager!: string | null;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;
}
