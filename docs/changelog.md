# Changelog

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
- 상태 전이 API(PM 종료, PR 확정, PO 발주·배송·종료)는 `POST + 모듈 U`를 명시하고, 전표·입고·이송 생성 행위는 해당 모듈 C 권한을 유지했다.
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
- 불필요한 `role-detail` Entity와 RoleManager 화면을 제거했다.

### 검증

- Backend typecheck 통과
- Frontend TypeScript build 통과
- Backend/Frontend lint 통과
- 기존 Jest 테스트는 추후 구매·재고 통합 시나리오 테스트를 추가한다.

### 제외

- 운영 DB 마이그레이션 및 기존 데이터 이관은 별도 작업으로 남긴다.
