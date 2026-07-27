# Lightsail 운영 서버 구성

대상은 소규모 사내 운영을 위한 Ubuntu Lightsail 인스턴스입니다. API와 Web은
GHCR 이미지를 사용하고 PostgreSQL은 같은 인스턴스의 Docker에서 실행합니다.

## 1. 권장 리소스

- Linux 4GB RAM / 2 vCPU 이상
- 고정 IP
- 자동 인스턴스 스냅샷
- 첨부파일용 Object Storage 버킷

DB와 첨부파일 버킷은 외부에 공개하지 않습니다. 외부에는 SSH, HTTP, HTTPS만
필요에 따라 허용합니다.

## 2. Docker 설치

Ubuntu에서 Docker 공식 저장소를 등록하고 Docker Engine과 Compose 플러그인을
설치합니다. 설치 후 운영 계정을 `docker` 그룹에 추가하고 다시 로그인합니다.

```bash
sudo usermod -aG docker "$USER"
docker version
docker compose version
```

## 3. 배포 및 데이터 디렉터리

```bash
sudo mkdir -p /opt/cmms-node
sudo mkdir -p /var/lib/cmms/postgres
sudo chown -R "$USER":"$USER" /opt/cmms-node /var/lib/cmms
git clone https://github.com/jamsildongsoo/cmms-node.git /opt/cmms-node
cd /opt/cmms-node
cp .env.template .env
chmod 600 .env
```

`/opt/cmms-node`는 배포 설정, `/var/lib/cmms`는 영구 데이터입니다. PostgreSQL
데이터 디렉터리를 저장소 내부에 만들지 않습니다.

## 4. 운영 환경변수

다음은 구조 예시이며 실제 비밀번호와 키는 운영 서버의 `.env`에만 기록합니다.

```env
NODE_ENV=production
PORT=8080
CORS_ORIGINS=https://cmms.example.com

IMAGE_REGISTRY=ghcr.io/jamsildongsoo
IMAGE_TAG=latest
CMMS_DATA_ROOT=/var/lib/cmms

DB_HOST=db
DB_PORT=5432
DB_NAME=cmms
DB_USERNAME=cmms
DB_PASSWORD='강한-운영-비밀번호'
DB_SCHEMA=public
DB_SSL=false
DB_SYNCHRONIZE=false

JWT_SECRET='충분히-긴-임의-문자열'
JWT_EXPIRATION=1800

STORAGE_ENDPOINT=https://s3.ap-northeast-2.amazonaws.com
STORAGE_REGION=ap-northeast-2
STORAGE_FORCE_PATH_STYLE=false
STORAGE_ACCESS_KEY='...'
STORAGE_SECRET_KEY='...'
STORAGE_BUCKET=cmms-prod-files
```

`#` 등 dotenv 특수문자가 포함된 값은 반드시 따옴표로 감쌉니다.

## 5. GHCR 로그인과 기동

GHCR 패키지가 비공개이면 `read:packages` 권한 토큰으로 한 번 로그인합니다.

```bash
docker login ghcr.io
./scripts/prod.sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

`prod.sh`의 기본값 1은 다운로드 없이 로컬 이미지로 기동하고, 2번은 API/Web
이미지만 GHCR에서 내려받습니다. PostgreSQL 이미지는 인프라 담당자가
별도로 준비하며 스크립트에서 자동으로 다운로드하지 않습니다.

GitHub Actions는 `main` 브랜치 push 시 다음 이미지를 생성합니다.

```text
ghcr.io/jamsildongsoo/cmms-node-api:latest
ghcr.io/jamsildongsoo/cmms-node-web:latest
ghcr.io/jamsildongsoo/cmms-node-api:<commit-sha>
ghcr.io/jamsildongsoo/cmms-node-web:<commit-sha>
```

재현 가능한 배포가 필요하면 `IMAGE_TAG`를 커밋 SHA로 지정합니다.

## 6. 운영 DB 준비와 변경

운영에서는 `DB_SYNCHRONIZE=false`를 유지합니다. 최초 스키마와 이후 DDL은
개발 엔티티를 기준으로 검토한 SQL을 DBA 또는 운영 담당자가 직접 적용합니다.
애플리케이션에는 migration 생성·실행 명령이 없습니다.

스키마가 준비된 뒤 `prod.sh` 메뉴의 3번을 선택해 SYSTEM 계정을 최초 한 번
생성합니다. 회사코드는 `SYSTEM`, 아이디는 `system`이며 초기 비밀번호를
화면에서 입력하고 확인합니다.

```bash
./scripts/prod.sh
```

DDL 적용 전 DB 백업은 인프라 담당자가 별도 절차로 수행합니다. 애플리케이션
Compose와 `prod.sh`는 DB 덤프 생성·전송·보존 기능을 제공하지 않습니다.

## 7. 보안과 장애 복구

- PostgreSQL 5432 포트는 호스트에 publish하지 않습니다.
- Object Storage는 모두 비공개로 설정합니다.
- HTTPS 인증서를 적용합니다.
- `.env`는 저장소와 이미지에 포함하지 않습니다.
- DB 백업과 Lightsail 스냅샷은 인프라 운영 정책으로 관리합니다.
- 서버 복구 시 새 인스턴스에 소스를 배치하고 DB 덤프를 복원한 뒤 GHCR 이미지를
  기동합니다. 첨부파일은 Object Storage에 그대로 남습니다.
- 자동 스냅샷만 백업으로 간주하지 않고 정기적으로 `pg_restore` 또는 `psql` 복원
  테스트를 수행합니다.
