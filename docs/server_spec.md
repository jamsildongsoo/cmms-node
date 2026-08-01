# CMMS-NODE 서버 사양서

본 문서는 서버, 인프라, 배포/운영 전제를 정리합니다.
제품 기능이나 FE/BE 코드 구조 설명은 포함하지 않습니다.

---

## 1. 운영 전제

*   회사 내부 설치형 운영을 기본 전제로 합니다.
*   외부 공개 SaaS를 기본 지원 범위로 보지 않습니다.
*   소규모 동시사용자 환경을 기준으로 설계합니다.
*   권장 운영 규모는 테넌트별 동시사용자 10명 이내입니다.

---

## 2. 구성 요소

| 구성 요소 | 역할 |
|------|------|
| Web | 프론트엔드 정적 파일 서비스 |
| API | 비즈니스 로직과 인증/권한 처리 |
| PostgreSQL | 업무 데이터 저장 |
| Object Storage | 첨부파일 저장 |
| Reverse Proxy | HTTPS, `/api` 라우팅, 정적 파일 제공 |

권장 운영 자원은 Linux 4GB RAM, 2 vCPU 이상이며 고정 IP와 자동 인스턴스 스냅샷을 사용합니다.

---

## 3. 네트워크와 보안

*   DB와 Object Storage는 외부에 직접 공개하지 않습니다.
*   외부 공개 포트는 최소화합니다.
*   운영 접근은 사내망, VPN, IP 제한 등 추가 통제를 권장합니다.
*   refresh cookie는 운영 HTTPS 환경에서 `HttpOnly`, `Secure`를 사용합니다.

---

## 4. 배포 원칙

*   Docker 이미지를 기준으로 배포합니다.
*   운영 서버는 Registry에서 이미지를 pull하여 기동합니다.
*   태그는 `latest`와 커밋 `sha`를 사용합니다.
*   품질 검증은 CI 단계에서 먼저 수행합니다.

### 4.1 배포 디렉터리 원칙

*   배포 설정은 `/opt/cmms-node` 기준으로 둡니다.
*   PostgreSQL 영구 데이터는 `/var/lib/cmms/postgres` 같은 외부 디렉터리에 둡니다.
*   저장소 내부에 운영 DB 데이터를 두지 않습니다.
*   배포 설정과 영구 데이터는 서로 다른 디렉터리로 분리합니다.

### 4.2 운영 이미지 태그 원칙

*   기본 운영 태그는 `latest`입니다.
*   재현 가능한 배포가 필요하면 커밋 `sha` 태그를 사용합니다.
*   운영 서버는 이미지를 push하지 않고 pull만 수행합니다.

---

## 5. 데이터와 저장소

### 5.1 PostgreSQL

*   운영 데이터는 영구 볼륨에 저장합니다.
*   저장소 내부에 DB 데이터를 두지 않습니다.

### 5.2 첨부파일

*   첨부파일은 비공개 버킷에 저장합니다.
*   객체 저장소 접근 키는 서버 환경변수로만 관리합니다.
*   첨부파일 버킷은 애플리케이션을 통해서만 접근합니다.

---

## 6. 환경변수 범주

*   애플리케이션: `NODE_ENV`, `PORT`, `CORS_ORIGINS`
*   이미지/배포: `IMAGE_REGISTRY`, `IMAGE_TAG`
*   DB: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
*   JWT: `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION`
*   저장소: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`

실제 값 예시는 별도 운영 가이드 또는 `.env.template`에서 관리합니다.

대표 운영 변수 예시:
*   `NODE_ENV=production`
*   `PORT=8080`
*   `IMAGE_TAG=latest`
*   `DB_SYNCHRONIZE=false`
*   `JWT_EXPIRATION=1800`
*   `JWT_REFRESH_EXPIRATION=259200`
*   `JWT_REFRESH_COOKIE_SECURE=true`

### 6.1 운영 기동 절차

*   Docker Engine과 Compose 플러그인을 설치합니다.
*   운영 `.env`를 준비합니다.
*   GHCR 접근이 필요하면 `read:packages` 권한 토큰으로 로그인합니다.
*   운영 기동은 `scripts/prod.sh` 또는 `docker compose -f docker-compose.prod.yml` 기준으로 수행합니다.
*   최초 1회 `SYSTEM` 관리자 계정을 생성합니다.

```bash
mkdir -p /opt/cmms-node /var/lib/cmms/postgres
cp .env.template .env
chmod 600 .env
docker login ghcr.io
./scripts/prod.sh
```

### 6.2 개발 환경 참고

*   개발 환경은 WSL2 + Docker Compose + 호스트 프로세스 기동을 기본으로 합니다.
*   개발에서는 PostgreSQL, MinIO, Nginx를 Compose로 띄우고 API/Web은 호스트에서 실행할 수 있습니다.
*   개발 DB 자동 생성은 `DB_SYNCHRONIZE=true`일 때만 허용합니다.

### 6.3 DB 변경 원칙

*   운영에서는 `DB_SYNCHRONIZE=false`를 유지합니다.
*   최초 스키마와 이후 DDL은 엔티티 기준으로 검토한 SQL을 직접 반영합니다.
*   DDL 적용 전 DB 백업은 인프라 담당 절차로 수행합니다.
*   애플리케이션 자체는 운영 DB 덤프/복원 기능을 제공하지 않습니다.
*   현재 운영 DB는 없으며 SQL 변경 파일을 저장소에 유지하지 않습니다. 운영 DB가 생성되면 DDL 적용 방식과 이력 관리 여부를 별도로 결정합니다.
*   백업은 PostgreSQL 덤프 또는 볼륨 스냅샷으로 수행하고, 복원 테스트를 정기적으로 확인합니다.

---

## 7. 운영 점검 항목

*   DB 백업 여부
*   첨부파일 저장소 접근 상태
*   이미지 태그 버전 확인
*   HTTPS 인증서 상태
*   로그 및 디스크 사용량
*   GHCR pull 가능 여부
*   refresh cookie/도메인/HTTPS 설정 상태
*   복원 테스트 수행 여부
*   디스크 사용량과 Docker 컨테이너 상태

---

## 8. 관련 문서

*   제품 스펙: `product_spec.md`
*   기술 스펙: `tech_spec.md`
*   코딩 규칙: `coding_conventions.md`
