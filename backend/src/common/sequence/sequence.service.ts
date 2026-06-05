/* =========================================================================
   SequenceService — 문서번호 채번
   C3 버그 해결: synchronized + @Transactional 대신 DB FOR UPDATE 잠금
   ========================================================================= */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { format } from 'date-fns';
import { AppModule } from '../constants/module.constants';

// 모듈 코드 단일 소스는 common/constants/module.constants.ts
export { AppModule, AppModuleLabel } from '../constants/module.constants';

@Injectable()
export class SequenceService {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 문서번호 채번: {module}-{dept}-{yyyyMM}-{0001}
   *
   * [C3 버그 해결] Spring의 synchronized + @Transactional 조합 대신
   * DB 레벨 SELECT FOR UPDATE로 직렬화 — 멀티 인스턴스에서도 정확
   */
  async generateNextNo(
    companyId: string,
    module: AppModule | string,
    departmentId: string | null,
  ): Promise<string> {
    const deptId = departmentId?.trim() || 'DEPT_ROOT';
    const yearMonth = format(new Date(), 'yyyyMM');

    // 세션 풀러(port 5432): FOR UPDATE 정상 작동 — 멀티 인스턴스에서도 DB 직렬화 보장
    try {
      // PostgreSQL의 단일 UPSERT-RETURNING 원자적 쿼리 수행
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
    } catch (err) {
      throw err;
    }
  }
}
