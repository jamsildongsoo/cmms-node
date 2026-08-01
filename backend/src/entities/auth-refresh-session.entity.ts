import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('auth_refresh_session')
export class AuthRefreshSession {
  @PrimaryGeneratedColumn({ name: 'session_no', type: 'bigint' })
  sessionNo!: string;

  @Index()
  @Column({ name: 'company_id', length: 50 })
  companyId!: string;

  @Index()
  @Column({ name: 'user_id', length: 50 })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'session_id', length: 100 })
  sessionId!: string;

  @Column({ name: 'token_hash', length: 128 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'ip_address', length: 100, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', length: 50 })
  createdBy!: string;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', length: 50 })
  updatedBy!: string;

  @Column({ name: 'delete_yn', length: 1, default: 'N' })
  deleteYn!: string;
}
