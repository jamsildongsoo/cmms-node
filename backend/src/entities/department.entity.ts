import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('department')
export class Department extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar',  name: 'parent_id', length: 50, nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', name: 'warehouse_id', length: 50, nullable: true })
  warehouseId!: string | null;

  @Column({ type: 'varchar', name: 'role_id', length: 50, nullable: true })
  roleId!: string | null;

  @Column({ type: 'varchar', name: 'scope', length: 20, default: 'PLANT' })
  scope!: 'COMPANY' | 'PLANT';
}
