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

예시:

*   자원 식별: `GET /work-permit/:id`
*   검색 조건: `GET /pm/records?stepStage=P&showAll=Y`
*   접근 컨텍스트: `GET /pm/records/:id?plantId=P1`

---

## 5. 권한 처리 원칙

*   `C/R/U/D/A`는 모듈 단위 기본 권한입니다.
*   `U/D`는 타인 문서를 포함한 일반 수정/삭제 권한을 의미합니다.
*   `A`는 업무모듈의 직접확정/승인 권한입니다.
*   전자결재(`APR`) 승인 행위는 모듈 권한 `A`가 아니라 결재선으로 판단합니다.

권한 예외는 서비스 계층에서 처리합니다.

*   본인 작성 임시저장(`T`) 문서는 `U/D` 권한이 없어도 수정/삭제할 수 있습니다.
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
