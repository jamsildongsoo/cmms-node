# CMMS-NODE 코딩 규칙 (Coding Conventions)

본 문서는 FE/BE 공통 개발 시 일관된 구조와 유지보수성을 확보하기 위한 기본 규칙을 정의합니다.

---

## 1. 기본 원칙

*   동일한 성격의 기능은 동일한 URI, 메서드, 권한 처리 규칙을 사용합니다.
*   문서형 자원은 CRUD와 상태 전이(Action)를 분리합니다.
*   권한 예외는 컨트롤러보다 서비스 계층에서 판단합니다.
*   FE는 API wrapper를 통해서만 백엔드와 통신하며, 화면 컴포넌트에서 URI를 직접 조합하지 않습니다.

---

## 2. 자원형 API 규칙

문서형 자원은 아래 규칙을 기본으로 사용합니다.

*   목록 조회: `GET /resources`
*   상세 조회: `GET /resources/:id`
*   생성: `POST /resources`
*   수정: `PUT /resources/:id`
*   삭제: `DELETE /resources/:id`

예시:

*   `GET /pm/records/:id`
*   `PUT /work-order/:id`
*   `DELETE /board/:id`

---

## 3. 상태 전이(Action) API 규칙

문서 내용 수정과 상태 변경은 구분합니다.

*   문서 내용 수정: `PUT /resources/:id`
*   상태 전이/업무 행위: `POST /resources/:id/actions/{action}`

예시:

*   `POST /approval/:id/actions/approve`
*   `POST /approval/:id/actions/reject`
*   `POST /procurement/requests/:id/actions/confirm`
*   `POST /procurement/requests/:id/actions/close`

---

## 4. Path / Query 사용 원칙

*   자원 식별자는 path param으로 표현합니다.
*   검색 조건, 정렬, 필터, 접근 컨텍스트는 query param으로 전달합니다.
*   동일한 값을 body와 path에 중복 전달하지 않습니다.

API의 `path/query/body/actions` 구분과 `companyId`·`plantId` 범위 규칙은
`docs/tech_spec.md`의 API 설계를 따릅니다.

예시:

*   자원 식별: `GET /work-permit/:id`
*   검색 조건: `GET /pm/records?stepStage=P&showAll=Y`
*   접근 컨텍스트: `GET /pm/records/:id?plantId=P1`

---

## 5. 권한 처리 원칙

*   모듈 접근 권한은 `module + C/R/U/D`, 조직 범위는 `COMPANY/PLANT`를 사용합니다.
*   `ADMIN`도 동일한 모듈 CRUD와 회사 격리·사업장 범위·문서 상태·결재·재고 검증을 적용합니다.
*   `SYSTEM` 사용자는 일반 업무 API가 아닌 시스템 관리 API와 `SystemShell`만 사용합니다.
*   전자결재 승인·반려는 모듈 권한이 아니라 결재선과 현재 결재단계로 판단합니다.
*   Controller의 업무 API는 공통 권한 metadata를 선언하고, 세부 소유자·상태·창고 범위 검증은 Service에서 수행합니다.
*   본인 임시저장 문서의 수정·삭제 허용 여부와 타인 문서의 수정·삭제 권한은 Service 정책으로 일관되게 처리합니다.

권한 예외는 서비스 계층에서 처리합니다.

*   본인 작성 임시저장(`T`) 문서는 해당 모듈의 `U/D` 권한과 작성자 본인 여부를 모두 확인한 뒤 수정/삭제합니다.
*   타인 문서 수정/삭제는 기본 `U/D` 권한 규칙을 따릅니다.
*   반려(`R`) 문서는 삭제하지 않고 이력을 유지합니다.

---

## 6. FE / BE 연계 원칙

*   FE는 `features/*/*.api.ts`를 통해 API를 호출합니다.
*   페이지/컴포넌트는 axios 경로를 직접 작성하지 않습니다.
*   BE 라우트 변경 시 FE API wrapper를 함께 수정합니다.
*   FE 타입과 BE DTO는 자원 식별 방식(path/query/body)이 일치해야 합니다.

권장 방식:

*   `updateX(id, request)`
*   `deleteX(id, options)`
*   `runXAction(id, action, payload)`

## 6-2. 업무 테이블 필드명 규칙

업무문서와 하위 item은 다음 명명 규칙을 공통으로 사용합니다.

*   문서 header의 회사 범위 복합 PK는 `company_id + id`를 기본으로 하며, 문서 번호 필드명은 `id`로 통일합니다.
*   item 테이블은 별도 surrogate `id`를 만들지 않고 `company_id + 부모문서_id + item_no`를 복합 식별자로 사용합니다.
*   모든 문서 item의 순번 컬럼은 `item_no`로 통일합니다. 신규 코드에서 `line_no`를 사용하지 않습니다.
*   부모 문서 FK는 의미가 드러나는 이름을 사용합니다. 예: `pm_record_id`, `work_order_id`, `request_id`, `order_id`, `doc_id`.
*   FE/BE API DTO의 item 순번은 DB `item_no`에 대응하는 `itemNo`로 통일합니다.
*   공용 allocation은 `allocation_type`, `doc_id`, `doc_item_no`, `pr_id`, `pr_item_no`, `allocation_qty`를 사용합니다. `doc_id`는 allocation 유형의 업무문서 번호이며, `PO`는 PO 번호, `MOVE`는 재고 전표 번호를 의미합니다.
*   `completed_qty`는 allocation에 두지 않습니다. 실제 입고·이동 수량은 PO item 또는 inventory document item에서 관리합니다.

*   재고·구매 수량과 금액은 BE/DB에서 Decimal 및 numeric 4자리로 계산·저장합니다.
*   FE 수량·측정값은 소수점 2자리, 금액은 정수 반올림으로 표시합니다.

---

## 6-1. TypeScript 타입 정의 원칙

*   공개 객체 계약(요청/응답 모델, props, DTO 대응 구조)은 `interface`를 기본으로 사용합니다.
*   유니온 타입, 교차 타입, 매핑 타입, 유틸리티 타입 조합은 `type`을 사용합니다.
*   단순 별칭이 아닌 객체 구조를 표현할 때는 `type`과 `interface`를 혼용하지 않고, 특별한 이유가 없으면 `interface`를 우선합니다.
*   서비스 계층의 `params object` 입력은 재사용 가능성이 있으면 별도 `interface` 또는 `type`으로 분리합니다.
*   FE/BE 계약 타입은 인라인 선언보다 모듈별 `*.types.ts` 또는 DTO 파일에 모아 관리합니다.
*   동일한 의미의 타입을 여러 위치에 중복 선언하지 않습니다. 공통 계약은 단일 정의를 우선합니다.

---

## 7. 예외 허용 기준

아래 경우에만 별도 규칙을 둘 수 있습니다.

*   파일 업로드/다운로드
*   배치 처리
*   외부 시스템 연계
*   단일 CRUD로 표현할 수 없는 복합 업무 처리

예외를 둘 경우에는 사유와 규칙을 문서에 남깁니다.

---

## 8. 문서 유지 원칙

*   신규 모듈 추가 시 본 문서 규칙을 기본으로 적용합니다.
*   기존 모듈 리팩터링 시 본 규칙으로 점진적으로 수렴합니다.
*   규칙 예외를 도입할 경우 `docs/product_spec.md` 또는 별도 설계 문서에 근거를 남깁니다.
