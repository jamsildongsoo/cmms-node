# CMMS-NODE 코딩 규칙 (Coding Conventions)

본 문서는 FE/BE 공통 개발 시 일관된 구조와 유지보수성을 확보하기 위한 기본 규칙을 정의합니다.

---

## 1. 기본 원칙

*   동일한 성격의 기능은 동일한 URI, 메서드, 권한 처리 규칙을 사용합니다.
*   문서형 자원은 CRUD와 상태 전이(Action)를 분리합니다.
*   권한 관리 대상 API만 `PermissionGuard`/`ModulePermission`을 적용하고, 업무 상태·소유권·결재선 검증은 서비스 계층에서 판단합니다.
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
*   `POST /procurement/orders/:id/actions/confirm`
*   `POST /procurement/requests/:id/actions/close`

---

## 4. Path / Query 사용 원칙

*   자원 식별자는 path param으로 표현합니다.
*   검색 조건, 정렬, 필터, 접근 컨텍스트는 query param으로 전달합니다. FE는 typed query object를 사용하고 URLSearchParams를 직접 mutate하지 않습니다.
*   동일한 값을 body와 path에 중복 전달하지 않습니다.

API의 `path/query/body/actions` 구분과 `companyId`·`plantId` 범위 규칙은
`docs/tech_spec.md`의 API 설계를 따릅니다.

예시:

*   자원 식별: `GET /work-permit/:id`
*   검색 조건: `GET /pm/records?searchType=id&searchValue=PM-001`
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

*   기준정보·마스터는 C/R/U/D를 검사합니다. 일반 업무문서는 C/R 진입 권한을 검사하고, T 문서 수정·삭제는 Service의 본인 소유·상태 검증으로 처리합니다.
*   업무문서의 P/C/S/R/X/E 상태는 일반 수정이 아니라 명시적 업무 action으로 변경합니다. 타인 문서나 T가 아닌 문서는 일반 수정·삭제하지 않습니다.
*   반려(`R`) 문서는 삭제하지 않고 이력을 유지합니다.

---

## 6. FE / BE 연계 원칙

*   FE는 `features/*/*.api.ts`를 통해 API를 호출합니다.
*   페이지/컴포넌트는 axios 경로를 직접 작성하지 않습니다.
*   BE 라우트 변경 시 FE API wrapper를 함께 수정합니다.
*   FE 타입과 BE DTO는 자원 식별 방식(path/query/body)이 일치해야 합니다.
*   수정 요청은 `update(id, request)`로 표현하고 ID는 path에만 전달합니다. Controller가 request DTO를 수정하지 않습니다.
*   Controller 메서드는 `createX`, `updateX`, `getX`, `deleteX`처럼 업무행위를 명시하고, `save(mode)`는 Service 내부 공통 구현에만 사용합니다.

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

---

## 9. FE 페이지 구조 원칙

*   업무 모듈 페이지는 하나의 Container가 목록, 상세/수정, 저장·삭제·상태전이 흐름을 조정합니다.
*   상세 조회와 수정 화면은 동일 화면을 사용하고, 수정 권한이 있을 때만 저장·삭제·상태전이 버튼을 노출하거나 활성화합니다.
*   대형 업무문서의 입력 UI는 페이지/Container 파일에 직접 넣지 않고 `{Module}FormModal`로 분리합니다. Container는 상태·API·업무행위 callback을 소유하고 FormModal은 필드·item 입력과 화면 검증을 렌더링합니다.
*   PUR·POR는 기반 테이블과 업무 흐름이 다르므로 각각 `PurchaseRequestFormModal`, `PurchaseOrderFormModal`이 자신의 필드와 버튼을 소유합니다. 모듈 간에는 공통 `Modal` 껍데기만 공유합니다.
*   단일 FormModal에서만 사용하는 `FormField`, FormBody, Context, 별도 form types 파일은 만들지 않습니다. 실제 재사용처가 둘 이상이고 상태·UI 계약이 동일한 경우에만 공통 컴포넌트를 둡니다.
*   입력 하나 수준의 짧은 업무 action은 별도 FormModal을 만들지 않고 공통 `Modal`을 직접 사용합니다. `ApprovalDraftModal`은 결재선·첨부·자동저장·중첩 표시가 결합된 독립 업무 흐름이므로 별도 업무 Modal 예외로 유지합니다.
*   FormModal 내부의 반복 표시·입력·테이블 JSX는 파일 내부 보조 컴포넌트로 분리할 수 있습니다. 보조 컴포넌트는 화면 표현을 바꾸지 않는 범위에서만 사용하고, 실제 재사용이 없으면 전역 공통화하지 않습니다.
*   출력물은 업무 화면과 분리된 `*Print` 컴포넌트 또는 출력 전용 렌더링으로 관리합니다.
*   목록은 업무별 컬럼·상태·권한 분기를 유지합니다. 데이터 구조와 업무 규칙이 다른 화면을 무리하게 공통화하지 않습니다.
*   PM·WO·WP처럼 목록 패널 구조가 동일한 경우에는 레이아웃만 공통화하고, 행 표시와 업무 분기는 각 모듈에 둡니다.
*   공통 화면 요소는 `components`, 업무 의미가 있는 selector·API·출력물은 해당 `features/{module}` 아래에 둡니다. `ReferenceSelector`처럼 여러 도메인 selector를 한 파일에 묶지 않습니다.
*   `SearchSelect`는 검색 입력·debounce·결과 목록만 담당하고, 설비·자재·사용자·부서의 API와 표시 형식은 각 feature selector가 담당합니다. 10건 이상 선택지는 bounded dropdown 또는 내부 스크롤을 사용합니다.
*   출력물은 공통 헤더(회사명·출력일시·출력자·페이지)와 표/섹션 레이아웃을 공유하되, 업무별 출력 데이터와 세로·가로 양식은 각 `*Print`에서 결정합니다.
*   기준정보·마스터정보는 별도 상세 페이지를 강제하지 않고 현재 통합 화면을 유지할 수 있습니다. 다만 조회·저장·삭제 함수명과 API 호출 패턴은 업무 모듈과 통일합니다.
*   PUR·POR처럼 기반 테이블과 업무 목적이 다른 화면은 진입 페이지와 목록을 분리합니다. 공통화는 실제 상태·필드·동작이 같은 부분에만 적용합니다.

## 10. FE 조회·상태 갱신 패턴

*   목록과 기준정보 조회는 화면별 `loadList` 또는 의미가 명확한 `loadReferences` 한 곳에 둡니다.
*   초기 조회는 `useEffect`가 로더를 호출합니다. 로더의 변경 요인은 `useCallback` 의존성으로 명시합니다.
*   effect 안에서는 프로젝트의 `react-hooks/set-state-in-effect` 규칙을 지키기 위해 짧은 비동기 `run` 함수가 `load...`를 호출합니다. 일반 조회에 `setTimeout`이나 `queueMicrotask`를 사용하지 않습니다. 시간 지연이 요구되는 검색 debounce·자동저장·포커스 해제만 예외입니다.
*   저장·삭제·확정·승인 등 성공 후에는 별도 조회 함수를 만들지 않고 동일한 로더를 직접 호출합니다.
*   일반 조회를 지연시키기 위해 `setTimeout`을 사용하지 않습니다. 검색 입력 debounce나 임시저장 자동 저장처럼 시간 지연 자체가 업무 요구인 경우에만 예외로 둡니다.
*   상세 API를 호출해 편집 상태를 채우는 함수명은 `loadDetail`을 기본으로 사용합니다. 저장과 삭제는 `handleSave`, `handleDelete`를 기본으로 사용합니다.
*   FE 페이지는 API URI를 직접 조합하지 않고 `features/*/*.api.ts` wrapper의 함수만 호출합니다.
*   요청 DTO와 FE payload에는 BE DTO의 필수 식별자·item 순번·첨부파일 그룹 식별자를 누락하지 않습니다. item 순번은 저장 직전에 `itemNo` 기준으로 정규화할 수 있습니다.
*   문서 목록의 기본조건은 회사·허용 plant·`deleteYn='N'`입니다. 임시저장 필터 OFF는 `status<>'T'`와 일반 검색조건을 적용하고, ON은 `status='T' AND createdBy=현재 사용자`만 적용해 검색조건을 무시합니다.
*   신규 임시저장 `POST`는 C, 기존 임시저장 `PUT`은 업무별 Service의 소유권·상태 정책을 따릅니다. 직접확정 `T→S` action은 현재 PO(POR)에만 A 권한으로 제공합니다. 결재 승인·반려와 결재 완료 후 원문서 갱신은 CRUD와 분리된 업무 절차로 처리합니다.

## 11. 용어·권한·범위 기준

*   DB·BE entity·API·FE 내부 타입의 기준 용어는 기존 `Inventory`를 유지합니다. 화면 표시 문구는 업무 사용성에 따라 `자재`로 표시할 수 있습니다.
*   일반 사용자의 회사·사업장 범위는 `scope`, `homePlantId`, activePlantId와 `role_detail` 권한으로 판단합니다.
*   `ADMIN`도 별도 우회 권한을 갖지 않으며, 동일한 모듈 CRUD·범위·문서 상태 검증을 적용합니다.
*   `multiPlant` 필드는 사용하지 않습니다. 신규 seed와 코드에도 해당 권한 플래그를 추가하지 않습니다.
*   `SYSTEM` 사용자는 `SystemShell`과 system 전용 Guard/API를 사용하며, 일반 업무 모듈의 scope 판정 규칙을 재사용하지 않습니다.
*   결재는 일반 모듈 CRUD 권한보다 결재선·현재 결재단계·문서 상태를 기준으로 처리합니다.

## 12. BE 계층 책임

*   Controller는 인증 사용자·tenant context·DTO를 전달하고 Service를 호출하는 역할을 담당합니다. 조회 조건 조합, 상태 검증, 소유권·사업장 범위 검증은 Service에서 처리합니다.
*   `companyId`는 요청 body나 임의 query 값으로 받지 않고 JWT와 `TenantContext`에서 결정합니다.
*   Controller에는 `JwtAuthGuard`, `PermissionGuard`, `ModulePermission(module, action)` 등 공통 접근 규칙을 선언합니다. HTTP 메서드에 따른 권한 자동 매핑은 사용하지 않습니다. 문서 상태·작성자·창고·결재단계 같은 업무 규칙은 Service 정책으로 검증합니다.
*   권한 검증과 데이터 범위 검증을 하나의 ADMIN 예외문으로 우회하지 않습니다. `scope`, activePlantId, 자원 plantId를 함께 확인합니다.
*   Entity를 Request DTO나 응답으로 직접 노출하지 않습니다. 입력은 class-validator DTO, 출력은 명시적 response type 또는 Service 매핑을 사용합니다.
*   단, MDM의 단순 기준정보 CRUD는 현재 결정에 따라 `Partial<Entity>` 입력을 예외적으로 유지합니다. 이 경우에도 Service에서 허용 필드와 회사 범위를 검증합니다.
*   전역 `ValidationPipe`의 `transform`, `whitelist`, `forbidNonWhitelisted` 정책을 유지하고, DTO에 없는 입력 필드는 허용하지 않습니다.
*   BE는 정상 결과를 반환하고 예외는 적절한 NestJS HTTP 예외로 전달합니다. 전역 예외 필터가 공통 오류 응답과 로그를 담당합니다.

## 13. BE 트랜잭션·동시성 원칙

*   하나의 업무 요청이 두 개 이상의 header/item/status/allocation을 변경하면 하나의 TypeORM transaction으로 처리합니다.
*   재고 입고·출고·이동·조정은 all-or-nothing으로 처리합니다. 존재하는 `inventory_status` 대상 행은 `pessimistic_write`로 잠근 뒤 잔량·금액·평균단가를 갱신하고, 행이 없는 최초 입고·조정은 신규 행을 생성합니다. 최초 동시 생성 충돌은 전체 rollback 후 사용자 재시도로 처리합니다.
*   재고 원장 `inventory_history`는 실제 처리 결과를 append-only로 기록합니다. 기존 원장 행을 수정·삭제하지 않고, 취소는 반대 방향의 신규 전표로 처리합니다.
*   재고 처리 전 마감월, 창고·자재 유효성, 출고 가능 수량, 취소 가능 여부를 검증합니다.
*   구매 allocation과 PO 입고 참조 검증은 관련 PO/item/allocation을 잠그고 수량 검증을 같은 transaction에서 수행합니다. 창고 이동은 구매문서·allocation과 분리합니다.
*   외부 연계나 파일 저장처럼 DB transaction과 원자적으로 묶을 수 없는 작업은 성공·실패 보상 또는 재시도 가능성을 고려해 처리합니다.

## 14. BE 수치·상태·채번 규칙

*   수량·단가·금액 계산에 JavaScript `number`의 직접 누적을 사용하지 않고 공통 `Decimal` 유틸리티를 사용합니다.
*   DB numeric 값은 업무 기준 소수점 4자리로 저장·교환하고, FE 표시 단계에서만 수량 소수점 2자리·금액 정수 표시로 변환합니다.
*   문서 상태를 임의 문자열로 생성하지 않고 공통 status 상수를 사용합니다. 상태 변경은 일반 수정과 분리된 명시적 action Service에서 허용된 전이만 수행합니다.
*   문서번호·전표번호는 `SequenceService`를 사용합니다. Controller나 Service에서 현재 건수를 세어 번호를 직접 생성하지 않습니다.
*   업무 item의 순번은 저장 직전에 `itemNo`/`item_no` 기준으로 정규화하고, 부모 문서 범위에서 중복되지 않도록 검증합니다.

## 15. BE 변경·검증 기준

*   BE API, DTO, Entity, Service를 변경하면 대응하는 FE API wrapper와 타입을 함께 확인합니다.
*   권한·범위·상태·수량·취소 로직은 정상 케이스뿐 아니라 타 회사, 다른 사업장, 중복 요청, 잘못된 상태, 부족 재고를 검증하는 테스트를 우선합니다.
*   운영 환경에서는 `DB_SYNCHRONIZE=false`를 유지하며 Entity 변경만으로 운영 스키마가 변경된다고 가정하지 않습니다.
*   공통 규칙을 우회하는 특수 처리가 필요하면 대상 API·상태·권한·transaction 범위와 사유를 changelog 또는 기술 사양서에 기록합니다.
