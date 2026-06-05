# CMMS-AGY → Node.js (NestJS + TypeScript) 전환 구현 계획서

> 기준: `cmms-agy` 소스 분석 및 사용자 검증 수정 세트 반영 (2026-05-31)  
> 대상: `/home/polknet/projects/cmms-node`

---

## 1. 목표 및 배경

### 전환 목표
- Spring Boot / Java 21 백엔드를 **NestJS + TypeScript** 로 전환.
- 프론트엔드(React + TS)와 **타입 공유** (`shared/` 패키지)로 개발 생산성 향상.
- 현재 백엔드의 **결함(C3 채번 레이스, M4 마감 버그)** 을 재구현 시 정합성 있게 해결.
- 기존 DDL(`V1~V4.sql`) **그대로 재활용** (DB 스키마 단일 소스 원칙 준수).

### 유지 및 마이그레이션 범위
| 항목 | 유지 여부 | 상세 내용 |
|------|-----------|-----------|
| PostgreSQL DB 스키마 | ✅ 그대로 | Flyway가 단일 스키마 정의 소스. TypeORM `synchronize: false` 고정. |
| DB 마이그레이션 | ⚠️ 운영만 적용 | **개발 단계에서는 Flyway를 적용하지 않음.** 개발자는 수동으로 DB를 관리하며, 운영 배포 파이프라인(CI/CD)에서만 Flyway가 돌도록 구성. |
| JWT 인증 방식 | ✅ 동일 유지 | 페이로드에 필수 테넌트 정보를 확장하여 DB 조회 병목 제거. |
| 프론트엔드 | ✅ 변경 없음 | 단일 React frontend를 그대로 유지하고, Vite dev server 프록시만 새 포트로 우회. |

> **JWT Access Token 클레임 스펙 단일화 (multiPlant 포함)**  
> 토큰 페이로드 내에 `companyId`, `userId`, `roleId`, `departmentId`, `lastLoginPlantId`, `multiPlant` 정보를 명확히 포함시킵니다.  
> 이를 통해 매 요청마다 DB를 거쳐 사용자 메타데이터를 재조회하지 않고, `AsyncLocalStorage` 기반의 테넌트 컨텍스트를 활용해 전 계층에 전파합니다.

---

## 2. 기술 스택

```
Runtime         : Node.js 22 LTS
Language        : TypeScript 5.x (strict mode)
Framework       : NestJS 10.x
ORM             : TypeORM 0.3.x (synchronize: false)
DB Migration    : node-flyway (개발 배제, 운영 배포 파이프라인에서만 실행)
Auth            : @nestjs/jwt + passport-jwt + bcryptjs
Validation      : class-validator + class-transformer
Config          : @nestjs/config (.env 기반)
Decimal         : decimal.js (금융 정밀도 연산용, 단 PM 측정값은 float 허용)
File Storage    : @aws-sdk/client-s3 (v3) (Supabase Storage 연동)
Async Context   : AsyncLocalStorage (멀티테넌트 컨텍스트 전파)
Test            : Jest + @nestjs/testing
```

---

## 3. 디렉토리 구조

```
cmms-node/
├── docs/
│   └── implementation_plan.md    # 본 문서
├── shared/                       # BE+FE 공유 타입 패키지
│   └── src/types/
├── backend/                      # NestJS 애플리케이션
│   ├── src/
│   │   ├── common/               # 공통 모듈
│   │   │   ├── decorators/       # @CurrentUser, @Permission
│   │   │   ├── guards/           # JwtAuthGuard, PermissionGuard
│   │   │   ├── filters/          # GlobalExceptionFilter
│   │   │   ├── interceptors/     # TenantInterceptor
│   │   │   └── utils/            # CodeUtil, Decimal 헬퍼
│   │   ├── config/               # ConfigModule 설정
│   │   ├── database/             # TypeORM DataSource 및 DB 모듈
│   │   ├── modules/
│   │   │   ├── auth/             # 로그인 및 토큰 발급 (Phase 1)
│   │   │   ├── mdm/              # 조직정보, 사용자, 창고, 공통코드
│   │   │   ├── master/           # 설비/재고 마스터
│   │   │   ├── pm/               # 예방점검
│   │   │   ├── work-order/       # 작업지시
│   │   │   ├── work-permit/      # 작업허가서
│   │   │   ├── inventory-tx/     # 재고처리 (비관적 락)
│   │   │   ├── procurement/      # 구매요청
│   │   │   ├── approval/         # 전자결재
│   │   │   ├── board/            # 게시판 (파일 연동 보강)
│   │   │   └── file/             # S3 파일 스토리지 모듈
│   │   ├── entities/             # TypeORM 엔티티 (PostgreSQL)
│   │   └── main.ts
│   ├── test/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
└── frontend/                     # 기존 cmms-agy/frontend (Vite 프록시 포트 포워딩 수정)
```

---

## 4. 핵심 설계 및 결함 해결 방안

### 4.1 🟢 데이터 변경 규약: 덮어쓰기 vs Setter
* **MDM / Board / Approval**:  
  * **덮어쓰기(Object.assign) 적용**: 생산성을 위해 사용하며, 서비스 단에서 수정 가능한 필드만 비구조화 할당(Destructuring)으로 발라낸 뒤 반영하여 테넌트 정보(`companyId`)나 ID, 작성자 등의 정보가 오염되지 않도록 완충합니다.
  * 단, 상태 전이의 비즈니스 로직(예: 결재 승인/반려 등)은 명확한 Setter 메서드를 호출하여 변경합니다.
* **Inventory Tx (재고 트랜잭션)**:  
  * **명시적 Setter 적용**: 이동평균단가 계산 및 재고 변동량 누적은 비즈니스 산식에 의한 제어가 필수적이므로 DTO 직접 덮어쓰기를 전면 금지하고 명시적으로 개별 속성을 Setter 방식으로 가감 처리합니다.
* **PM (예방점검 측정값)**:  
  * **원시 float (number) 허용**: 온도, 압력 등의 물리적 센서 측정치와 계측 데이터는 정밀 금융 계산이 요구되지 않으므로, 복잡한 `Decimal.js` 래핑 없이 원시 float(JavaScript `number`) 타입을 적용하여 산술 연산을 가볍게 처리합니다.

---

### 4.2 🟢 Supabase 세션 풀러(5432) 단일 DataSource 구성
* **현황**: 기존 Spring 백엔드는 싱가포르 리전 세션 풀러(`aws-1-ap-southeast-1.pooler.supabase.com:5432`) 단일 DB 연결 위에서 `FOR UPDATE` 비관적 락을 정상 운영하고 있습니다.
* **설계**: 불필요한 이중 DataSource(6543+5432 분리) 구성을 배제하고, **단일 세션 풀러(5432) DataSource**를 기본으로 구축합니다.
* **주의**: 향후 Supabase 설정을 변경하여 세션 풀러가 아닌 트랜잭션 풀러(6543) 모드로 완전히 이관할 때만 이중 DataSource 구성을 옵션으로 검토합니다.

---

### 4.3 🔴 C3 채번(Sequence) 동시성 결함 해결
* **기존 결함**: Spring의 `synchronized + @Transactional`은 멀티 서버 환경에서 무력하였으며, `INSERT` 레이스 발생 시 중복 시퀀스가 생성되거나 번호를 건너뛰는 레이스 조건이 있었습니다.
* **해결책**:
  * PostgreSQL의 **단일 UPSERT-RETURNING 쿼리**를 사용해 원자적(Atomic)으로 채번을 수행합니다.
  * 이 방식은 트랜잭션 풀러 환경에서도 완벽히 호환되며, 1번 시퀀스부터 중복이나 누락 없이 정확하게 시작할 수 있습니다.

```typescript
// backend/src/common/sequence/sequence.service.ts
async generateNextNo(
  companyId: string,
  module: string,
  departmentId: string | null,
): Promise<string> {
  const deptId = departmentId?.trim() || 'DEPT_ROOT';
  const yearMonth = format(new Date(), 'yyyyMM');

  // 단일 UPSERT-RETURNING 원자적 쿼리 수행
  const result = await this.dataSource.query<{ last_seq: number }[]>(
    `INSERT INTO sequence_generator 
       (company_id, ref_module, department_id, year_month, last_seq, created_by, updated_by)
     VALUES ($1, $2, $3, $4, 1, 'SYSTEM', 'SYSTEM')
     ON CONFLICT (company_id, ref_module, department_id, year_month)
     DO UPDATE SET last_seq = sequence_generator.last_seq + 1, updated_by = 'SYSTEM'
     RETURNING last_seq`,
    [companyId, module, deptId, yearMonth],
  );

  const nextSeq = result[0].last_seq;
  return `${module}-${deptId}-${yearMonth}-${String(nextSeq).padStart(4, '0')}`;
}
```

---

### 4.4 🔴 M4 재고 마감 산식 결함 해결
* **기존 결함**: Spring의 재고 마감 로직은 마감수량(`closingQty`) 산출 시 해당 마감월 기준의 이력 합산이 아닌 마감 처리 "현재 시점"의 실시간 재고량(`status.getQty()`)을 복사하여 넣는 심각한 오계산 결함이 있었습니다.
* **해결책**:
  * **부호 규약 준수**: DB상에 출고(`OUT`) 및 이동출고(`MOVE_OUT`)의 수량(`qty`)과 금액은 **음수**로 저장되므로, 기간 합산 시 부호 있는 합(Sum)으로 집계합니다.
  * **누적 잔액(Ending Balance) 산출**: 마감월 말일 이하의 전체 역사적 이력의 부호합을 합산하여 기말 잔액을 산출합니다.
  * **버킷 분리**: `closing` 테이블에 요구되는 입고(`inQty`), 출고(`outQty`), 이동(`moveQty`), 조정(`adjQty`)의 당월 증감값 계산식을 버킷별로 분류하여 합산합니다.

```typescript
// backend/src/modules/inventory-tx/inventory-tx.service.ts
async closeMonth(companyId: string, closingYm: string, operator: string): Promise<void> {
  const targetDateLimit = endOfMonth(parse(closingYm + '01', 'yyyyMMdd', new Date()));

  // 1. 해당 회사 전체 재고 상태 대상 순회
  const statuses = await this.inventoryStatusRepo.find({
    where: { companyId, deleteYn: 'N' },
  });

  for (const status of statuses) {
    // 2. 마감 마일스톤 날짜(마감월 말일) 이하의 전체 이력을 조회하여 기말 누적 잔액 산출
    const historicalTxs = await this.historyRepo.find({
      where: {
        companyId,
        warehouseId: status.warehouseId,
        inventoryId: status.inventoryId,
        txDate: LessThanOrEqual(targetDateLimit),
      },
    });

    const closingQty = historicalTxs.reduce((acc, h) => acc.add(new Decimal(h.qty)), new Decimal(0));
    const closingAmount = historicalTxs.reduce((acc, h) => acc.add(new Decimal(h.amount)), new Decimal(0));

    // 3. 당월(1일 ~ 말일) 구간 이력 분류하여 버킷별 집계 (inQty, outQty, moveQty, adjQty)
    const start = startOfMonth(targetDateLimit);
    const monthlyTxs = historicalTxs.filter(h => h.txDate >= start && h.txDate <= targetDateLimit);

    let inQty = new Decimal(0);
    let outQty = new Decimal(0);
    let moveQty = new Decimal(0);
    let adjQty = new Decimal(0);

    for (const h of monthlyTxs) {
      const q = new Decimal(h.qty);
      if (h.txType === 'IN' || h.txType === 'CANCEL_IN') inQty = inQty.add(q);
      else if (h.txType === 'OUT' || h.txType === 'CANCEL_OUT') outQty = outQty.add(q); // OUT은 음수값으로 누적
      else if (h.txType === 'MOVE_IN' || h.txType === 'MOVE_OUT') moveQty = moveQty.add(q);
      else if (h.txType === 'ADJ') adjQty = adjQty.add(q);
    }

    await this.closingRepo.save({
      companyId,
      closingYm,
      warehouseId: status.warehouseId,
      inventoryId: status.inventoryId,
      closingQty: closingQty.toFixed(4),
      closingAmount: closingAmount.toFixed(4),
      inQty: inQty.toFixed(4),
      outQty: outQty.toFixed(4),
      moveQty: moveQty.toFixed(4),
      adjQty: adjQty.toFixed(4),
      createdBy: operator,
      updatedBy: operator,
    });
  }
}
```

---

### 4.5 🔴 플랜트 격리 우회 위협 방지 (보안 제어)
* **보안 위협**: 단일 플랜트 권한 유저가 HTTP 요청 헤더 `x-active-plant-id`를 임의 변조하여 전송하면 시스템 내부 격리가 뚫릴 수 있습니다. (todo P5/P6 대응)
* **해결책**: `TenantInterceptor` 내에서 헤더를 검사할 때, 사용자의 권한 혹은 역할이 멀티 플랜트(`multiPlant === 'Y'`)가 가능한 경우에만 헤더의 지정을 허용하고, 일반 유저 권한인 경우에는 헤더를 완전히 무시하고 JWT 페이로드에 확정된 `lastLoginPlantId`로 강제 고정합니다.

```typescript
// backend/src/common/interceptors/tenant.interceptor.ts
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload; // JWT Payload에서 직접 읽음

    // multiPlant === 'Y' 일 때만 요청 헤더의 활성 플랜트 override를 허용
    let activePlantId = user.lastLoginPlantId;
    if (user.multiPlant === 'Y' && req.headers['x-active-plant-id']) {
      activePlantId = req.headers['x-active-plant-id'] as string;
    }

    const context: TenantContext = {
      companyId: user.companyId,
      userId: user.userId,
      roleId: user.roleId,
      departmentId: user.departmentId,
      activePlantId,
    };

    return new Observable((subscriber) => {
      tenantStorage.run(context, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
```

---

### 4.6 🟡 비관적 락 (Pessimistic Lock) 타임아웃
* **Spring 재고처리 락**: `@Lock(PESSIMISTIC_WRITE)` 및 `JPA lock.timeout 힌트`는 PostgreSQL 환경에서 no-op으로 작동하여 실제 타임아웃 강제를 수행하지 못했을 개연성이 높습니다.
* **Node.js 대응**: TypeORM에서 비관적 락을 모방할 때 `SELECT ... FOR UPDATE NOWAIT` 방식을 기본으로 차용하여 락 경쟁 시 오랜 시간 커넥션을 점유하지 않고 즉시 예외(코드 `55P03`)를 터뜨리며, 애플리케이션 단에서 지수 백오프 기반으로 안전하게 최대 3회 재시도(100ms 간격)하도록 하여 리소스를 확보합니다.

---

### 4.7 🟡 P2 파일 첨부 도메인 연동 프레이밍 정정
* **정합성 정정**: 파일 연동은 기존 Spring에서 미완성이 아닌, 이미 DB 영속성 및 FE 바인딩이 연계되어 동작하던 흐름이었습니다. 
* **구현 방향**: 기존의 연동 구조를 그대로 깔끔하게 이식하되, 결재 및 게시판 글 삭제 시 파일 스토리지의 고아 첨부파일 객체 방지용 참조 정합성 검증 및 백그라운드 클리너 성능 보강에 집중합니다.

---

## 5. TypeORM 엔티티 설계 세부 원칙

### 1) 자동 시간 갱신 정책
PostgreSQL 환경에서는 MySQL 전용 구문인 `onUpdate: 'CURRENT_TIMESTAMP'`가 적용되지 않습니다.  
엔티티의 영속 시간 추적을 위해 `@CreateDateColumn` 및 `@UpdateDateColumn`을 사용하거나 TypeORM Subscriber를 적용합니다.

```typescript
// backend/src/entities/base.entity.ts
export abstract class BaseEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'created_by', length: 50 })
  createdBy: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'updated_by', length: 50 })
  updatedBy: string;

  @Column({ name: 'delete_yn', length: 1, default: 'N' })
  deleteYn: string;
}
```

### 2) 복합 PK 지원 및 IdClass 불필요화
Spring의 복합 `@IdClass` 구조를 TypeORM에서는 복수 개의 `@PrimaryColumn()` 속성 지정만으로 매핑하여 불필요한 클래스 파일을 제거합니다.

---

## 6. DB 설정 및 마이그레이션 전략 (개발 환경 제외)

### 환경별 마이그레이션 정책
* **개발 환경 (Development)**:  
  * **Flyway를 자동/수동 실행하지 않습니다.**  
  * 개발 진행 중 스키마가 변경되는 경우, 개발자가 Supabase SQL Editor 혹은 기타 GUI DB 클라이언트를 사용해 수동으로 테이블이나 칼럼을 반영합니다.
  * 개발 완료 단계에서 최종 확정된 뼈대 DDL 스크립트를 작성하여 `backend/db/migrations/` 경로에 커밋합니다.
* **운영 환경 (Production)**:  
  * 배포 파이프라인(CI/CD) 혹은 Docker entrypoint를 통해 애플리케이션 시동 전 단계로 `npx node-flyway migrate` 또는 Supabase DB 마이그레이션 명령을 1회 호출해 운영 DB에 누적 DDL을 자동 반영합니다.

```env
# ========================================
# DB — Supabase PostgreSQL (Session Pooler)
# ========================================
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USERNAME=postgres.xxxxxxxxxxxxx
DB_PASSWORD=xxxxxxxxxxxxx

# 마이그레이션 스위치 (운영: true, 개발: false)
DB_MIGRATION_ENABLED=false

# ========================================
# JWT
# ========================================
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
JWT_EXPIRATION=1800

# ========================================
# Supabase Storage (S3 호환)
# ========================================
STORAGE_ENDPOINT=https://xxxxxxxxxxxxx.supabase.co/storage/v1/s3
STORAGE_REGION=ap-southeast-1
STORAGE_ACCESS_KEY=xxxxxxxxxxxxx
STORAGE_SECRET_KEY=xxxxxxxxxxxxx
STORAGE_BUCKET=cmms-files
STORAGE_RECONCILE_ENABLED=false
STORAGE_RECONCILE_GRACE_HOURS=24

# ========================================
# Server
# ========================================
PORT=8080
NODE_ENV=development
```

---

## 7. 구현 단계 및 일정

기능의 완성도와 결재/재고/구매 모듈 간의 결합 복잡도를 감안하여 기존의 낙관적 일정을 **8주(56일) 개발 및 통합 검증 일정**으로 안전 마진을 두어 조정합니다.

```
Week 1-2: Phase 0 (NestJS 프로젝트 세팅, tsconfig/strict, TypeORM 비동기 컨텍스트 구축 및 로컬 수동 DB 연결 검증)
Week 3  : Phase 1 (Auth 토큰 및 MDM 보안 가드 구축 - C1-sub 자가승격 및 C5 SYSTEM 차단 완료)
Week 4  : Phase 2 (설비 및 재고 마스터 데이터 이식, CSV 스트림 다운로드 기능 구현)
Week 5-6: Phase 3 (Sequence Service C3 및 Inventory Tx 비관적 락 NOWAIT + 마감 산식 M4 수정 완료)
Week 7  : Phase 4 (전자결재 다단계 결재선, 게시판 파일 연동 참조 검증 보강, 구매 모듈 이식)
Week 8  : Phase 5 (S3 파일 보관소 연동, 통합 검증 및 E2E 테스트, Vite Proxy 연동)
```
