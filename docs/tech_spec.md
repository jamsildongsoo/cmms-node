# CMMS-NODE 기술 사양서

본 문서는 FE/BE 기술 스펙을 요약합니다.
비즈니스 요구사항은 `product_spec.md`에서 관리합니다.

---

## 1. 기술 개요

*   프론트엔드는 React + TypeScript 기반입니다.
*   백엔드는 NestJS + TypeORM 기반입니다.
*   DB 스키마의 단일 소스는 백엔드 엔티티입니다.

---

## 2. 시스템 구성

### 2.1 프론트엔드

*   단일 앱 셸(`AppShell`) 구조를 사용합니다.
*   URL 라우팅 대신 `activeTab` 기반 화면 전환을 사용합니다.
*   공통 API wrapper를 통해서만 백엔드와 통신합니다.
*   로그인 후 화면 진입점은 `AppShell`, 추후 대시보드 홈은 `DashboardHome`으로 분리합니다.

### 2.2 백엔드

*   모듈 단위로 Controller / Service / Repository를 구성합니다.
*   권한 검증은 Guard + PolicyService 조합을 사용합니다.
*   상태 전이와 문서 수정 API를 분리합니다.

---

## 3. 인증과 세션

*   access token: 30분
*   refresh token: 3일
*   access token은 FE 메모리에만 유지합니다.
*   refresh token은 `HttpOnly` 쿠키와 서버측 세션 정보로 관리합니다.
*   FE는 401 발생 시 refresh 1회 재시도 후 실패하면 재로그인을 안내합니다.

---

## 4. 권한 기술 규칙

### 4.1 모듈 권한

*   모듈 권한은 `C/R/U/D/A` 5축으로 관리합니다.
*   권한 선언은 컨트롤러 메서드에 명시합니다.
*   권한 메타데이터가 없는 API는 deny-all이 원칙입니다.

구매 권한 seed와 사업장 범위는 다음 규칙을 사용합니다.

| Role | `PUR` | `POR` | 구매 사업장 범위 |
|------|------|------|------|
| `USER` | `C/R` | `N` | 자기 사업장 |
| `MANAGER` | `C/R/U/D/A` | `N` | 자기 사업장 |
| `PURCHASER` | `C/R/U/D/A` | `R/U` | 멀티사업장 |
| `ADMIN` | `C/R/U/D/A` | `R/U` | 운영 예외상 멀티사업장 |

`PUR`와 `POR`는 권한 모듈을 분리하지만, 멀티사업장 여부는 권한 코드가 아니라 구매 API의 범위 정책으로 판정합니다. 일반 사용자의 `PUR` 요청은 `users.last_login_plant_id`로 제한하고, `PURCHASER`의 `PUR/POR`만 선택 사업장 또는 전체 사업장을 허용합니다. `POR`는 별도 발주 엔티티를 생성하지 않으므로 `C/D/A`를 사용하지 않습니다.

### 4.2 예외 규칙

*   임시저장 본인 문서 예외
*   결재선 당사자성 예외
*   첨부파일은 원문서 권한 해석
*   SYSTEM 전용 API 예외
*   발전현황 API는 인증 사용자 공통 조회 예외

---

## 5. API 설계 규칙

### 5.0 전달 위치와 범위

*   `path`: 처리 대상 자원의 식별자입니다.
*   `query`: 목록 검색, 정렬, 필터, `plantId` 등 조회 범위입니다.
*   `body`: 생성·수정 데이터와 action에 필요한 업무 데이터입니다.
*   `actions`: 일반 CRUD로 표현할 수 없는 상태 변경 또는 업무 행위입니다.
*   `companyId`는 클라이언트에서 받지 않고 인증된 tenant context에서 획득합니다.
*   `companyId` 없이 전체 회사를 조회하는 API는 `SYSTEM` 권한을 요구합니다.
*   자원 식별자를 query와 body에 중복 전달하지 않습니다.

예시:

*   `GET /procurement/requests/:id`
*   `GET /procurement/requests?plantId=P001&status=T`
*   `POST /procurement/requests/:id/actions/receive`

### 5.1 기본 CRUD

*   `GET /resources`
*   `GET /resources/:id`
*   `POST /resources`
*   `PUT /resources/:id`
*   `DELETE /resources/:id`

### 5.2 상태 전이

*   `POST /resources/:id/actions/{action}`

### 5.3 구매/재고 권한 분리

| 영역 | 권한 모듈 | 설명 |
|------|------|------|
| 구매요청 | `PUR` | 요청 등록/수정/상신/직접확정 |
| 구매관리 | `POR` | 발주/배송/종료 관리 |
| 재고입고 | `STK` | 실제 재고 처리 |

### 5.4 플랜트 범위 전달

*   멀티플랜트 역할은 헤더에서 `activePlantId`를 선택할 수 있습니다.
*   API의 `plantId`가 특정 값이면 해당 사업장으로 조회합니다.
*   `plantId` 파라미터가 없으면 회사 범위 전체 조회를 기본으로 허용합니다.
*   단일 플랜트 역할은 서비스에서 `users.last_login_plant_id`로 범위를 제한할 수 있습니다.
*   멀티플랜트 사용자가 전체를 명시적으로 선택한 경우 빈 값으로 전달하고, 서버는 회사 전체 사업장을 조회합니다.
*   구매 목록(`getRequests/getOrders`)과 PM/WO/WP 목록 API는 선택된 `activePlantId`를 전달합니다. 값이 없으면 회사 전체를 조회합니다.
*   상세·저장·삭제 API는 문서의 `plantId`를 사용하고, 단일 문서 처리는 플랜트가 없으면 거부합니다.

### 5.5 Entity와 DTO 사용 기준

*   Entity는 Service와 Repository 사이의 영속성 모델로 사용합니다.
*   Controller Body는 Entity를 직접 사용해도 되지만, 서버 관리 필드(`companyId`, `createdBy`, `deleteYn` 등)를 클라이언트가 설정할 수 없도록 제한해야 합니다.
*   다음 경우에는 DTO를 우선합니다.
    *   입력 필드 검증 또는 whitelist가 필요한 경우
    *   Entity와 API 입력 구조가 다른 경우
    *   `header/items` 같은 복합 aggregate 요청인 경우
    *   날짜·금액·상태값 변환이 필요한 경우
*   응답은 Entity 전체 노출보다 응답 interface/DTO로 필요한 필드만 고정하는 것을 우선합니다.
*   단순 CRUD이고 입력 구조가 Entity와 동일하며 서버 관리 필드가 분리되어 있으면 제한된 Entity 사용을 허용합니다.

---

## 6. FE 구조 요약

### 6.1 화면 구조

*   `AppShell`이 공통 셸입니다.
*   구매 화면은 `Procurement` 공통 컴포넌트를 `request`/`management` 모드로 분기합니다.
*   재고는 `재고조회`와 `재고처리`로 구분합니다.

현재 주요 탭:
*   `mdm`
*   `equipment`
*   `inventory`
*   `stock-overview`
*   `stock-process`
*   `pm`
*   `wo`
*   `wp`
*   `procurement-request`
*   `procurement-management`
*   `approval`
*   `board`
*   `power-generation`
*   `system`

### 6.2 공통 정책

*   날짜 포맷은 사용자 표시 기준으로 일관되게 처리합니다.
*   숫자/금액은 공통 formatter를 사용합니다.
*   문서번호 클릭은 출력 진입으로 사용하는 패턴을 우선합니다.
*   구매입고는 별도 메뉴가 아니라 구매화면 또는 재고처리 화면 진입으로 처리합니다.
*   모달/버튼 노출은 권한과 문서 상태에 따라 읽기 전용 또는 편집 가능으로 분기합니다.

### 6.3 상태 관리와 인증 동작

*   인증 스토어는 `user`, `token`, `isInitialized`, `error`, `activePlantId`를 관리합니다.
*   access token은 FE 메모리에만 유지합니다.
*   앱 시작 시 `/auth/refresh`로 세션 복원을 시도합니다.
*   Axios 인터셉터는 일반 API의 401에 대해 refresh 1회 재시도 후 실패하면 로그아웃 및 재로그인 안내를 처리합니다.
*   `PURCHASER`와 `ADMIN`은 헤더에서 활성 플랜트를 전환하거나 전체 사업장을 선택할 수 있습니다. 구매요청(`PUR`)은 일반 사용자에게 자기 사업장만 허용하고, 구매관리(`POR`)는 `PURCHASER` 중심의 멀티사업장 범위를 적용합니다.

### 6.4 공통 UI 정책

*   성공/실패/안내 메시지는 toast를 사용합니다.
*   확인/취소가 필요한 작업은 공통 확인 대화상자를 사용합니다.
*   브라우저 기본 `alert/confirm/prompt`는 사용하지 않습니다.
*   목록 인쇄와 문서 인쇄는 전용 출력 컴포넌트 + `window.print()` 흐름을 사용합니다.

---

## 7. BE 구조 요약

### 7.1 엔티티와 DB

*   테이블/컬럼/PK의 단일 소스는 `backend/src/entities/*.entity.ts`입니다.
*   운영 DB는 엔티티 변경에 맞춘 SQL을 검토 후 직접 반영합니다.
*   `DB_SYNCHRONIZE=true`는 개발 환경에서만 사용합니다.
*   운영에서는 애플리케이션 migration 명령을 사용하지 않습니다.

### 7.2 스키마/데이터 설계 원칙

*   업무 데이터는 `company_id` 기준으로 테넌트 격리합니다.
*   플랜트 단위 업무 데이터는 `plant_id`를 함께 사용합니다.
*   대부분의 마스터/업무 엔티티는 `created_at`, `created_by`, `updated_at`, `updated_by`, `delete_yn` 공통 컬럼을 가집니다.
*   조회는 원칙적으로 `delete_yn='N'` 조건을 포함합니다.
*   시간은 `timestamptz`, 금액/수량은 `numeric` + Decimal 기준으로 처리합니다.

### 7.3 주요 테이블 그룹

| 그룹 | 예시 |
|------|------|
| 회사/권한 | `company`, `users`, `role`, `role_detail` |
| 기준정보 | `plant`, `department`, `warehouse`, `code_group`, `code_item` |
| 설비/자재 | `equipment`, `equipment_check_cycle`, `inventory` |
| 업무문서 | `pm_record`, `work_order`, `work_permit`, `purchase_request` |
| 재고 | `inventory_status`, `inventory_history`, `inventory_monthly_closing` |
| 결재/게시판 | `approval`, `approval_step`, `board`, `board_comment` |
| 파일/보조 | `file_attachment`, `file_attachment_item`, `login_history`, `sequence_generator` |

### 7.4 업무 테이블 주의사항

*   `purchase_request`는 요청 문서와 구매관리 상태를 함께 저장합니다.
*   `purchase_request.status`와 `proc_status`는 별도 축입니다.
*   `inventory_status`는 현재고, `inventory_history`는 수불 이력입니다.
*   재고 처리 시 동일 창고-품목은 비관적 락 기준으로 직렬화합니다.
*   출고와 이동출고는 이력에 음수 수량/금액으로 기록합니다.
*   월마감은 현재고 복사가 아니라 마감월 말일까지 이력 합산으로 계산합니다.
*   예방점검 주기는 실적 확정 시에만 갱신합니다.
*   PM/WO/WP 목록은 목록 API의 플랜트 조건을 사용하고, 상세·수정·삭제는 문서의 `plantId`와 사용자의 허용 범위를 함께 검증합니다.

---

## 8. 상수와 코드 관리

*   운영 선택지는 `code_group` / `code_item` 기준입니다.
*   시스템 분기값은 BE 상수 기준입니다.
*   FE 상수는 개발 편의용 미러만 허용합니다.
*   FE 미러는 표시, 타입 추론, 문자열 오타 방지 목적에 한정합니다.
*   FE 미러가 있더라도 업무 기준값의 단일 원천은 항상 BE 상수 파일입니다.

### 8.1 DB 코드와 정책 상수 구분

| 구분 | 관리 위치 | 설명 |
|------|------|------|
| 운영 코드 | `code_group`, `code_item` | 회사별 운영 설정값, 선택지, 분류 |
| 정책 상수 | `backend/src/common/constants/*.ts` | 상태 전이, 권한 판단, 업무 검증에 직접 사용하는 값 |

DB 코드 예시:
*   `EQ_TYPE`
*   `INV_TYPE`
*   `PM_TYPE`
*   `WO_TYPE`
*   `WP_TYPE`
*   `BOARD_TYPE`
*   `PR_TYPE`

정책 상수 예시:
*   모듈 코드
*   권한 액션
*   문서 상태
*   구매 진행상태
*   재고 거래유형/사유
*   결재 단계/결과/액션

### 8.2 백엔드 상수화 대상

| 분류 | 파일 | 주요 내용 |
|------|------|------|
| 모듈 코드 | `module.constants.ts` | `MDM`, `EQP`, `INV`, `STK`, `POR`, `PM`, `WO`, `WP`, `APR`, `BRD`, `PUR` |
| 권한 액션 | `permission.constants.ts` | `C`, `R`, `U`, `D`, `A`, 권한 컬럼 매핑 |
| 문서/구매/재고 상태 | `status.constants.ts` | `DocStatus`, `ProcStatus`, `TxType`, `TxReason`, `PmJudge`, `MoveTxType` |
| 결재 코드 | `approval.constants.ts` | `ApprovalStepType`, `ApprovalResult`, `ApprovalAction` |

### 8.3 프론트엔드 미러 상수

| 파일 | BE 원천 | FE 사용 목적 |
|------|------|------|
| `frontend/src/constants/module.ts` | `module.constants.ts` | 모듈 코드 참조, 타입 추론, 문자열 오타 방지 |
| `frontend/src/constants/status.ts` | `status.constants.ts` | 상태/사유 라벨 표시, 옵션 구성, 타입 추론 |

프론트엔드에 현재 미러된 대표 값:
*   `APP_MODULE`
*   `DOC_STATUS`
*   `PROC_STATUS_LABELS`
*   `PM_JUDGE_LABELS`
*   `TX_TYPE_LABELS`
*   `TX_REASON`
*   `TX_REASON_LABELS`
*   `TX_REASON_OPTIONS`
*   `TX_REASON_BY_TYPE`

### 8.4 현재 상수화된 업무 기준값

현재 DB 코드가 아니라 정책 상수로 관리하는 대표 값:
*   문서 상태 `T/P/C/S/R/X/E`
*   구매 진행상태 `O/D/P/I/E`
*   재고 거래유형 `IN/OUT/MOVE/ADJ`
*   재고 거래사유 `GENERAL/PURCHASE/RETURN/WORK_ORDER/DISPOSAL/TRANSFER/PLANT_TRANSFER/STOCKTAKING`
*   결재 단계 `D/A/G/R`
*   결재 결과 `Y/N`
*   결재 액션 `APPROVE/REJECT`
*   권한 액션 `C/R/U/D/A`
*   모듈 코드 `MDM/EQP/INV/STK/POR/PM/WO/WP/APR/BRD/PUR`

### 8.5 상수화 원칙

*   업무 상태 전이, 권한 판단, 재고 처리 검증에 직접 쓰는 값은 DB 코드로 대체하지 않습니다.
*   FE에서 라벨만 필요해도, 코드값 자체는 BE 기준을 따라야 합니다.
*   DB 운영 코드 변경이 우선인 영역은 FE/BE 상수로 분기하지 않습니다.
*   새 상수를 추가할 때는 “운영자가 회사별로 바꿔야 하는 값인가, 시스템 규칙인가”를 먼저 판단합니다.

---

## 9. 관련 문서

*   비즈니스 스펙: `product_spec.md`
*   인프라/서버: `server_spec.md`
*   코딩 관습: `coding_conventions.md`
