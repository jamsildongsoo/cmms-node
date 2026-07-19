# 신규 리눅스 서버 구성

대상 서버: `223.130.162.61` -네이버클라우드 기준

이 절차는 운영서버와 같은 방식으로 이미지를 pull 해서 기동하는 개발/검증 서버용입니다.
기존 서버 재배포 시에는 DB 마이그레이션, seed, synchronize를 실행하지 않습니다.
**신규 서버 최초 구축** 시에는 [6-1. DB 마이그레이션](#6-1-db-마이그레이션-신규-서버만), [6-2. Seed](#6-2-최초-1회-seed-신규-서버만)를 추가로 진행하세요.

## 0. DB Schema 구분 (Supabase PostgreSQL)

개발과 운영은 **같은 Supabase 인스턴스 내에서 schema 로 격리**됩니다.

| 환경 | `search_path` | `DB_SYNCHRONIZE` | DDL 관리 방식 |
|---|---|---|---|
| 개발 | `dev` | `true` | TypeORM synchronize (엔티티 → 자동 반영) |
| 운영 | `prod` | `false` (코드 레벨 강제) | TypeORM 마이그레이션 |

> ⚠️ 개발 `.env`의 `search_path`를 `prod`로 설정하지 마세요. `DB_SYNCHRONIZE=true`가 운영 schema 를 훼손합니다.

운영 서버 최초 구축 시에는 마이그레이션으로 스키마를 생성한 후 seed 를 실행합니다.

> 💡 `pg` 라이브러리는 URL 의 `options` 파라미터를 세션에 반영하지 않습니다. `seed-system.js`와 `migrate.ts`는 `DB_URL`에서 `search_path` 값을 직접 추출해 `SET search_path` 또는 TypeORM `schema` 옵션으로 적용합니다.

## 1. Docker 설치

root 계정으로 최초 1회만 실행합니다. Ubuntu 기준:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2. 운영 계정 생성

root로 계속 작업하지 않고 (예시)`cmms` 계정으로 배포와 운영을 수행합니다. 

```bash
sudo adduser cmms
sudo usermod -aG sudo cmms
sudo usermod -aG docker cmms
```

`adduser cmms` 실행 중 비밀번호는 아래 값으로 입력합니다.

```text
cmms123!@#A
```

그룹 권한 반영을 위해 `cmms`로 다시 로그인한 뒤 확인합니다.

```bash
docker version
docker compose version
```

이후 절차는 `cmms` 계정으로 실행합니다.

```bash
su - cmms
```

## 3. 방화벽

외부 접속은 Nginx 컨테이너의 `80` 포트만 엽니다. SSH는 운영 포트에 맞게 유지합니다.

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

## 4. 배포 파일 배치

root에서 배포 디렉터리를 만들고 소유자를 `cmms`로 지정합니다.

```bash
sudo mkdir -p /opt/cmms-node
sudo chown -R cmms:cmms /opt/cmms-node
```

이후 `cmms` 계정으로 소스를 배치합니다.

```bash
git clone https://github.com/jamsildongsoo/cmms-node.git /opt/cmms-node
cd /opt/cmms-node
```

이미 checkout 되어 있으면 최신 브랜치로 맞춘 뒤 진행합니다. 서버는 소스를 빌드하지 않고 `docker-compose.prod.yml`, `scripts/prod.sh`, `.env`만 사용해 운영서버와 같은 방식으로 이미지를 pull 합니다.

> 💡 **프론트엔드 의존성**: 결재 문서의 Quill 에디터(`quill`)는 GitHub Actions 빌드 시 `npm install`로 자동 설치됩니다. 운영 이미지에는 이미 포함됩니다. 

## 5. 환경변수

루트 `.env`를 만들고 기존 DB 접속 정보를 넣습니다.

```bash
cp .env.template .env
vi .env
```

기존 DB 보호를 위해 아래 값은 반드시 유지합니다.

```env
NODE_ENV=production
PORT=8080
DB_SYNCHRONIZE=false
DB_URL=postgresql://[POOLER-HOST]:5432/postgres?sslmode=require&options=-c%20search_path%3Dprod
DB_USERNAME=postgres.[PROJECT-REF]
DB_PASSWORD=cmms123!@#A
JWT_SECRET=...
IMAGE_REGISTRY=ghcr.io/...
IMAGE_TAG=...
```

첨부파일을 사용하면 `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`도 기존 값과 맞춥니다.

`.env`는 `cmms` 계정만 읽고 쓸 수 있게 제한합니다.

```bash
chmod 600 .env
```

Docker 이미지는 GitHub Actions가 GitHub Container Registry에 등록합니다. 개발 PC에서 `main` 브랜치로 push하면 `.github/workflows/docker-images.yml`이 실행되어 아래 이미지가 생성됩니다.

```text
ghcr.io/jamsildongsoo/cmms-node-api:latest
ghcr.io/jamsildongsoo/cmms-node-web:latest
ghcr.io/jamsildongsoo/cmms-node-api:<commit-sha>
ghcr.io/jamsildongsoo/cmms-node-web:<commit-sha>
```

신규 서버의 `.env`는 보통 아래처럼 둡니다.

```env
IMAGE_REGISTRY=ghcr.io/jamsildongsoo
IMAGE_TAG=latest
```

GHCR 패키지가 private이면 서버에서 1회 로그인해야 합니다. GitHub Personal Access Token은 `read:packages` 권한으로 발급합니다.

```bash
docker login ghcr.io -u jamsildongsoo
```

## 6. 기동

운영서버와 같이 레지스트리 이미지를 pull 해서 `nginx + web + api`를 올립니다.

```bash
./scripts/prod.sh deploy
```

접속 주소:

```text
http://223.130.162.61
```

## 6-1. DB 마이그레이션 (신규 서버만)

> **신규 서버에서 처음 운영 DB 를 구축할 때만 실행합니다.** 기존 서버 재배포 시에는 건너뜁니다.

`.env`의 `DB_URL`에 `search_path=prod`가 설정되어 있어야 합니다. 마이그레이션은 운영 schema(`prod`)에 테이블을 생성합니다.

```bash
./scripts/prod.sh migrate
```

개발 서버에서 엔티티가 변경되면 아래 순서로 마이그레이션 파일을 생성·커밋합니다.

```bash
cd backend
npm run migrate:gen --name=AddEquipmentStatus
# → migration/1721234567890-AddEquipmentStatus.ts 자동 생성 (타임스탬프 접두사 붙음)
git add migration/
git commit -m "chore: add migration AddEquipmentStatus"
```

생성된 마이그레이션 파일은 Git 에 커밋되며, 운영 서버에서는 `prod.sh bootstrap` 또는 `prod.sh migrate`로 적용합니다. 파일 이름은 TypeORM 이 자동으로 관리하므로 직접 지정할 필요는 없습니다.

## 6-2. 최초 1회 Seed (신규 서버만)

> **신규 서버에서 처음 운영 DB 를 구축할 때만 실행합니다.** 기존 서버 재배포 시에는 건너뜁니다.
> **선행 조건:** 마이그레이션이 완료되어 `prod` schema 에 테이블이 존재해야 합니다.

```bash
./scripts/prod.sh seed '강한-임시-비밀번호'
```

실행 결과:

| 항목 | 값 |
|---|---|
| 회사코드 | `SYSTEM` |
| 아이디 | `system` |
| 비밀번호 | 지정한 임시 비밀번호 |

생성된 계정으로 로그인한 뒤, 화면의 **[회사 생성]** 으로 실제 테스트 회사를 만들면 `ADMIN`/`MANAGER`/`PURCHASER`/`USER` 롤·권한·관리자가 자동 생성됩니다.

Seed는 `ON CONFLICT DO NOTHING`으로 설계되어 여러 번 실행해도 안전합니다.

## 6-3. Bootstrap 한 번에 실행 (신규 서버만)

`migrate` + `seed` + `up -d`을 한 번에 처리합니다.

```bash
./scripts/prod.sh bootstrap '강한-임시-비밀번호'
```

순서: 이미지 pull → 마이그레이션 적용 → seed → 서비스 기동

## 7. 확인

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 api
docker compose -f docker-compose.prod.yml logs -f --tail=100 web
curl -I http://127.0.0.1
```

## 8. 재배포

```bash
cd /opt/cmms-node
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

또는:

```bash
./scripts/prod.sh deploy
```

엔티티 변경으로 스키마 업데이트가 필요하면 재배포 전 마이그레이션을 먼저 적용합니다.

```bash
./scripts/prod.sh migrate
```

## 9. 문제 해결

### 로그인 실패: "존재하지 않거나 사용 중지된 사용자입니다."

회사 생성 후 첫 로그인 시 이 오류가 나면 DB 에서 실제 계정 존재 여부를 확인합니다.

```sql
-- 회사 조회
SELECT id, name, use_yn, delete_yn FROM company WHERE id = 'CHOROK';

-- 사용자 조회 (회사 코드 대문자 필수)
SELECT id, name, use_yn, delete_yn, role_id
  FROM users WHERE company_id = 'CHOROK' AND id = 'chorokadmin';
```

회사만 있고 사용자가 없으면 회사 생성 중 트랜잭션이 부분 실패한 것입니다. 이 경우 seed-system.js 를 참고하여 직접 관리자를 생성하거나, 회사 생성 화면을 다시 시도합니다.

사용자 ID 오타도 흔한 원인입니다. 실제 DB 저장 값과 로그인 입력 값을 비교하세요.

```sql
-- 실제 등록된 사용자 ID 목록
SELECT id, name FROM users WHERE company_id = 'CHOROK' AND delete_yn = 'N';
```

> 💡 회사 코드(`id`)는 `createCompany`에서 **자동 대문자 변환**됩니다. `chorok` 입력 → `CHOROK` 저장.
> 로그인 시에도 회사 코드는 대문자로 변환되므로 소문자로 입력해도 됩니다.

### 마이그레이션 실패: "relation already exists"

운영 schema(`prod`)에 테이블이 이미 존재하는 경우입니다. `migrate:show`로 상태를 확인합니다.

```bash
cd backend
npm run migrate:show
```

이미 적용된 마이그레이션이면 `✅ 적용할 마이그레이션 없음`이 표시됩니다.

### seed 실패: "users 테이블이 없습니다"

마이그레이션이 선행되지 않았습니다. 먼저 `./scripts/prod.sh migrate`를 실행하세요.
