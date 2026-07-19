/* =========================================================================
   TypeORM 마이그레이션 — DataSource 정의 파일
     npm run migrate:gen --name=CreateUserTable
     npm run migrate:run
     npm run migrate:show
     npm run migrate:revert

   스키마 지정:
     DB_URL 의 search_path 가 target schema 를 가리켜야 합니다.
     개발: search_path=dev   /   운영: search_path=prod
   ========================================================================= */
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// --- 1) .env 로드 ---------------------------------------------------------
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const candidates = [
    path.join(__dirname, '..', '.env'),       // backend/.env
    path.join(__dirname, '..', '..', '.env'), // repo/.env
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq)] = t.slice(eq + 1);
    }
  }
  return { ...env, ...process.env } as Record<string, string>;
}

const cfg = loadEnv();

// --- 2) DB_URL 구성 -------------------------------------------------------
function buildOptions(): DataSourceOptions {
  let dbUrl = cfg.DB_URL;
  const username = cfg.DB_USERNAME;
  const password = cfg.DB_PASSWORD;
  if (!dbUrl) throw new Error('.env 에 DB_URL 이 없습니다.');

  if (dbUrl.startsWith('jdbc:')) dbUrl = dbUrl.substring(5);
  if (dbUrl.startsWith('postgresql://') && username && password && !dbUrl.includes('@')) {
    const rest = dbUrl.substring('postgresql://'.length);
    dbUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
  }

  let ssl: boolean | { rejectUnauthorized: boolean } = false;
  let schema: string | undefined;
  try {
    const u = new URL(dbUrl);
    // search_path 추출 (options=-c search_path=XXX 형태)
    const options = u.searchParams.get('options');
    if (options) {
      const match = options.match(/search_path[=%]3[D]?([^&]+)/i);
      if (match) schema = decodeURIComponent(match[1]);
    }
    if (u.searchParams.has('ssl') || u.searchParams.has('sslmode')) {
      u.searchParams.delete('ssl');
      u.searchParams.delete('sslmode');
      dbUrl = u.toString();
    }
    ssl = { rejectUnauthorized: false };
  } catch {
    if (dbUrl.includes('ssl=true') || dbUrl.includes('sslmode=require')) ssl = { rejectUnauthorized: false };
  }

  return {
    type: 'postgres',
    url: dbUrl,
    schema,
    ssl: ssl === false ? undefined : ssl,
    entities: [path.join(__dirname, '..', 'src', 'entities', '*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '..', 'migration', '*{.ts,.js}')],
    synchronize: false,
    logging: false,
  };
}

export const AppDataSource = new DataSource(buildOptions());

// --- 3) CLI 진입점 (run / show / revert) ---------------------------------
if (require.main === module) {
  void (async () => {
    const args = process.argv.slice(2);
    const cmd = args[0] || 'run';

    const ds = new DataSource(buildOptions());
    await ds.initialize();

    switch (cmd) {
      case 'run': {
        const pending = await ds.showMigrations();
        if (pending) {
          await ds.runMigrations({ transaction: 'each' });
          console.log('✅ 마이그레이션 적용 완료');
        } else {
          console.log('✅ 적용할 마이그레이션 없음');
        }
        break;
      }
      case 'show': {
        await ds.showMigrations();
        break;
      }
      case 'revert': {
        await ds.undoLastMigration();
        console.log('✅ 마지막 마이그레이션 되돌림 완료');
        break;
      }
      default:
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
    }

    await ds.destroy();
  })().catch((e) => {
    console.error('❌ 마이그레이션 오류:', e.message);
    process.exit(1);
  });
}
