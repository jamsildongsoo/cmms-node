/* =========================================================================
   DataSource 설정 — Supabase(PostgreSQL) 기준

   Supabase 연결 방식 3종:
   ┌────────────────┬────────────────────────────────┬──────┬────────────┬───────────┐
   │ 방식           │ 호스트                         │ 포트 │ FOR UPDATE │ SET LOCAL │
   ├────────────────┼────────────────────────────────┼──────┼────────────┼───────────┤
   │ 트랜잭션 풀러  │ aws-0-xxx.pooler.supabase.com  │ 6543 │     ✅     │    ❌     │
   │ 세션 풀러      │ aws-0-xxx.pooler.supabase.com  │ 5432 │     ✅     │    ✅     │ ← 권장
   │ 직접 연결      │ db.xxx.supabase.co             │ 5432 │     ✅     │    ✅     │
   └────────────────┴────────────────────────────────┴──────┴────────────┴───────────┘

   NestJS는 상주 프로세스이므로 **세션 풀러(port 5432)** 가 적합합니다.
   세션 풀러는 SET LOCAL, Advisory Lock, FOR UPDATE 모두 정상 작동 →
   DataSource 이중화 없이 단일 연결로 채번·재고 비관적 락 처리 가능.
   ========================================================================= */
import { DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/** 단일 DataSource 옵션 (Supabase 세션 풀러, port 5432) */
export function getDataSourceOptions(config: ConfigService): DataSourceOptions {
  let dbUrl = config.get<string>('DB_URL');
  const username = config.get<string>('DB_USERNAME');
  const password = config.get<string>('DB_PASSWORD');

  const options: any = {
    type: 'postgres',
    timezone: 'Z',
    entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
    // 개발 편의: DB_SYNCHRONIZE=true 면 엔티티→스키마 자동 반영.
    // 운영(NODE_ENV=production)에선 어떤 경우에도 비활성 — 운영 DDL은 Flyway가 관리(데이터 유실 방지).
    synchronize:
      config.get('NODE_ENV') !== 'production' &&
      config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
    logging: config.get('NODE_ENV') === 'development',
    extra: {
      // 세션 풀러: 연결당 하나의 PostgreSQL 서버 세션 유지
      // QueryRunner FOR UPDATE + SET LOCAL 모두 정상 동작
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 60000,
      max: 20,
      statement_timeout: 10000, // 10초 쿼리 타임아웃 (서버 파라미터)
      lock_timeout: 3000,       // 3초 락 대기 타임아웃 (FOR UPDATE 대기 시)
    },
  };

  if (dbUrl) {
    // Java JDBC URL prefix 'jdbc:' 제거
    if (dbUrl.startsWith('jdbc:')) {
      dbUrl = dbUrl.substring(5);
    }
    // username과 password가 존재하고 URL 내에 아직 사용자 정보가 명시되어 있지 않은 경우 삽입
    if (dbUrl.startsWith('postgresql://') && username && password && !dbUrl.includes('@')) {
      const rest = dbUrl.substring('postgresql://'.length);
      const encodedUser = encodeURIComponent(username);
      const encodedPass = encodeURIComponent(password);
      dbUrl = `postgresql://${encodedUser}:${encodedPass}@${rest}`;
    }

    // ssl 쿼리 매개변수가 있으면 제거하고, 명시적으로 SSL 설정을 주입하여 self-signed cert 검증 에러 우려를 해소
    try {
      const parsedUrl = new URL(dbUrl);
      if (parsedUrl.searchParams.has('ssl') || parsedUrl.searchParams.has('sslmode')) {
        parsedUrl.searchParams.delete('ssl');
        parsedUrl.searchParams.delete('sslmode');
        dbUrl = parsedUrl.toString();
      }
      options.ssl = { rejectUnauthorized: false };
    } catch (e) {
      if (dbUrl.includes('ssl=true') || dbUrl.includes('sslmode=require')) {
        options.ssl = { rejectUnauthorized: false };
      }
    }

    options.url = dbUrl;
  } else {
    options.host = config.get<string>('DB_HOST');
    options.port = config.get<number>('DB_PORT', 5432);
    options.username = username;
    options.password = password;
    options.database = config.get<string>('DB_NAME', 'postgres');
  }

  return options as DataSourceOptions;
}

