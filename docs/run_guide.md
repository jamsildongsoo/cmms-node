# CMMS-NODE 서버 기동 가이드

이 문서는 `cmms-node` (NestJS 백엔드 + React 프론트엔드 + Nginx 프록시) 프로젝트를 개발 환경에서 기동하기 위한 절차를 설명합니다.

---

## 1. 개발 환경 요구사항

서버를 가동하기 전에 로컬 PC에 다음 도구들이 설치되어 있어야 합니다.

* **Node.js**: 22.x LTS 이상
* **Docker & Docker Compose**: Nginx 프록시 컨테이너 구동용

---

## 2. 초기 설정

### 2.1 환경변수 파일 설정
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 필요한 값을 입력합니다. `.env.template` 파일을 복사하여 사용할 수 있습니다.

```bash
# 템플릿 복사
cp .env.template .env
```

`.env` 파일 내부의 주요 설정 항목:
* `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`: 개발/운영 대상 PostgreSQL(Supabase) 데이터베이스 정보
* `DB_MIGRATION_ENABLED`: 개발 단계이므로 `false`로 설정합니다.
* `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`: Supabase Storage(S3 호환) 접속 정보

---

## 3. 개발용 DB 스키마 구성 (Flyway 배제)

**현재 개발 단계에서는 백엔드 구동 시 Flyway 마이그레이션이 자동으로 작동하지 않습니다.** (설계 정책 반영)

따라서 최초 1회 또는 스키마 리셋 시, 다음 순서로 직접 개발 DB의 스키마를 구성해야 합니다.

1. `backend/db/migrations/` 폴더 아래의 기존 SQL 파일 확인:
   * `V1__init.sql` (초기 테이블 스키마)
   * `V2__seed_data.sql` (초기 마스터 데이터 및 롤 정보)
   * `V3__password_policy.sql` (비밀번호 정책)
   * `V4__procurement.sql` (구매 도메인 관련 변경 스크립트)
2. Supabase Dashboard의 **SQL Editor** 또는 DB GUI 툴(DBeaver 등)을 활용해 위 SQL 파일들의 쿼리를 `V1` -> `V2` -> `V3` -> `V4` 순서대로 복사하여 실행합니다.
3. 개발 진행 중에 테이블 구조나 칼럼을 변경할 경우 SQL Editor로 수동 변경하며 개발을 진행합니다.

---

## 4. 서버 기동 절차

### 4.1 일괄 기동 (권장)
루트 디렉토리에 위치한 개발 기동 스크립트를 사용하면 **Nginx 프록시, NestJS 백엔드, React 프론트엔드**를 하나의 터미널에서 동시에 구동할 수 있습니다.

```bash
# 개발 기동 스크립트 실행
./scripts/dev.sh
```

**스크립트 내부 작동 흐름:**
1. `.env` 환경 변수 파일 로드 및 내보내기
2. `backend/node_modules` 및 `frontend/node_modules` 디렉토리 존재 여부 검사 및 미설치 시 자동 `npm install` 실행
3. Docker Compose를 통한 Nginx 리버스 프록시 컨테이너 백그라운드 기동
4. NestJS 백엔드 기동 (`npm run start:dev` 실행)
5. Vite React 프론트엔드 기동 (`npm run dev -- --host` 실행)
6. `Ctrl-C` 입력 시 구동된 모든 백그라운드 프로세스 및 Nginx 컨테이너를 안전하게 일괄 종료(cleanup)

---

### 4.2 개별 기동 (선택)
특정 컴포넌트만 개별적으로 띄우거나 테스트하고 싶을 때 사용합니다.

#### 1) Nginx 프록시 컨테이너 구동
```bash
docker compose -f docker-compose.dev.yml up -d
```

#### 2) NestJS 백엔드 구동
```bash
cd backend
npm install       # 최초 실행 시
npm run start:dev # watch 모드로 가동
```

#### 3) Vite 프론트엔드 구동
```bash
cd frontend
npm install       # 최초 실행 시
npm run dev -- --host
```

---

## 5. 접속 및 종료 정보

* **접속 주소**: [http://localhost:8082](http://localhost:8082)
  * Nginx 프록시(8082)가 자동으로 다음과 같이 라우팅을 매핑합니다.
    * `/api/*` -> NestJS 백엔드 (8080)
    * `/*` (정적 파일 및 HMR) -> Vite 프론트엔드 (5173)
* **종료 방법**: `./scripts/dev.sh`가 실행 중인 터미널에서 **`Ctrl + C`**를 누르면 백엔드, 프론트엔드 및 Nginx 프록시 도커 컨테이너가 한 번에 정지하고 정상 회수됩니다.
