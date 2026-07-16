import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('role')
export class Role extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ name: 'role_name', length: 100 })
  roleName!: string;

  @Column({ name: 'multi_plant', length: 1, default: 'N' })
  multiPlant!: string;
}
