/* =========================================================================
   DataSource 설정 — PostgreSQL 공통

   DB_* 환경변수만 바꿔 로컬 Docker PostgreSQL과 운영 PostgreSQL을 같은
   애플리케이션 코드로 사용한다. DB_URL은 기존 외부 DB 연결 호환용이다.
   ========================================================================= */
import { DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/** 단일 PostgreSQL DataSource 옵션 */
export function getDataSourceOptions(config: ConfigService): DataSourceOptions {
  let dbUrl = config.get<string>('DB_URL');
  const username = config.get<string>('DB_USERNAME');
  const password = config.get<string>('DB_PASSWORD');
  const schema = config.get<string>('DB_SCHEMA', 'public');
  const sslEnabled = config.get<string>('DB_SSL', 'false') === 'true';
  let useSsl = sslEnabled;

  const options: any = {
    type: 'postgres',
    timezone: 'Z',
    entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
    // 개발 편의: DB_SYNCHRONIZE=true 면 엔티티→스키마 자동 반영.
    // 운영(NODE_ENV=production)에선 어떤 경우에도 비활성 — 운영 DDL은 직접 검토 후 적용한다.
    synchronize:
      config.get('NODE_ENV') !== 'production' &&
      config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
    logging: config.get('NODE_ENV') === 'development',
    schema,
    // DB_URL 사용 여부와 관계없이 DB_SSL 설정을 적용한다.
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
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
      const sslParam = parsedUrl.searchParams.get('ssl')?.toLowerCase();
      const sslMode = parsedUrl.searchParams.get('sslmode')?.toLowerCase();

      // URL에 SSL 설정이 있으면 DB_SSL보다 URL 설정을 우선한다.
      if (sslParam !== undefined) {
        useSsl = sslParam === 'true';
      } else if (sslMode !== undefined) {
        useSsl = ['require', 'verify-ca', 'verify-full'].includes(sslMode);
      }

      if (sslParam !== undefined || sslMode !== undefined) {
        parsedUrl.searchParams.delete('ssl');
        parsedUrl.searchParams.delete('sslmode');
        dbUrl = parsedUrl.toString();
      }
      options.ssl = useSsl ? { rejectUnauthorized: false } : false;
    } catch (e) {
      if (
        useSsl ||
        dbUrl.includes('ssl=true') ||
        dbUrl.includes('sslmode=require')
      ) {
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

