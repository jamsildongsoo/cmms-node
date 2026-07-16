import { Entity, PrimaryColumn, Column } from 'typeorm';

/** 로그인 이력 — auth/system 서비스가 raw SQL로 사용 (감사 컬럼 없음) */
@Entity('login_history')
export class LoginHistory {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'user_id', length: 50 })
  userId!: string;

  @PrimaryColumn({ name: 'login_at', type: 'timestamptz' })
  loginAt!: Date;

  @Column({ name: 'login_ip', type: 'varchar', length: 50, nullable: true })
  loginIp!: string | null;

  @Column({ name: 'login_result', length: 20 })
  loginResult!: string;
}
