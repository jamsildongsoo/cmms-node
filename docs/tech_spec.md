# CMMS 기술 사양서

## 1. 책임과 적용범위

이 문서는 현재 CMMS 구현의 기술 정본이다. 업무정책은 `docs/product_spec.md`, 공통 코드 규칙은 `docs/coding_conventions.md`, 운영 인프라는 `docs/server_spec.md`를 따른다.

```text
React/TypeScript FE
        ↓ API wrapper
NestJS API
        ↓ Guard / Tenant Context / Service transaction
TypeORM + PostgreSQL
        ├─ Object Storage 첨부파일
        └─ 외부 연계
```

## 2. 모듈·인증·권한

### 2.1 모듈

`MDM`, `EQP`, `INV`, `STK`, `PUR`, `POR`, `PM`, `WO`, `WP`, `APR`, `BRD`를 사용한다. SYSTEM은 별도 시스템 관리 API와 SystemShell을 사용한다.

### 2.2 인증

- 로그인 성공 시 access token과 refresh session을 발급한다.
- refresh session은 폐기시각을 기록한다.
- access token 만료 시 FE interceptor가 refresh 후 원 요청을 재시도한다.
- 로그아웃은 refresh session을 폐기한다.
- tenant context는 인증된 companyId, userId, roleId, scope, departmentId, homePlantId와 요청의 activePlantId를 보유한다.
- companyId는 body에서 받지 않고 인증 context에서 결정한다.

### 2.3 권한

- 모듈 접근은 `module + C/R/U/D` 권한으로 검사한다.
- ADMIN도 부여된 모듈 CRUD와 회사 격리·사업장 범위를 적용한다.
- SYSTEM은 별도 시스템 API 권한으로 검사한다.
- PLANT 범위는 homePlantId 사업장으로 제한한다.
- COMPANY 범위는 전체 또는 선택 사업장으로 제한한다.
- STK 재고 API는 모듈 권한 외에 item의 창고별 접근을 서비스에서 재검증한다.
- 업무 행위는 공통 Guard metadata로 선언한다.

## 3. API 설계

### 3.1 공통 규칙

Base path는 `/api`다.

| 목적 | 형식 |
|---|---|
| 목록 | GET /resources |
| 상세 | GET /resources/:id |
| 생성 | POST /resources |
| 수정 | PUT /resources/:id |
| 삭제 | DELETE /resources/:id |
| 상태·업무행위 | POST /resources/:id/actions/{action} |

- 식별자는 path, 검색·범위는 query, 입력은 body에 둔다.
- companyId는 body에 받지 않는다.
- plantId가 없으면 COMPANY 범위는 전체, PLANT 범위는 homePlant로 해석한다.
- 응답은 Entity 전체를 노출하지 않고 명시적 응답 타입으로 매핑한다.
- 예외는 전역 필터가 일관된 HTTP 오류 구조로 변환한다.

### 3.2 주요 API

#### 인증·시스템

- `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- `/system/companies`, `/system/users`, `/system/login-history`

#### 기준정보·마스터

- `/mdm/plants`, `/mdm/departments`, `/mdm/roles`, `/mdm/users`, `/mdm/warehouses`, `/mdm/codes`
- `/mdm/roles/:roleId/details`
- `/master/equipments`, `/master/inventories`

#### 구매

- `/procurement/requests`
- `/procurement/transfers/purchase-requests/:id`
- `/procurement/orders`
- `/procurement/orders/receivable`, `/procurement/orders/receivable/:id` (STK 권한의 구매오더 입고 대상 조회)
- `/procurement/orders/standalone`
- `PUT /procurement/orders/:id` (본인이 생성한 임시 POR의 헤더 및 독립 POR 품목 수정)
- `/procurement/orders/:id/allocations`
- `/procurement/orders/:id/actions/confirm`

#### 재고

- `GET /inventory-tx/status`
- `GET /inventory-tx/history`
- `GET /inventory-tx/documents`
- `GET /inventory-tx/documents/:id`
- `POST /inventory-tx`
- `POST /inventory-tx/close`

#### 업무·결재·게시판

- `/pm/records`, `/work-order`, `/work-permit`
- `/approval`, `/approval/:id/actions/approve`, `/approval/:id/actions/reject`
- `/board`, `/board/:id/comments`
- `/files`

## 4. DTO와 응답 계약

### 4.1 Request DTO

인증·사용자·권한, 결재·첨부파일, PM·WO·WP, PR·PO·allocation, 입고·출고·이동·조정, 상태 전이와 복합 header/items 입력은 class-validator Request DTO를 사용한다.

단순 기준정보 CRUD는 생성·수정 필드가 같으면 Save DTO를 공유할 수 있다. Entity를 Controller 입력 타입으로 사용하지 않는다.

### 4.2 Response

- 사용자·권한·세션·결재·재고·구매·복합 aggregate는 고정 응답 interface 또는 DTO를 사용한다.
- 단순 참조 조회는 Pick 또는 명시적 응답 interface를 사용할 수 있다.
- Pick은 런타임 필터가 아니므로 Service 매핑 또는 query select를 함께 사용한다.
- FE wrapper의 request/response 타입은 BE DTO와 동일한 식별자·필드 의미를 사용한다.

## 5. 데이터 모델

### 5.1 공통 식별·감사

- 회사별 업무 테이블의 기본 식별은 company_id + id다.
- header 문서번호 필드는 id다.
- item은 surrogate id 없이 company_id + 부모문서_id + item_no 복합 PK를 사용한다.
- item 순번은 DB item_no, API itemNo다.
- 업무 FK는 request_id, order_id, doc_id처럼 부모 의미를 드러낸다.
- 독립 Entity는 created_at, created_by, updated_at, updated_by, delete_yn을 사용한다.

### 5.2 주요 테이블

| 영역 | 테이블 |
|---|---|
| 조직 | company, plant, department, users, role, role_detail, warehouse |
| 기준·마스터 | code_group, code_item, equipment, equipment_check_cycle, inventory |
| 구매 | purchase_request, purchase_request_item, purchase_order, purchase_order_item, allocation |
| 재고 | inventory_status, inventory_document, inventory_document_item, inventory_history, inventory_closing, inventory_monthly_closing |
| 결재 | approval, approval_step |
| 게시판·파일 | board, board_comment, file_attachment, file_attachment_item |
| 공통 이력 | auth_refresh_session, login_history, sequence_generator |

### 5.3 자재·재고

- inventory는 회사 공통 자재 마스터다.
- inventory_status는 회사·창고·자재별 현재 수량·금액이다.
- 신규 자재와 신규 창고 생성 시 관련 status를 0으로 초기화한다.
- inventory_document는 전표 header이며 id, tx_date, ref_module, ref_no, remarks를 가진다.
- inventory_document_item은 warehouse_id, inventory_id, tx_type_code, tx_reason_code, qty, unit_price를 가진다.
- 이동은 하나의 document에 출발창고 OUT과 도착창고 IN item을 생성한다.
- inventory_history는 실제 처리 결과를 창고·자재별 signed 수량/금액으로 append-only 저장한다.

### 5.4 구매·allocation

- PR header는 요청창고 하나를 가진다.
- PO header는 통합 PO를 위해 단일 요청창고에 의존하지 않는다.
- PO item은 ordered_qty를 저장한다. 입고수량과 잔여수량은 PO 기준 재고전표 item을 조회해 계산한다.
- allocation은 PO와 PR item의 발주 배부에만 사용하며 다음 컬럼을 사용한다.

```text
allocation_type: PO
doc_id
doc_item_no
pr_id
pr_item_no
inventory_id
allocation_qty
```

- PO의 doc_id는 PO 번호, doc_item_no는 PO item 번호다.
- allocation에는 id와 completed_qty를 두지 않는다.
- PO allocation은 PO item과 PR item의 발주수량을 연결한다.

## 6. 상태·상수

BE의 공통 상수를 단일 원천으로 하고 FE는 표시 라벨과 화면 분기에 필요한 허용값만 미러링한다.

- 문서: T, P, C, S, R, X, E
- 구매 진행: O 발주, D 배송중, P 부분입고, I 입고완료, E 종료
- 재고 유형: IN, OUT, MOVE, ADJ
- 재고 사유: GENERAL, PURCHASE, RETURN, WORK_ORDER, DISPOSAL, TRANSFER, STOCKTAKING, CANCEL
- 권한: C(create), R(read), U(update), D(delete)
- 조직 범위: COMPANY, PLANT

## 7. 트랜잭션과 동시성

### 7.1 재고

- 입고·출고·이동·조정은 all-or-nothing transaction이다.
- inventory_status의 회사·창고·자재 행을 pessimistic_write로 잠근다.
- 월마감 키는 `pg_advisory_xact_lock`으로 마감과 거래의 경합을 방지하고, 재고 행은 `pessimistic_write`로 보호한다.
- 출고 부족, 마감 월 거래, 잘못된 창고·자재는 처리 전에 거부한다.

### 7.2 구매

- PO 생성·allocation 확정은 관련 header/item/allocation을 잠그고 하나의 트랜잭션으로 처리한다.
- PO 입고는 STK의 일반 입고 전표로 처리하며, `refModule=POR`, `refNo=PO 번호`, `refLineNo=PO item 번호`를 기록한다.
- 입고 잔량은 PO item의 ordered_qty와 POR 참조 재고전표 item을 조회해 계산하고, 동일 PO item의 잔량을 초과하면 거부한다.
- 창고 이동은 PUR·POR·allocation과 무관한 warehouse-to-warehouse 거래다. plant는 사용자가 선택한 창고 검색 범위일 뿐 이동의 기준이나 검증 대상이 아니다.
- 일반 이동은 allocation과 PR을 갱신하지 않는다.
- 취소는 원전표를 재사용하지 않고 반대 신규 전표를 생성한다.

## 8. FE 구조와 UX

- FE는 features/*/*.api.ts wrapper로만 API를 호출한다.
- 페이지에서 axios URI를 직접 작성하지 않는다.
- AppShell은 일반 업무, SystemShell은 SYSTEM 관리만 담당한다.
- API 오류는 공통 오류 변환과 toast 정책을 사용한다.
- 저장·상태변경 중 중복 제출을 막고 성공 후 목록·상세를 재조회한다.
- 수량은 소수점 2자리, 금액은 정수로 표시한다.
- BE numeric 4자리 값은 FE 표시 규칙에 따라 변환한다.

## 9. 운영 기술 기준

- PostgreSQL을 사용한다.
- 운영 DB_SYNCHRONIZE=false를 유지한다.
- 운영 DB DDL은 엔티티 검토 후 별도 반영한다.
- 첨부파일은 비공개 Object Storage를 사용한다.
- 운영 구성은 Web 정적 파일, NestJS API, PostgreSQL, Object Storage, Reverse Proxy로 구성한다.
