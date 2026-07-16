# CMMS-NODE 서버 기동 가이드

`cmms-node`는 NestJS 백엔드, React/Vite 프론트엔드, Nginx 프록시로 구성됩니다.

---

## 1. 개발 서버 절차

### 설정값

개발 환경은 루트의 `.env` 파일을 사용합니다. `.env`는 실제 DB 접속 정보와 시크릿을 포함하므로 `.gitignore`에 의해 커밋에서 제외됩니다. 키 목록은 [.env.template](../.env.template)를 참고합니다.

```env
NODE_ENV=development
PORT=8080
DB_SYNCHRONIZE=true
DB_URL=postgresql://...
JWT_SECRET=...
```

주요 값:
- `DB_SYNCHRONIZE=true`: 개발 DB에 TypeORM 엔티티 기준으로 스키마를 자동 반영합니다.
- `DB_URL` 또는 `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD`: PostgreSQL 접속 정보입니다.
- `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`: 첨부파일 저장소를 사용할 때 필요합니다.

### 기동

```bash
./scripts/dev.sh
```

접속 주소는 `http://localhost`입니다.

최초 빈 DB에서는 백엔드 기동으로 스키마를 생성한 뒤 SYSTEM 계정을 1회 시드합니다.

```bash
cd backend
npm run seed:system
```

기본 로그인 정보는 회사코드 `SYSTEM`, 아이디 `system`, 비밀번호 `system1234`입니다.

SYSTEM으로 로그인해 회사를 생성하면 해당 회사의 기본 롤, 권한 매트릭스, 기본 공통코드가 함께 생성됩니다.

### 주의사항

- 파일명은 개발/운영 모두 `.env`로 통일하되, 서버별 값은 별도로 관리합니다.
- `DB_SYNCHRONIZE=true`는 개발 전용입니다. 운영에서는 코드상 강제로 비활성화됩니다.
- 스키마를 초기화한 경우 백엔드를 다시 기동해 테이블을 재생성한 뒤 `npm run seed:system`을 다시 실행합니다.

---

## 2. 운영 서버 절차

### 설정값

운영 환경도 파일명은 루트 `.env`를 사용합니다. [.env.template](../.env.template)는 키 목록 참고용이며, 실제 운영 값은 운영 서버에서 별도 관리합니다.

```env
NODE_ENV=production
PORT=8080
DB_SYNCHRONIZE=false
DB_URL=postgresql://...
JWT_SECRET=...
IMAGE_REGISTRY=...
IMAGE_TAG=...
```

주요 값:
- `NODE_ENV=production`: TypeORM synchronize를 강제로 비활성화합니다.
- `IMAGE_REGISTRY`, `IMAGE_TAG`: 운영 Docker 이미지 pull 대상입니다.
- `JWT_SECRET`, DB 접속 정보, Storage 접속 정보는 운영 환경별 Secret로 관리합니다.

### 기동

일반 운영 배포 또는 재기동은 seed 없이 이미지 pull 후 서비스를 기동합니다.

```bash
./scripts/prod.sh deploy
```

최초 운영 DB 구축 시에는 애플리케이션 기동 전에 스키마를 먼저 적용하고, 이후 API 이미지 one-off 컨테이너로 SYSTEM 계정을 1회 시드합니다.
운영에서는 `synchronize=false`를 유지하므로 빈 DB에 앱을 기동해도 테이블이 자동 생성되지 않습니다.

운영 스키마 적용 방식은 차후 확정합니다.
- migration 파일 기반 적용
- 확정 schema SQL 1회 적용
- 운영 전용 bootstrap job 구성

SYSTEM seed는 운영 서버에 소스를 checkout하지 않고, pull 받은 API 이미지로 실행합니다. 운영에서는 기본 비밀번호를 사용하지 말고 강한 임시 비밀번호를 지정해야 합니다.

```bash
./scripts/prod.sh seed '강한-임시-비밀번호'
```

스키마 적용이 완료된 최초 구축에서는 pull, seed, 기동을 한 번에 실행할 수도 있습니다.

```bash
./scripts/prod.sh bootstrap '강한-임시-비밀번호'
```

이후 SYSTEM으로 로그인해 실제 운영 회사를 생성합니다.

### 주의사항

- 운영 DB 스키마는 synchronize로 변경하지 않습니다. 운영 DDL은 별도 마이그레이션 절차로 적용합니다.
- 현재 운영 migration/schema SQL 적용 절차는 미확정입니다. 운영 배포 전 별도 검토가 필요합니다.
- 일반 운영 배포는 `./scripts/prod.sh deploy`만 실행합니다. 기존 운영 DB에는 seed를 반복 실행하지 않습니다.
- 운영 seed는 API 이미지 one-off 컨테이너로만 실행합니다. 운영 서버에서 `cd backend && npm run seed:system` 방식은 사용하지 않습니다.
- 운영 시크릿은 이미지에 포함하지 않습니다.
- 운영 서버의 `.env`는 실제 값 파일이므로 커밋하지 않습니다.
- SYSTEM 부트스트랩 계정은 회사 생성 이후 비밀번호를 교체하거나 접근을 엄격히 제한합니다.
