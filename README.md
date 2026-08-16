# CMMS-NODE

사내 설비·자재·재고·구매 업무를 관리하는 CMMS 애플리케이션입니다.

## 구성

- `backend`: NestJS + TypeScript + TypeORM 기반 API 서버
- `frontend`: React + TypeScript + Vite 기반 업무 화면
- `docker`: 개발·운영용 컨테이너 구성
- `docs`: 제품·기술·서버 사양 및 개발 참고자료

일반 사용자는 `AppShell`에서 업무 메뉴를 사용하고, `SYSTEM` 사용자는 업무 메뉴 없이 시스템 관리 전용 `SystemShell`을 사용합니다.

## 주요 업무 범위

- 기준정보·권한·사용자 관리
- 설비·예방점검·작업지시·작업허가
- 구매요청·구매오더·입고
- 재고조회·입출고·창고이동·재고조정
- 전자결재·게시판·첨부파일

구매담당자는 권한 범위가 `COMPANY`인 경우 전체 사업장의 확정 구매요청을 조회하여 구매오더로 전환할 수 있습니다. 로그인 초기 사업장은 `homePlantId`, 현재 화면 조회 범위는 `activePlantId`로 구분합니다.

## 문서

- [제품 사양서](docs/product_spec.md): 업무 정책과 기능 범위
- [기술 사양서](docs/tech_spec.md): FE/BE 구조, 권한, 인증, 데이터·트랜잭션 기술 기준
- [서버 사양서](docs/server_spec.md): 배포·인프라·운영 기준
- [코딩 관습](docs/coding_conventions.md): 개발 편의를 위한 API·코드 작성 참고자료

제품 정책은 `product_spec.md`, 기술 결정은 `tech_spec.md`를 기준으로 하며, 서버 운영 세부사항은 `server_spec.md`를 따릅니다.

## 시작하기

Node.js 22 이상과 PostgreSQL이 필요합니다.

```bash
npm install
cp .env.template .env
npm run build
```

개발 서버:

```bash
npm run start:dev --workspace backend
npm run dev --workspace frontend
```

검증:

```bash
npm run typecheck
npm run lint
npm test
```

환경변수는 `.env.template`을 기준으로 설정합니다. 운영 환경에서는 TypeORM synchronize를 사용하지 않으며, DB 변경은 엔티티와 운영 SQL을 함께 검토합니다.
