# CMMS-NODE 기동 가이드

`cmms-node`는 NestJS API, React/Vite Web, Nginx, PostgreSQL로 구성됩니다.
첨부파일은 S3 호환 Object Storage에 저장합니다.

## 개발 환경: WSL2 + Docker

개발에서는 다음 구성을 사용합니다.

```text
WSL2
├─ 호스트 프로세스: NestJS, Vite(HMR)
└─ Docker Compose
   ├─ PostgreSQL
   ├─ MinIO
   └─ Nginx
```

DB와 MinIO 데이터는 컨테이너 내부가 아니라 WSL 호스트에 저장됩니다.

```text
/var/lib/cmms-dev/postgres
/var/lib/cmms-dev/minio
```

최초 설정:

```bash
cp .env.template .env
sudo mkdir -p /var/lib/cmms-dev/postgres /var/lib/cmms-dev/minio
sudo chown -R "$USER":"$USER" /var/lib/cmms-dev
./scripts/dev.sh
```

접속 주소:

- 애플리케이션: `http://localhost`
- MinIO 관리 화면: `http://127.0.0.1:9001`

개발 DB 기본값은 `.env.template`에 정의되어 있습니다. `DB_PASSWORD`에는 `#`가
포함되므로 작은따옴표를 제거하지 않습니다. MinIO 버킷은 Compose 기동 시 자동
생성됩니다.

빈 DB는 `DB_SYNCHRONIZE=true`일 때 Backend 기동 과정에서 엔티티 기준으로
생성됩니다. 이후 SYSTEM 계정을 한 번 생성합니다.

```bash
cd backend
npm run seed:system -- init1234
```

비밀번호 변경은 최초 로그인 후 안내되며 강제로 차단하지 않습니다.

종료:

```bash
docker compose -f docker-compose.dev.yml down
```

호스트 데이터 디렉터리를 직접 삭제하지 마세요.

## 운영 환경: Lightsail + Docker

운영에서는 다음 구성을 사용합니다.

```text
Lightsail 인스턴스
└─ Docker Compose
   ├─ PostgreSQL
   ├─ GHCR API 이미지
   └─ GHCR Web 이미지

Lightsail Object Storage
└─ 첨부파일 버킷
```

PostgreSQL 데이터는 `/var/lib/cmms/postgres`에 저장합니다. 첨부파일은
인스턴스 장애와 분리하기 위해 Object Storage에 저장합니다.

운영 `.env`는 `.env.template`의 키 구조를 사용하되 다음 값을 반드시 운영용으로
변경합니다.

- `NODE_ENV=production`
- `CMMS_DATA_ROOT=/var/lib/cmms`
- 강한 `DB_PASSWORD`, `JWT_SECRET`
- Lightsail Object Storage의 `STORAGE_*`
- 허용할 실제 도메인만 지정한 `CORS_ORIGINS`
- `DB_SYNCHRONIZE=false`

운영 기동:

```bash
./scripts/prod.sh
```

30초 선택 메뉴에서 기본값 1은 로컬 이미지만 사용합니다. 2번은 GHCR의 API/Web
이미지만 다운로드한 뒤 기동합니다. 3번은 최초 SYSTEM 관리자 계정을 생성하며
회사코드 `SYSTEM`, 아이디 `system`과 비밀번호 입력 안내를 표시합니다.
PostgreSQL 등 인프라 이미지는 어느 선택에서도 다운로드하지 않으며
인프라 담당자가 수동으로 관리합니다.

운영 DB DDL은 `synchronize`나 애플리케이션 migration 명령으로 변경하지
않습니다. 검토된 SQL을 운영 DB에 직접 적용하고, 변경 직전에 DB 덤프를
인프라 담당자가 별도로 생성합니다.

## 데이터 보존 원칙

- 인스턴스 자동 스냅샷을 활성화합니다.
- PostgreSQL 백업은 인프라 담당자가 별도 절차로 관리합니다.
- 첨부파일 버킷은 비공개로 둡니다.
- 백업 주기, 보존기간 및 복원 검증은 인프라 운영 정책을 따릅니다.
- `docker compose down -v`, 데이터 경로 삭제, 무분별한 prune은 운영에서
  사용하지 않습니다.
