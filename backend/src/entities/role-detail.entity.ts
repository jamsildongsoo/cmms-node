import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('role_detail')
export class RoleDetail {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'role_id', length: 50 })
  roleId!: string;

  @PrimaryColumn({ name: 'module_detail', length: 100 })
  moduleDetail!: string;

  @Column({ name: 'perm_c', type: 'char', length: 1, default: 'N' })
  permC!: string;

  @Column({ name: 'perm_r', type: 'char', length: 1, default: 'N' })
  permR!: string;

  @Column({ name: 'perm_u', type: 'char', length: 1, default: 'N' })
  permU!: string;

  @Column({ name: 'perm_d', type: 'char', length: 1, default: 'N' })
  permD!: string;

  @Column({ name: 'perm_a', type: 'char', length: 1, default: 'N' })
  permA!: string;
}
