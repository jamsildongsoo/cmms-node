/* =========================================================================
   SYSTEM 부트스트랩 시드 — 빈 DB(최초 synchronize 후)에 로그인 가능한
   최상위 SYSTEM 계정을 1회 심는다. (개발 및 운영 최초 부트스트랩용)

   생성 대상:
     · company       SYSTEM            (시스템)
     · role          SYSTEM/SYSTEM     (시스템관리자, multi_plant='Y')
     · users         SYSTEM/system     (bcryptjs 해시, role_id='SYSTEM')

   이후 로그인 → 화면의 '회사 생성'(POST /api/mdm/companies, SYSTEM 권한)으로
   실제 회사를 만들면 createCompany 가 ADMIN/MANAGER/PURCHASER/USER
   롤·권한·관리자·기본 공통코드를 자동 시드한다.

   실행:  cd backend && node scripts/seed-system.js [비밀번호]
          (비밀번호 미지정 시 기본값 'system1234')
   전제:  백엔드를 한 번 기동(synchronize)해 테이블이 생성된 상태여야 함.
   재실행: ON CONFLICT DO NOTHING — 여러 번 실행해도 안전(중복 미삽입).

   접속 정보는 앱(data-source.config.ts)과 동일하게 .env 의 DB_URL 을 사용한다.
   ========================================================================= */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// --- 1) 환경변수 로드 ------------------------------------------------------
// 개발: repo 루트 .env 파일을 읽는다.
// 운영 one-off 컨테이너: docker compose env_file 로 주입된 process.env 를 사용한다.
function loadEnv() {
  const env = {};

  const candidatePaths = [
    path.join(__dirname, '..', '..', '.env'), // repo/backend/scripts -> repo/.env
    path.join(__dirname, '..', '.env'),       // /app/scripts -> /app/.env
  ];

  for (const envPath of candidatePaths) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }

  return { ...env, ...process.env };
}

// --- 2) data-source.config 와 동일한 접속 문자열 구성 -----------------------
function buildConnection(env) {
  let dbUrl = env.DB_URL;
  const username = env.DB_USERNAME;
  const password = env.DB_PASSWORD;
  if (!dbUrl) throw new Error('.env 에 DB_URL 이 없습니다.');

  if (dbUrl.startsWith('jdbc:')) dbUrl = dbUrl.substring(5);
  if (dbUrl.startsWith('postgresql://') && username && password && !dbUrl.includes('@')) {
    const rest = dbUrl.substring('postgresql://'.length);
    dbUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
  }
  let ssl = false;
  try {
    const u = new URL(dbUrl);
    if (u.searchParams.has('ssl') || u.searchParams.has('sslmode')) {
      u.searchParams.delete('ssl');
      u.searchParams.delete('sslmode');
      dbUrl = u.toString();
    }
    ssl = { rejectUnauthorized: false };
  } catch {
    if (dbUrl.includes('ssl=true') || dbUrl.includes('sslmode=require')) {
      ssl = { rejectUnauthorized: false };
    }
  }
  return { connectionString: dbUrl, ssl };
}

async function main() {
  const password = process.argv[2] || 'system1234';
  const env = loadEnv();
  const client = new Client(buildConnection(env));
  await client.connect();

  // 테이블 존재 확인 (synchronize 선행 필요)
  const { rows: chk } = await client.query(
    `SELECT to_regclass('public.users') AS t`,
  );
  if (!chk[0].t) {
    await client.end();
    throw new Error(
      'users 테이블이 없습니다. 백엔드를 한 번 기동(synchronize)해 스키마를 생성한 뒤 다시 실행하세요.',
    );
  }

  const OP = 'SEED';
  await client.query('BEGIN');
  try {
    // 회사
    await client.query(
      `INSERT INTO company (id, name, business_number, email, use_yn, created_by, updated_by, delete_yn)
       VALUES ('SYSTEM', '시스템', NULL, NULL, 'Y', $1, $1, 'N')
       ON CONFLICT (id) DO NOTHING`,
      [OP],
    );

    // 롤
    await client.query(
      `INSERT INTO role (company_id, id, role_name, multi_plant, created_by, updated_by, delete_yn)
       VALUES ('SYSTEM', 'SYSTEM', '시스템관리자', 'Y', $1, $1, 'N')
       ON CONFLICT (company_id, id) DO NOTHING`,
      [OP],
    );

    // 관리자 계정 (bcryptjs 해시 — 앱과 동일 라이브러리)
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (
         company_id, id, name, password_hash, use_yn, role_id,
         must_change_password, failed_login_count, created_by, updated_by, delete_yn
       ) VALUES ('SYSTEM', 'system', '시스템관리자', $1, 'Y', 'SYSTEM', 'N', 0, $2, $2, 'N')
       ON CONFLICT (company_id, id) DO NOTHING`,
      [hash, OP],
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }

  console.log('✅ SYSTEM 부트스트랩 시드 완료 (재실행 안전 / 중복 미삽입)');
  console.log('   로그인 →  회사코드: SYSTEM   아이디: system   비밀번호: ' + password);
  console.log('   이후 화면의 [회사 생성]으로 실제 테스트 회사를 만들면');
  console.log('   ADMIN/MANAGER/PURCHASER/USER 롤·권한·관리자가 자동 생성됩니다.');
}

main().catch((e) => {
  console.error('❌ 시드 실패:', e.message);
  process.exit(1);
});
