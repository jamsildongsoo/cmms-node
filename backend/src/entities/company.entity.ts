import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('company')
export class Company extends BaseEntity {
  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', name: 'business_number', length: 50, nullable: true })
  businessNumber!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email!: string | null;

  @Column({ name: 'use_yn', type: 'char', length: 1, default: 'Y' })
  useYn!: string;
}
