# Changelog

## 2026-08-22

### PM 실적 전용 전환 및 FE/BE 계약 정리

- PM Entity·DTO·FE 타입에서 stage, 계획기간, 종료 플래그, 인증정보와 관련 레거시 분기를 제거했다.
- PM Record는 실적 전용 문서로 정리했으며 stage 값을 저장·전달하지 않는다. 기존 계획/현황 토글과 PM 일정 API는 제거했다.
- 설비 selector는 `pmTargetOnly=true`를 전달할 때만 PM 대상 설비로 제한하고, 기본 호출은 전체 설비를 반환한다. 설비 선택 후 상세 점검주기의 점검유형만 드롭다운에 표시한다.
- PM 템플릿 조회 기준을 `plantId + equipmentId + checkTypeCode`로 정리했다. 템플릿은 선택형 편의기능이며 실적 입력 시 사용자가 수정할 수 있다.
- PM Controller/Service 공개 메서드를 `createPmRecord`, `updatePmRecord`, `getPmRecords`, `deletePmRecord`로 구분하고, 수정 요청에서 path ID와 body ID 중복을 제거했다.
- FE 페이지의 URLSearchParams 직접 변경과 PM 계획·실적 출력/결재 본문 분기를 제거했다.
- 상세 결정사항은 제품·기술 사양서와 공통 작성 규칙에 반영했다.

## 2026-08-21

### 설비 마스터 기반 PM 실적 프로세스

- 설비에 `pm_target_yn`을 추가했다. 개발 모드에서는 `DB_SYNCHRONIZE=true`로 엔티티 스키마를 자동 반영하며, 운영 DB 마이그레이션은 실행하지 않는다.
- 설비 마스터에서 PM 대상 여부와 점검유형별 주기·마지막 점검일·다음 점검일을 함께 관리하도록 했다.
- PM 실적 목록과 설비 마스터 점검주기 연계를 검토했으며, 최종 화면·API 정책은 2026-08-22 PM 실적 전용 전환 기록을 따른다.
- 기존 PM 계획 문서와 결재이력은 보존하되 신규 정기 PM 입력은 실적 중심으로 처리한다.

## 2026-08-19

### 창고 이동·PO 입고 계약 정정 및 FE selector 정리

- SYSTEM의 신규 회사 생성 시 권한과 무관한 `ADMIN` 부서를 자동 생성하지 않도록 정리했다. 초기 관리자 계정의 부서는 `null`이며, 실제 조직 부서를 등록한 뒤 배정한다. 신규 DB 구성 기준으로 별도 마이그레이션은 추가하지 않았다.
- PM·WO·WP·PUR·POR 목록은 임시저장 OFF에서 T 문서를 제외하고, ON에서 현재 사용자가 생성한 T 문서만 반환하도록 통일했다. 임시저장 ON에서는 일반 검색조건을 적용하지 않으며 APR은 기존 기안자·결재선 보관함 기준을 유지한다.
- POR FormModal에 취소·임시저장·확정 버튼을 명확히 배치하고, 확정 API 권한을 U가 아닌 A로 변경해 `T→S` 전이를 사용하도록 정리했다. A 권한 모델은 향후 확장을 위해 공통으로 유지하되 현재 A 사용 업무는 POR 확정뿐이다.
- 기존 T 상태 POR를 U 권한으로 다시 임시저장할 수 있도록 FE API와 `PUT /procurement/orders/:id`를 추가했다. BE는 본인 작성·T 상태를 트랜잭션 잠금 후 검증하며, 독립 POR는 헤더·품목을 함께 수정하고 PR 배부 기반 POR는 헤더·allocation만 수정한다.
- 결재연계된 PM·WO·WP는 T 상태로만 저장하고 APR 완료로 C 전이하도록 직접 S 저장 호환 코드를 제거했다. 사용하지 않는 PUR 직접확정 API도 제거하고, PM 상세 R/신규 C 권한 매핑 오류를 수정했다.
- 재고 `MOVE`는 PUR·POR·allocation과 무관한 창고 간 이동으로 정정했다. plant는 사용자가 창고를 검색할 때 적용하는 범위이며, source/target plant 비교나 plant 간 이동 검증을 하지 않는다.
- 회사 범위 사용자가 plant를 선택하지 않으면 회사 공통 창고(`plantId=null`)를 포함한 전체 허용 창고를 조회하고, plant를 선택하면 해당 범위의 창고만 조회하도록 MDM 창고 API를 정리했다.
- allocation의 업무 유형은 PO 발주 배부만 유지하고, 사용하지 않는 MOVE allocation 타입을 제거했다.
- STK에 `GET /procurement/orders/receivable`, `GET /procurement/orders/receivable/:id`를 추가했다. STK 권한으로 PO 입고 대상과 잔량을 조회하며 POR 권한을 대신 사용하지 않는다.
- PO 입고는 `refModule=POR`, `refNo=PO 번호`, `refLineNo=PO item 번호`를 사용한다. BE transaction에서 PO 상태·자재·라인·잔량을 재검증해 초과 입고를 차단한다.
- FE의 `referenceApi/masterReferenceApi` 호환 별칭과 기존 `ReferenceSelector`를 제거하고 `mdmLookupApi/masterLookupApi`, 공통 `SearchSelect`, feature별 `EquipmentSelector/InventorySelector`로 정리했다.
- APR 화면의 C/R/U/D 버튼 표시를 서버의 `ModulePermission(APR, action)` 계약과 맞췄다.
- 공통 출력 헤더의 표시값을 회사 코드가 아닌 회사명 우선으로 통일하고, 목록 출력 헤더도 동일하게 `회사명·출력일시·출력자`를 표시하도록 정정했다.
- `Procurement.tsx`를 `containers/ProcurementContainer.tsx`로 이동해 PUR/POR 진입 페이지와 업무 Container를 분리했다. PUR/POR 전용 FormModal 진입 컴포넌트를 추가하고, PM·WO·WP에도 모듈별 FormModal 경계를 추가했다.
- 공통 `Modal`에는 모달 껍데기만 두고, 모듈별 `FormModal`이 업무 필드·검증·버튼을 담당하도록 책임을 정리했다. 단일 사용 `FormField`, FormBody, 별도 form types 파일은 두지 않는다.
- PUR/POR의 공통 구매 필드와 각 업무별 배부·상태 버튼을 모듈 FormModal로 이동하고 Container에는 상태·조회·API callback만 남겼다.
- PM·WO·WP의 대형 입력 JSX도 각각의 FormModal로 이동했다. 목록 삭제 버튼을 제거하고 임시 문서 삭제는 상세 FormModal에서만 수행하도록 통일했다.
- 게시판 작성·수정은 `BoardFormModal`로 분리하고 상세 조회와 월 재고마감은 공통 `Modal`을 사용하도록 인라인 모달 껍데기를 제거했다.
- 시스템관리·내정보·MDM 관리자 조회도 `load...` + `useCallback` 패턴으로 통일하고 Hook 의존성 예외 주석을 제거했다. 초기 조회 effect의 짧은 비동기 `run` 래퍼는 `react-hooks/set-state-in-effect` 정적검사 준수를 위한 공통 패턴으로 유지한다.
- 기술사양서·제품사양서·코딩 규칙에 PUR 기반 이동 제거, PO 입고 참조, 창고 범위, FE selector 및 effect 호출 원칙을 반영했다.

### FE 구조·조회 패턴 정리

- 자재·설비·게시판·결재·사용자관리의 목록 조회를 `loadList` 중심으로 통일했다.
- 초기 조회는 `useEffect`, 로더 의존성은 `useCallback`으로 관리하고, 저장·삭제 후 동일 로더를 재호출하도록 정리했다.
- 일반 목록 조회에서 불필요한 `setTimeout`을 제거했다. 결재 임시저장 자동 저장 debounce만 시간 지연 예외로 유지했다.
- PM·WO·WP·게시판·결재·설비의 상세 API 호출 함수명을 `loadDetail`로 통일했다.
- PM·WO·WP의 동일한 목록 패널 레이아웃을 `DocumentListPanel`로 공통화했다.
- PM·WO·WP의 행 표시·권한·상태 분기는 업무별 페이지에 유지해 과도한 공통화를 방지했다.
- PUR·POR 진입 페이지를 분리하고, 목록·상세·저장 흐름을 각 업무 목적에 맞게 유지했다.

### 권한·용어·문서 규칙

- 일반 사용자의 범위 권한은 `scope`, `homePlantId`, activePlantId와 `role_detail`을 기준으로 처리한다.
- ADMIN 우회 권한과 `multiPlant` 권한 플래그를 제거하고, SYSTEM은 `SystemShell` 전용 인증·인가 흐름을 사용하도록 정리했다.
- 내부 DB·API·FE 타입 용어는 `Inventory`를 유지하고, 화면 표시 문구만 `자재`로 사용할 수 있도록 기준을 명확히 했다.
- 업무 화면은 상세·수정을 통합하고 출력물은 별도 컴포넌트로 분리하는 원칙을 문서화했다.

### BE 개발 규칙 보완

- Controller·Service·DTO·응답 매핑의 책임을 구분하고, `TenantContext` 기반 회사·사업장 범위 검증 원칙을 명시했다.
- 재고 원장의 append-only 처리, 반전 신규전표 방식, `pessimistic_write` 잠금과 all-or-nothing transaction 원칙을 명시했다.
- 구매 allocation과 재고 상태 갱신의 transaction 범위를 문서화했다.
- DTO 검증, 전역 예외 처리, Decimal 수치 계산, 상태 전이 action, SequenceService 채번 규칙을 추가했다.
- 기술사양서의 PO item `received_qty` 잔존 표기를 제거하고 재고전표 조회 기준으로 정정했다.
- 업무 Controller의 자동 HTTP 메서드 권한 매핑을 제거하고 모든 API에 `ModulePermission(module, action)`을 명시했다.
- 구매·재고·SYSTEM의 업무 응답에 사용하던 `Promise<any>`를 명시적 응답 타입으로 교체했다. 남은 `any`는 DB 옵션·Nest interceptor·S3 스트림 타입 경계에 한정된다.

### 검증

- Frontend lint 통과
- Frontend production build 통과
- Backend typecheck 통과
- Backend Jest 테스트 통과 (2 suites, 4 tests)

## 2026-08-18

### 구매·재고 처리 책임 분리

- PO와 PR item의 저장형 `receivedQty`를 제거했다.
- 별도 구매입고·PR 연계 이동·구매입고 취소 API와 재고처리 화면 흐름을 제거했다.
- 재고처리는 일반 입고·출고·이동·조정 전표 기준으로 처리하도록 정리했다.
- PO·PR의 자재 중복을 DB UNIQUE로 강제하지 않고, 통합 PO만 `inventoryId` 기준으로 그룹화하도록 유지했다.
- PO 라인 추적을 위해 `inventory_document_item.refLineNo`를 추가했다.
- 수량 0 재고전표 입력을 허용하지 않는 공통 처리 흐름을 유지했다.
- PO 입고수량과 입고이력은 저장형 수량이 아니라 재고전표 참조·조회 기준으로 관리한다.
- 재고전표 번호를 입력하는 통합 취소 API와 FE 취소 탭을 추가했다.
- 취소전표는 원본 전표의 `txDate`와 라인을 반전하고 `reverseDocumentId`로 원본을 참조하도록 했다.
- 원본 이후 후속 수불이 있거나 이미 반전된 전표는 취소하지 않도록 검증한다.
- 구매오더 화면에서 PO 번호 기준 재고전표 헤더 이력을 조회하는 API와 화면을 추가했다.
- 재고전표 출력에 처리사유와 원본전표 참조를 표시하도록 연결했다.

### DB 적용

- `backend/database/migrations/20260818_procurement_stock_reference.sql`에 기존 `received_qty` 컬럼 제거와 `ref_line_no` 추가 DDL을 기록했다.

## 2026-08-17

### 대용량 설비·자재 선택

- 설비·자재 마스터 목록 컬럼을 업무용 표시 기준으로 정리했다.
- 설비 목록에서 작업허가 컬럼을 제거하고 타입명·사업장명·스펙·점검일을 표시하도록 변경했다.
- 자재 목록에서 창고·안전재고·재주문점·리드타임 컬럼을 제거하고 타입명·단위·제조사·모델·스펙을 표시하도록 변경했다.
- 설비·자재 마스터에 코드·명칭·제조사 검색을 추가하고 설비 플랜트 필터를 제거했다.
- PM·WO·WP의 설비 선택을 설비번호·설비명 서버 검색 방식으로 변경했다.
- PUR·POR·STK의 자재 선택을 `Inventory` 번호·자재명 서버 검색 방식으로 변경했다.
- 기존 `/master/equipments`, `/master/inventories` GET API에 `keyword`와 선택적 `limit` 파라미터를 추가했다.
- 공통 `EquipmentSelector`와 `InventorySelector`를 추가해 전체 마스터를 드롭다운으로 미리 로드하지 않도록 정리했다.
- Work Order 전용 Selector는 추가하지 않고 기존 작업지시 목록 검색을 사용한다.
- MDM 선택 항목에는 줄임 표시와 내부 스크롤을 제공하는 bounded dropdown을 적용했다.

### 구매입고·구매화면 정리

- 구매처리 화면에서는 입고·이동 등 재고처리를 제거하고, 재고처리 화면에서 구매문서를 선택하도록 정리했다.
- 구매요청과 구매오더를 별도 메뉴·별도 목록으로 분리했다.
- 메뉴와 목록 명칭을 `구매요청 목록`과 `구매오더 목록`으로 분리하고, 구매요청 목록에서는 별도 발주상태 대신 이력조회에서 연결 POR 번호와 T/S 상태를 확인하도록 정리했다.
- 구매오더 목록에는 독립 POR 신규 입력을 추가하고, PUR 연계 POR와 Allocation 없는 독립 POR를 함께 조회하도록 정리했다.
- 재고처리 화면에서 POR 1건 입고와 PUR 1건 이동을 번호 입력으로 조회·처리하도록 정리했다.
- 입고 연계 대상은 구매오더(POR), 이동 연계 대상은 구매요청(PUR)으로 화면 명칭을 명확히 했다.
- 이동의 상세사유에 `창고이동`과 `구매요청`을 함께 제공하고, 구매요청 선택 시 PUR 번호 조회 흐름으로 전환하도록 정리했다.
- 구매 기반 재고처리 API도 `STK C` 권한의 `/inventory-tx/purchase/*` 경로로 통일했다.
- 구형 발주 저장·배송 시작 API와 FE 버튼을 제거하고 POR 상태는 임시저장·자체확정 기준으로 처리한다.

### 권한·구매·재고 구조

- 모듈 권한 화면 검사를 `hasModuleAction`과 C/R/U/D별 함수로 분리
- PUR·POR의 문서 상태와 임시문서 업무 제한을 명확히 적용
- POR 연결정보를 지연 조회하고 POR 확정·삭제 API를 추가
- `proc_status`를 구매 업무 상태로 사용하지 않도록 제거
- STK 거래 생성은 C 권한으로 확인하고 U/D API를 제공하지 않도록 정리
- 재고 전표 item의 불필요한 `ref_line_no` 제거

## 2026-08-16

### 권한 체계 정리

- Controller 권한 인자를 `module + C/R/U/D` 기준으로 통일하고 READ/MANAGE 호환 인자를 제거했다.
- PermissionGuard의 모듈 권한 검사를 HTTP 메서드별 C/R/U/D 검사로 정리했다.
- Ref/Workflow 전용 권한 메타데이터 의존을 제거하고, 업무조건은 Service에서 검사하도록 정리했다.
- 로그인 권한 응답에서 모듈별 CRUD와 사용자 scope를 직접 제공하도록 변경했다.
- 회사 범위는 `scope=COMPANY`, 사업장 범위는 `scope=PLANT`와 activePlantId로 판단한다.
- 회사 관리자 전용 예외 권한을 제거하고, 회사 생성 시 ADMIN Role에 전체 모듈 CRUD를 기본 부여하도록 정리했다.
- 회사 조회·생성 API를 `/system/companies`로 이동하고 `SystemGuard`를 Controller 단위로 적용했다.
- 사용자 비활성화 시 Refresh 세션을 폐기하는 기존 SYSTEM 기능은 유지했으며, 회사별 세션 만료 설정은 추가하지 않았다.
- 출력 공통 Header와 페이지 번호를 유지하고, WO 계획·실적 및 재고 전표의 개별 항목명을 표준 출력폼에 맞게 보완했다.
- 상태 전이 API(PM 종료, PR 확정, PO 확정·종료)는 `POST + 모듈 U`를 명시하고, 재고 전표와 구매 기반 입고·이동은 `STK C`로 처리한다.
- 관련 기술문서와 코딩 규칙에서 이전 이중 권한 레벨 표기를 제거했다.

### 검증

- Backend typecheck 통과
- Backend Jest 테스트 통과 (2 suites, 4 tests)
- Frontend TypeScript build 통과

## 2026-08-12

### 구현 완료

- 인증·세션·활성 플랜트와 회사/플랜트 범위 권한을 정리했다.
- `SYSTEM` 사용자는 `SystemShell`로 분리하고, 일반 사용자는 공통 `AppShell`을 사용하도록 정리했다.
- 기준정보·마스터 CRUD의 Request DTO와 명시적 응답 매핑을 적용했다.
- 자재를 회사 공통 마스터로 정리하고, 신규 자재·창고 생성 시 창고별 재고 상태를 0으로 초기화하도록 반영했다.
- 자재 마스터에서 사용하지 않는 `departmentId`와 구매요청의 미사용 `vendorId` 애플리케이션 필드를 제거했다.
- PR은 header의 요청창고 1개 기준으로 정리했다.
- PO/PO item을 도입하고, PR 통합 발주·분할 발주를 지원하도록 구현했다.
- 공용 `allocation`을 `PO`와 `MOVE` 유형으로 정리했다.
- 중앙창고 입고, 요청창고 직접입고, 담당자 수동 이송, PR 연계 이송을 분리했다.
- 일반 이동은 재고만 변경하고, PR 연계 이동은 `MOVE allocation`과 PR 수령수량을 함께 갱신하도록 구현했다.
- `inventory_document/item`을 업무 전표로, `inventory_history`를 창고·자재별 재고 원장으로 분리했다.
- 이동 전표는 출발창고 `OUT`과 도착창고 `IN` item을 생성하도록 구현했다.
- 재고 상태 갱신에는 `pessimistic_write` 잠금을 사용하고 advisory lock은 사용하지 않는다.
- 재고 전표 목록/상세 조회 API와 PO 전용 입고 API를 추가했다.
- FE에서 일반 이동, PR 연계 이동, PO 입고 흐름을 연결했다.
- 문서 식별자와 item 순번 필드를 `id`/`item_no` 기준으로 정리했다.
- 부서 중심 권한을 제거하고 `role_detail` 기반 역할 권한을 유지하도록 정리했다.

### 검증

- Backend typecheck 통과
- Frontend TypeScript build 통과
- Backend/Frontend lint 통과
- 기존 Jest 테스트는 추후 구매·재고 통합 시나리오 테스트를 추가한다.

### 제외

- 운영 DB 마이그레이션 및 기존 데이터 이관은 별도 작업으로 남긴다.
- 2026-08-23: 게시글 삭제 시 댓글 존재 여부를 검사하고, PM 결재 완료 시 점검주기를 갱신하도록 반영했다. 설비 수정·삭제 API는 사업장·설비 복합 식별자를 Path Param으로 사용하며, 자재·창고 생성 시 재고상태를 선행 생성하지 않고 최초 입고·조정 시 생성하도록 변경했다. PO 확정은 T 저장·검증 후 S 전환만 수행한다.
