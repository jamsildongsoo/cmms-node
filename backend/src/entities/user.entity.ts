import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ length: 50 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'password_hash', length: 256 })
  passwordHash!: string;

  @Column({ type: 'varchar',  name: 'department_id', length: 50, nullable: true })
  departmentId!: string | null;

  @Column({ type: 'varchar',  name: 'role_id', length: 50, nullable: true })
  roleId!: string | null;

  @Column({ type: 'varchar',  length: 100, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar',  length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar',  length: 50, nullable: true })
  position!: string | null;

  @Column({ type: 'varchar',  length: 50, nullable: true })
  title!: string | null;

  @Column({ name: 'use_yn', type: 'char', length: 1, default: 'Y' })
  useYn!: string;

  @Column({ type: 'varchar',  name: 'last_login_ip', length: 50, nullable: true })
  lastLoginIp!: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'varchar',  name: 'last_login_plant_id', length: 50, nullable: true })
  lastLoginPlantId!: string | null;

  @Column({ name: 'password_changed_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  passwordChangedAt!: Date;

  @Column({ name: 'must_change_password', type: 'char', length: 1, default: 'N' })
  mustChangePassword!: string;

  @Column({ name: 'failed_login_count', type: 'integer', default: 0 })
  failedLoginCount!: number;

  @Column({ name: 'account_locked_until', type: 'timestamptz', nullable: true })
  accountLockedUntil!: Date | null;
}
