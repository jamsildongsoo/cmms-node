# CMMS-NODE Frontend

React, TypeScript, Vite, TailwindCSS로 구성된 CMMS Web입니다.

개발 환경 전체 기동은 저장소 루트에서 실행합니다.

```bash
./scripts/dev.sh
```

Frontend만 실행하거나 검증할 때:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

전체 화면 구조와 API 통신 방식은 [`../docs/tech_spec.md`](../docs/tech_spec.md),
개발·운영 기동 방법은 [`../docs/server_spec.md`](../docs/server_spec.md)를 참고합니다.
