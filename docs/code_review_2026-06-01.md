# cmms-node 종합 코드 리뷰 & 수정 계획

- **작성일**: 2026-06-01
- **대상**: cmms-node (cmms-agy Spring Boot → NestJS 이관)
- **스택**: NestJS 10 + TypeORM 0.3(raw SQL 위주) + pg + decimal.js + Flyway / Vite 8 + React 19 + Zustand 5 + nginx + Docker / Supabase(세션 풀러)
- **방법**: backend/frontend/infra 4개 영역 병렬 정독 + 최고 심각도 2건 직접 교차검증

---

## 0. 종합 평가

**핵심 엔진(재고 평가·결재 상태머신·테넌트 격리)은 staff 수준으로 견고**하다. 반면 **인프라 시크릿 노출, 회사/관리자 부트스트랩 미구현, 타임존, 상수 미중앙화, 검증 레이어 무력화**가 실질 리스크다.

| # | 심각도 | 영역 | 한줄 요약 |
|---|--------|------|-----------|
| C1 | 🔴 Critical | docker/env | `.env`에 실제 비밀번호·JWT·Supabase 키 평문 (git 미초기화 상태라 검증불가) |
| C2 | 🔴 Critical | 회사생성/관리자 | 회사코드 생성 + 관리자ID 부트스트랩 + `/system/*` API **백엔드 미구현**(FE는 호출 중, ✅검증완료) |
| C3 | 🔴 Critical | 타임관리 | 모든 timestamp가 naive `timestamp`, 커넥션 TZ 미고정 → 계정잠금·비번만료가 JS `Date` vs DB `NOW()` 혼용 |
| C4 | 🔴 Critical | DTO/setter | 전역 `ValidationPipe`가 approval/board 엔드포인트에서 **무력화**(interface/`any` 바디라 검증 0) |

> **검증 메모**: ① `/mdm/companies`·`/system/*` 라우트 백엔드 부재 → 확인됨(MDM은 plants/departments/roles/users/warehouses/code-groups만). ② refresh 계약은 **버그 아님** — 백엔드 `refresh()`가 `Promise<string>` bare 토큰 반환, FE `extendSession`이 `response.data`로 그대로 수신 → 일치(login만 객체라 스타일 불일치).

---

## 1. 영역별 상세 findings

### 1. Token / JWT (auth)
**잘된 점**: `JWT_SECRET` `getOrThrow` fail-fast(하드코딩 fallback 없음), `ignoreExpiration:false`, bcrypt cost 12, 로그인 실패 잠금 + 로그인 이력 감사.
- 🟠 **H — JWT_EXPIRATION 단위 지뢰**: 모듈은 **초**(기본 1800, `auth.module.ts:17`)인데 `.env`/`.env.template`엔 Spring 시절 **밀리초** `1800000`이 주석. 해제 시 토큰 ~2.4년. → `1800`으로 정정.
- 🟡 M — 진짜 refresh 토큰 아님(`auth.service.ts:169`): 만료 후 갱신 불가, 회전/폐기목록 없음. 30분 슬라이딩으로 문서화하거나 refresh 토큰 도입.
- 🟡 M — 토큰 폐기/즉시무효화 없음: `JwtStrategy.validate` DB 미조회 → 비활성 사용자도 만료(≤30분)까지 유효. 필요 시 validate에서 `use_yn` 체크.

### 2. useStore / Zustand
**잘된 점**: `persist` `partialize`로 토큰/유저/만료만 저장(`useAuthStore.ts:202`), 만료를 **절대 timestamp**(`expiresAt`)로 관리, `init()` 리하이드레이션 깔끔.
- 🟠 H — 토큰 sessionStorage 저장(`:200`): XSS 노출면. nginx CSP와 병행 완화.
- 🟠 H — `logout()`이 `activePlantId` 미초기화(`:102`): logout set에 `activePlantId:null` 추가.
- 🟡 M — 페이지들이 셀렉터 없이 전체 store 구독(`Header/WorkOrder/Approval/...` 9곳): 1초 타이머 tick마다 대형 폼 리렌더. `useAuthStore((s)=>s.user)` 셀렉터로.

### 3. 타임관리
- 🔴 **C3 — 전 컬럼 naive `timestamp` + 커넥션 TZ 미고정**: `base.entity.ts:4,10`, `user.entity.ts:42-57` 등. **계정잠금/비번만료가 JS `new Date()`(`auth.service.ts:84,114`)와 DB `NOW()`(`:294,311`) 혼용** → KST 서버·UTC DB면 9시간 오차로 오판정. → 전 컬럼 `timestamptz` + 커넥션 UTC 고정 + `NOW()` 통일.
- 🟡 L — 날짜 off-by-one: `new Date().toISOString().split('T')[0]`(UTC)이 KST 자정 근처 하루 어긋남(`procurement.service.ts:140` 등). date-fns `format`(로컬)로.

### 4. Float / Decimal (필드 ↔ DB 속성)
**머니패스는 정확**: 재고 수량/금액 전부 `numeric` + 엔티티 `string` + decimal.js(28자리, ROUND_HALF_UP) + `.toFixed(4)`. 이동평균/IN·OUT·MOVE·ADJ/월마감 precision 손실 없음.

| 엔티티 | 필드 | TS | @Column | 처리 | 판정 |
|--------|------|----|---------|----|------|
| InventoryHistory/Status/MonthlyClosing | qty/amount/unitPrice | string | numeric(15,4)/(19,4) | decimal.js | ✅ 우수 |
| PurchaseRequestItem | qty/receivedQty | string | numeric(15,4) | decimal.js | ✅ |
| **PmRecordItem** | min/max/base/checkValue | **number** | numeric(15,4) **+parseFloat transformer** | **JS float** | 🟠 H-1 |
| EquipmentCheckItem | min/max/baseValue | string | numeric(15,4) | string | ⚠ 표현 불일치 |
| **WorkOrder** | **cost(돈)**/manHours | string | numeric(15,2)/(8,2) | **raw, 미정규화** | 🟡 M-1 |

- 🟠 **H-1 — PM 측정값 parseFloat로 JS float화**(`pm-record-item.entity.ts:5`, `pm.service.ts:113-116`): 합격/불합격 밴드가 이 값 의존 → 경계값 드리프트로 판정 뒤집힘. EquipmentCheckItem은 string이라 같은 물리량 두 표현. → string·Decimal로 통일.
- 🟡 **M-1 — WorkOrder `cost`(돈)만 decimal.js 우회**(`work-order.service.ts:101,114`): 바디값 무검증 직삽입. `new Decimal(cost).toFixed(2)`로.

### 5. Vite / API
**잘된 점**: dev proxy `/api→localhost:8080`, axios `baseURL:'/api'` 상대경로(dev/prod CORS 없음), 401 시 토큰 보유 조건부 자동 로그아웃.
- 🟡 M — `VITE_API_BASE_URL` 死 설정(안 읽음), `.env.production` 없음. → `import.meta.env.VITE_API_BASE_URL ?? '/api'` 또는 삭제.
- 🟡 M — 401 무음 재발급 없음: 30분 하드 만료라 긴 폼 작성 중 유실. 만료 임박 선제 refresh 권장.

### 6. Nginx
**잘된 점**: SPA fallback `try_files`, `client_max_body_size 100M`(multer 일치), 변수 `proxy_pass`+`resolver 127.0.0.11`(stale-IP 502 방지), `X-Forwarded-Proto` map.
- 🟡 M — gzip 없음.
- 🟡 M — 정적 캐시 헤더 없음(Vite 해시파일명인데 `immutable` 미설정, `index.html`은 `no-cache`).
- 🟡 M — 보안헤더 없음(`X-Content-Type-Options`, `X-Frame-Options`/CSP, `Referrer-Policy`). CSP가 XSS 토큰탈취 완화(§2 연계).
- 🟡 L — `server_tokens off;` 미설정.

### 7. Docker
**잘된 점**: 프론트 멀티스테이지, prod compose 레지스트리 pull + `env_file`(시크릿 미베이킹) + api 미공개(`expose`만) + `depends_on service_healthy` + healthcheck + `${IMAGE_REGISTRY:?}`.
- 🔴 **C1 — `.env` 평문 시크릿**: `DB_PASSWORD`, `JWT_SECRET`, Supabase `STORAGE_*`. **git 미초기화(.git 없음)라 gitignore 검증 불가**. → 커밋 전 root `.gitignore` 확인 + **JWT·Supabase 키 즉시 회전**.
- 🟠 H — `.dockerignore` 없음: `COPY frontend/ ./`가 host `node_modules`·`dist` 복사. `frontend/.dockerignore` 추가.
- 🟠 H — nginx 컨테이너 root 실행(`USER` 없음). `nginx-unprivileged` 또는 비root.
- 🟠 H — `backend/Dockerfile` 부재: prod compose는 `cmms-node-api` 참조하나 빌드파일 없음. `.env.template`은 아직 Spring/Gradle 내용(JDBC URL, ms JWT). → api Dockerfile 추가 + env 재작성.
- 🟡 **M — `backend/scripts/migrate.ts` 파일 누락**: `backend/package.json`에 `migrate` 스크립트가 정의되어 있으나 실제 `scripts/migrate.ts` 파일이 존재하지 않아 패키지 이관 완료 후 마이그레이션 기동이 불가능합니다.


### 8. MDM / Master Data
**잘된 점**: 마스터 전부 `company_id` 선두 PK + 전 쿼리 `companyId` 필터, `CodeUtil.normalize` 대문자/trim 정규화, 소프트삭제-복원, SYSTEM 롤 보호.
- 🟡 **M-2 — 코드 참조 FK·검증 없음**: `itemTypeCode/woTypeCode/...` bare varchar, 그룹 존재 검증 없음 → orphan. `code_item`만 하드삭제(나머진 소프트). → 쓰기 시 그룹스코프 `code_item` 검증 또는 복합 FK.

### 9. 단일 상수화 (+ 한글)
**가장 약한 영역.** 유일 상수파일은 `sequence.service.ts:10`의 `AppModule` enum뿐.
- 🟠 **H-2 — 상태/코드 매직스트링 산재(백엔드)**: `'T'/'S'/'P'/'C'/'R'`, `'Y'/'N'`이 default+로직 수십 곳. `ref_module`('PUR'/'WO'/'WP'/'PM') enum 두고도 하드코딩. → `DocStatus/ProcStatus/ApprovalResult/TxType` enum 신설.
- 🟠 **H-3 — 한글 에러메시지 80곳+ 하드코딩**: `throw new BadRequestException('...')`, 결재 step 코멘트 `'상신함'`(`approval.service.ts:102`), CSV 헤더 한글. → `messages.ts`/에러코드 모듈.
- 🟠 **H(프론트) — 상태라벨·색상맵 ~6페이지 중복+불일치**: WO/PM/WP `S:'직접확정(완료)'` vs Procurement `{T:'저장',S:'확정'}` vs Approval `S/X` 누락. → `src/constants/status.ts` 단일화.
- 🟡 M(프론트) — i18n 없음, `alert/confirm` 60곳+(sonner 마운트됐는데 혼용).

### 10. plantId 없이 초기 진입
- 🟠 **H — `activePlantId` 死 코드**: multiPlant 게이팅까지 계산하나 **어떤 서비스도 소비 안 함**(grep 확인) → 실제 격리 0.
- 🟠 **H — 클라이언트 `plantId` 미검증 교차조회**: `work-order.controller.ts:32` 등이 권한검증 없이 사용 → 단일플랜트 사용자가 같은 회사 임의 plantId로 타플랜트 조회/삭제. **회사격리 견고, 플랜트격리 깨짐.**
- ✅ 모범사례: procurement `resolveActivePlantId`(`:508`)는 비multi면 `last_login_plant_id` 강제. → WO/PM/WP/master에 복제.

### 11. 회사코드 최초 생성 시 관리자 ID(Y/권한)
- 🔴 **C2 — 흐름 자체가 백엔드에 없음(✅검증완료)**: `SystemAdmin.tsx`가 `/mdm/companies`, `/system/users`, `/system/login-history`, `/system/users/.../use-yn` 호출하나 **백엔드 라우트 0개**. company/role 시드 INSERT도 없음 → 새 테넌트 생성 불가, 페이지 전부 404.
- ℹ️ `is_admin`/'Y' 플래그 스키마에 없음 — 관리자=`role_id='ADMIN'` 문자열 관습(정당하나 시드 부트스트랩에 의존).
- 🟠 H — 가장 근접한 `signUp`은 부적합: 회사 선존재 요구 + `role_id` **NULL INSERT**(`auth.service.ts:223`) → 인증되나 권한 0 유령계정.
- → 한 트랜잭션으로 company + ADMIN/MANAGER/USER 롤·matrix·공통코드 시드 + 관리자(role='ADMIN', bcrypt, `must_change_password='Y'`) 생성, SYSTEM 가드 하에.

### 12. 권한별 permission & SYSTEM 예외
**잘된 점**: `@Permission(module,action)` + `role_detail` `perm_c/r/u/d/a` **실시간 DB 조회**(롤 변경 즉시 반영), SYSTEM 롤 생성/할당 차단, 자기 롤·useYn·자기삭제 차단.
- 🟠 **H — SYSTEM 우회가 JWT 클레임만 신뢰**(`permission.guard.ts:44`): 플랫폼 테넌트 결속 없음 → 일반 company 밑 SYSTEM 롤 시드 실수 시 전 테넌트 글로벌 우회. → `companyId==='SYSTEM' && roleId==='SYSTEM'` 결속/서버재검증.
- 🟡 M — SQL 컬럼 문자열 보간 `` `perm_${action}` ``(`:66`): 현재 안전하나 footgun. 화이트리스트 매핑.
- 🟡 M — saveMode 상태 출처 느슨: status 누락 시 `A`(결재우회) 체크 무음 스킵.

### 13. 결재 단독 상태 전이
상태: `T`임시/`P`진행/`C`완료/`R`반려. current step은 컬럼 없이 "첫 null인 A/G step"으로 stateless 도출(`:246`) — 깔끔, 내부 일관.
**잘된 점**: `status!=='P'` 거부(`:237`) + 현재결재자 아니면 거부(`:250`) → 이중승인/완료후승인/순서위반 전부 차단. 재상신 `T`에서만.
- 🟠 **H — version 컬럼 없음, 동시성 안전이 부모행 `FOR UPDATE`(`:230`) 단 하나 의존**: 현재 단일락이라 레이스 없음(안전)이나 미문서화·취약. → `@VersionColumn` 또는 "모든 결재 변경 부모 `FOR UPDATE` 선행" 규칙.
- 🟡 M — 재상신 경로 락 없이 재조회(`:59` `FOR UPDATE` 빠짐).
- 🟡 M — 결재 tx에 `SET LOCAL lock_timeout`/`NOWAIT` 없음(inventory-tx는 올바름). 전역 안전망은 있으나 비일관.

### 14. 연계 결재 상태 전이
상신 시 `updateLinkedModuleStatus`(→`P`), 최종승인 `propagateFinalConfirmation`(→`C`), 반려 `propagateRejection`(→`R`). **전부 동일 `qr`(한 트랜잭션) → all-or-nothing**(올바름). "커밋 후 연계 실패" 불가.
- 🟠 **H — 구매요청(PUR)↔결재 연계 미배선**: 헬퍼가 `PM`/`WO`/`WP`만, `purchase_request` 분기 없음. → 의도/누락 제품 판단. 구동해야 하면 PUR 분기 추가.
- 🟡 M — cascade가 `approval_id`만 키잉(1:1 unique 제약 없음) → 같은 id 공유 시 둘 다 전이. `(company_id, approval_id)` unique index.
- 🟡 M — `refModule`/`refNo` 바디 무검증 수용 → `APR:C` 권한자가 임의 `refNo`를 `P`로 강제(§18 결합 시 인가 구멍). 대상 존재+합법 사전상태 검증.

### 15. 결재 상태별 안정성(멱등성)
| 상태 | 편집 | 재상신 | 이중승인 | 이중반려 |
|------|------|--------|----------|----------|
| T 임시 | 가능 | T에서만 | n/a | n/a |
| P 진행 | 경로없음 | 차단 | 차단 | 차단 |
| C 완료 | — | 차단 | 차단 | 차단 |
| R 반려 | — | 차단 | 차단 | 차단 |

**양호.** 재실행이 깨끗이 400 실패(멱등).
- 🟡 L — `P` 문서 회수/취소 경로 없음(컨트롤러에 update/delete/withdraw 부재). Spring 원본 회수 기능 누락 가능성 — 확인.

### 16. Transaction 처리
**양호.** 수동 `queryRunner`(connect→startTransaction→try/commit/catch rollback/finally release) 일관. 결재+연계 한 tx. inventory-tx 정렬 `FOR UPDATE NOWAIT`+`SET LOCAL lock_timeout`은 데드락 회피 모범. 서비스 간 잠그는 테이블 disjoint.
- 🟡 L — `getPendingApprovals` N+1(`:144`): 윈도우/`NOT EXISTS` 단일쿼리로.

### 17. Board
**양호.** 소프트삭제 + 전 읽기 `delete_yn='N'`, 전 쿼리 `company_id`(회사 게시판이라 plant 스코프 없음 — 의도 확인).
- 🟠 **H — 댓글번호 경쟁 → PK 충돌/유실**: `saveComment`가 `MAX(comment_no)+1`을 락·tx 없이 계산(`board.service.ts:101`), `comment_no`는 PK 일부. 동시 댓글 2건 같은 번호 → 실패/500. → 시퀀스/`FOR UPDATE`/`ON CONFLICT` 재시도.
- 🟡 M — 댓글 하드삭제 + 작성자 가드 없음(`:118`): `BRD:D` 보유자가 타인 댓글 삭제. `saveBoard` update도 소유자·`delete_yn` 가드 없음.

### 18. DTO / setter
- 🔴 **C4 — 전역 ValidationPipe 무력화**: `main.ts:13`에 `whitelist+forbidNonWhitelisted+transform` 설정했으나 approval은 `@Body() ApprovalSubmitRequest`(**TS interface=런타임 소거**), board는 `@Body() any`. → 검증·whitelist 전부 무동작.
- ℹ️ 역설적 방어: raw SQL 명시 컬럼리스트만 써서 `id/status/plantId/created_by/delete_yn` 보호컬럼은 바디 소싱 안 됨 → mass-assignment 우연 차단(pipe 덕 아님).
- → approval/board에 class-validator DTO 도입 → pipe 활성화 + §14-M(refModule 검증) 동시 해결. `processApprovalAction`만 `@Permission` 없음(`:61`) — 추가.

### 19. 출력 폼(print)
**양호.** `index.css:48` `@page` A4 + `@media print` 중앙화, 재사용 `PrintHeader`/`PrintSignBox`, 의존성 없는 `window.print()`, print Tailwind variant 다크→라이트.
- 🟡 M — `PrintHeader` 두고도 인라인 중복(`WorkOrder.tsx:381` 등): 회사표기 불일치. 컴포넌트 통일.
- 🟡 M — `setTimeout(()=>window.print(),100)` 레이스(`Procurement.tsx:181`): `useLayoutEffect([printPr])`로.

---

## 2. 우선순위 수정 계획 (체크리스트)

### 🔴 즉시 (Critical)
- [ ] **C1** `.env` git 격리 확인 + **JWT·DB·Supabase 키 회전**(`openssl rand -base64 32`) + `.env.template` Node 스택 재작성 *(키 회전은 Supabase 콘솔에서 직접)*
- [x] **C3** 전 timestamp `timestamptz` 전환 + 커넥션 UTC 고정 + 시간연산 `NOW()` 통일 *(계정잠금/비번만료 정확성)* ➡️ **완료 (2026-06-01 패치)**
- [x] **C4 + §14·18** approval/board class-validator DTO 도입 → ValidationPipe 활성화 + `refModule`/`refNo` 검증 동시 해결, `processApprovalAction`에 `@Permission` 추가 ➡️ **완료 (2026-06-01 패치)**
- [x] **C2 + §11** 회사생성+관리자부트스트랩+`/system/*` 엔드포인트 구현(SYSTEM 가드, 트랜잭션 시드) *(FE 의존 중)* ➡️ **완료 (2026-06-01 패치)**

### 🟠 단기 (High)
- [x] §10 plantId 검증 — procurement `resolveActivePlantId` 패턴 WO/PM/WP/master 복제, `activePlantId` 死 코드 정리 ➡️ **완료 (2026-06-01 패치)**
- [x] §12 SYSTEM 예외 플랫폼 테넌트 결속 + 서버재검증 ➡️ **완료 (2026-06-01 패치)**
- [ ] §17 게시판 댓글번호 락(시퀀스/`FOR UPDATE`/`ON CONFLICT`) + 댓글 작성자 가드 *(비관적 락 제외 협의완료)*
- [x] §4 PM measurement `parseFloat` 제거(string/Decimal 통일) + EquipmentCheckItem과 표현 통일 ➡️ **완료 (2026-06-01 패치)**
- [x] §9 상수 중앙화 — 백엔드 `DocStatus/ProcStatus/...` enum + `messages.ts`, 프론트 `src/constants/status.ts` ➡️ **완료 (2026-06-01 패치)**
- [x] §7 `frontend/.dockerignore` 추가, nginx 비root, **backend Dockerfile 작성** ➡️ **완료 (2026-06-01 패치)**
- [ ] §14 PUR↔결재 연계 배선 여부 제품 결정
- [ ] §13 결재 동시성 `@VersionColumn` 또는 락 규칙 문서화

### 🟡 중기 (Medium)
- [ ] §2 Zustand 셀렉터화(1Hz 리렌더 제거), `logout` `activePlantId` 초기화
- [ ] §6 nginx gzip + 정적 캐시 헤더 + 보안헤더(CSP)
- [ ] §4 WorkOrder `cost` decimal.js 정규화
- [ ] §8 code_item FK/검증, 하드삭제→소프트삭제
- [ ] §5 `VITE_API_BASE_URL` 연결 또는 삭제, 401 선제 refresh
- [ ] §19 PrintHeader 통일, print 레이스 `useLayoutEffect`
- [ ] §1 JWT_EXPIRATION 주석값 `1800` 정정
- [ ] §13/16 결재 tx `SET LOCAL lock_timeout`, N+1 정리

---

## 3. 잘 된 부분 (회귀 방지 — 건드리지 말 것)
- **재고 평가 엔진**: decimal.js(28자리, ROUND_HALF_UP) + 정렬 `FOR UPDATE NOWAIT`(데드락 회피) + history 기반 월마감 — 최고 리스크 영역을 정확히 처리.
- **결재 단일 트랜잭션 cascade**: 결재+연계 문서 상태 전이가 한 커밋(all-or-nothing).
- **테넌트(회사) 격리**: 전 모듈 `companyId` 일관 적용, 교차회사 누출 없음. `AsyncLocalStorage` 컨텍스트가 RxJS 파이프라인 통해 정확히 전파.
- **인증 기본기**: `getOrThrow` 시크릿, bcrypt 12, 로그인 잠금+이력 감사, 자기권한 상승/자기삭제 차단.
- **수동 트랜잭션 규율**: 전 서비스 일관된 queryRunner 패턴.

> 가장 견고: 재고 평가 + 결재 cascade. 가장 취약: 인프라 시크릿 · 타임존 · 상수 미중앙화 · 검증 레이어 무력화.

---

## 4. 패치 완료 이력 (2026-06-01 조치 완료)

본 코드 리뷰 문서 분석 후 아래 항목들에 대해 즉각적으로 패치를 수행하여 데이터 무결성 및 시스템 가용성을 복구했습니다.

1. **🔴 C3 타임존 일괄 전환**: 5개 엔티티(`base`, `user`, `work-permit`, `approval-step`, `board-comment`)의 Date 컬럼 타입을 `timestamptz`로 변경하고, [data-source.config.ts](file:///home/polknet/projects/cmms-node/backend/src/database/data-source.config.ts)에 `timezone: 'Z'` 설정을 주입해 글로벌 UTC 절대 기준 시로 정렬을 완비했습니다.
2. **🔴 C4 유효성 검증 및 인가 배선**: 결재 상신/처리 및 게시판/댓글 저장을 위한 `class-validator` DTO들을 추가하여 글로벌 `ValidationPipe`를 정상화했습니다. 또한, [approval.controller.ts](file:///home/polknet/projects/cmms-node/backend/src/modules/approval/approval.controller.ts)의 `processApprovalAction` 경로에 `@Permission('APR', 'A')` 데코레이터를 보강해 인가 구멍을 보완했습니다.
3. **🔴 C2 회사 생성 및 시스템 관리자 API 구현**: 기존 백엔드에 부재하여 404가 발생하던 테넌트 및 시스템 관리용 API를 구현했습니다. `POST /api/mdm/companies`를 신설하여 회사 등록 시 역할과 권한 매트릭스 시드, ADMIN 초기 계정 생성까지 단일 트랜잭션으로 묶어 완결성 있는 테넌트 프로비저닝을 보장합니다. 또한 `SystemModule`을 신설하여 `/api/system/users`, `/api/system/login-history` 등을 추가 배선 완료했습니다.
4. **🟠 §10 plantId 검증 완비**: `procurement`에만 적용되었던 `resolveActivePlantId` 기반 플랜트 격리 검증 패턴을 `WorkOrder`, `PreventiveMaintenance(PM)`, `WorkPermit` 및 `Master(Equipment)` 모듈의 전체 CRUD, 세부 조회, 리스트 및 CSV 다운로드 서비스와 컨트롤러에 성공적으로 전면 복제 적용하였습니다.
5. **🟠 §12 SYSTEM 예외 테넌트 결속 및 재검증**: `PermissionGuard` 내에서 `SYSTEM` 권한을 체크할 때, 단순히 JWT 토큰의 롤명 검사에서 벗어나 `companyId === 'SYSTEM'` 결속 확인 및 DB에서 실제 활성 관리자 유저인지 더블 체크하도록 보강하였으며, 추가로 [SystemController](file:///home/polknet/projects/cmms-node/backend/src/modules/system/system.controller.ts) 내 모든 관리자 API 호출 전에도 동일한 `validateSystemAdmin` 검사를 2차적으로 탑재하여 보안을 더욱 강화하였습니다.
6. **🟠 §9 상수 중앙화**: 백엔드에 `code.constants.ts` 및 `messages.ts`를 신설하여 매직스트링 및 에러메시지를 정리하였으며, 프론트엔드에도 `src/constants/status.ts`를 생성하여 화면별로 흩어져 중복된 상태 매핑 함수와 클래스명 처리를 공통 코드로 일원화하였습니다.
7. **🟠 §7 컨테이너 인프라 및 보안 강화**: `backend/Dockerfile` 을 신설하고 `frontend/.dockerignore` 를 작성해 불필요한 파일 복사를 막았습니다. 또한, Nginx 컨테이너의 비root 사용자 구동을 위해 `nginx-unprivileged` 이미지와 포트 `8080`을 도입하였으며, 이에 맞추어 `docker/nginx/prod.conf` 및 `docker-compose.prod.yml` 파일들의 포트 맵과 healthcheck를 8080에 맞춰 정합성을 맞추었습니다.
8. **🟠 §4 PM measurement parseFloat 제거**: `pm-record-item.entity.ts`의 float transformer를 걷어내고 소수점 측정값의 string/Decimal 표현 정합성을 맞추었습니다.

