import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { getTenantContext } from '../../common/context/tenant.context';
import { DocStatus } from '../../common/constants/status.constants';
import { addDateOnly, toDateOnly } from '../../common/utils/date-only.util';

export interface PmScheduleResponse {
  equipmentId: string;
  equipmentName: string;
  plantId: string;
  checkTypeCode: string;
  cycleVal: number;
  cycleUnit: string;
  lastCheckDate: Date | string | null;
  nextCheckDate: Date | string | null;
}

export interface PmRecordResponse {
  companyId: string;
  plantId: string;
  id: string;
  title: string | null;
  equipmentId: string;
  equipmentName: string | null;
  departmentId: string;
  checkTypeCode: string;
  stepStage: string;
  cycleFrom: string | null;
  cycleEnd: string | null;
  closeYn: string;
  workDate: string;
  workerId: string;
  judgeCode: string;
  remarks: string | null;
  certNumber: string | null;
  certExpireDate: string | null;
  certAgency: string | null;
  approvalId: string | null;
  refNo: string | null;
  refModule: string | null;
  status: string;
}

export interface PmSaveRequest {
  pmRecord: {
    plantId: string;
    id?: string | null;
    title?: string | null;
    equipmentId: string;
    departmentId: string;
    checkTypeCode: string;
    stepStage?: string | null;
    cycleFrom?: string | null;
    cycleEnd?: string | null;
    workDate: string | Date;
    workerId: string;
    judgeCode: string;
    remarks?: string | null;
    certNumber?: string | null;
    certExpireDate?: string | Date | null;
    certAgency?: string | null;
    approvalId?: string | null;
    refNo?: string | null;
    refModule?: string | null;
    status: string;
  };
  checkItems: Array<{
    itemNo: number;
    checkName: string;
    checkMethod?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    baseValue?: number | null;
    unit?: string | null;
    checkValue?: number | null;
  }>;
}

export interface PmCheckTemplateItem {
  itemNo: number;
  checkName: string;
  checkMethod: string | null;
  minValue: string | null;
  maxValue: string | null;
  baseValue: string | null;
  unit: string | null;
}

@Injectable()
export class PmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

  // =========================================================================
  // 스케줄 조회 (참고용 — equipment_check_cycle 기반)
  // =========================================================================
  async getPmSchedules(companyId: string, targetDate: Date): Promise<PmScheduleResponse[]> {
    return this.dataSource.query(
      `SELECT
        c.equipment_id as "equipmentId",
        e.name as "equipmentName",
        c.plant_id as "plantId",
        c.check_type_code as "checkTypeCode",
        c.cycle_val as "cycleVal",
        c.cycle_unit as "cycleUnit",
        c.last_check_date as "lastCheckDate",
        c.next_check_date as "nextCheckDate"
      FROM equipment_check_cycle c
      JOIN equipment e
        ON c.company_id = e.company_id
       AND c.plant_id = e.plant_id
       AND c.equipment_id = e.id
      WHERE c.company_id = $1
        AND c.delete_yn = 'N'
        AND e.delete_yn = 'N'
        AND c.next_check_date IS NOT NULL
        AND c.next_check_date <= $2`,
      [companyId, targetDate],
    );
  }

  // =========================================================================
  // 목록 조회 (계획/실적 구분, 검색, 필터)
  // =========================================================================
  async getPmRecords(
    companyId: string,
    operator: string,
    stepStage?: string,
    searchType?: string,
    searchValue?: string,
    showAll?: string,
  ): Promise<PmRecordResponse[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator);
    const stage = stepStage ? stepStage.toUpperCase() : null;

    const baseSql = `SELECT
        p.company_id as "companyId",
        p.plant_id as "plantId",
        p.id,
        p.title,
        p.equipment_id as "equipmentId",
        e.name as "equipmentName",
        p.department_id as "departmentId",
        p.check_type_code as "checkTypeCode",
        p.step_stage as "stepStage",
        p.cycle_from as "cycleFrom",
        p.cycle_end as "cycleEnd",
        p.close_yn as "closeYn",
        p.work_date as "workDate",
        p.worker_id as "workerId",
        p.judge_code as "judgeCode",
        p.remarks,
        p.cert_number as "certNumber",
        p.cert_expire_date as "certExpireDate",
        p.cert_agency as "certAgency",
        p.approval_id as "approvalId",
        p.ref_no as "refNo",
        p.ref_module as "refModule",
        p.status
      FROM pm_record p
      LEFT JOIN equipment e
        ON p.company_id = e.company_id
       AND p.plant_id = e.plant_id
       AND p.equipment_id = e.id`;

    // 동적 WHERE 조건 빌드
    const conditions: string[] = [`p.company_id = $1`];
    const params: any[] = [companyId];
    let paramIdx = 2;

    if (activePlantId) {
      conditions.push(`p.plant_id = $${paramIdx}`);
      params.push(activePlantId);
      paramIdx++;
    }

    if (stage) {
      conditions.push(`p.step_stage = $${paramIdx}`);
      params.push(stage);
      paramIdx++;
    }

    // Active 필터 (기본: close_yn='N' AND cycle_end >= 오늘)
    if (showAll !== 'Y') {
      conditions.push(`p.close_yn = 'N'`);
      conditions.push(`(p.cycle_end IS NULL OR p.cycle_end >= CURRENT_DATE)`);
    }

    // 검색 조건
    if (searchType && searchValue) {
      let searchCond = '';
      if (searchType === 'id') {
        searchCond = `p.id ILIKE '%' || $${paramIdx} || '%'`;
      } else if (searchType === 'equipment') {
        searchCond = `(p.equipment_id ILIKE '%' || $${paramIdx} || '%' OR e.name ILIKE '%' || $${paramIdx} || '%')`;
      } else if (searchType === 'title') {
        searchCond = `p.title ILIKE '%' || $${paramIdx} || '%'`;
      } else if (searchType === 'date') {
        searchCond = `p.work_date::text = $${paramIdx}`;
      }
      if (searchCond) {
        conditions.push(`(${searchCond})`);
        params.push(searchValue);
        paramIdx++;
      }
    }

    const whereClause = conditions.join(' AND ');
    const sql = `${baseSql} WHERE ${whereClause} ORDER BY p.cycle_from DESC NULLS LAST, p.id DESC`;

    return this.dataSource.query(sql, params);
  }

  // =========================================================================
  // 상세 조회
  // =========================================================================
  async getPmRecordDetails(companyId: string, plantId: string, id: string, operator: string): Promise<PmSaveRequest> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const records = await this.dataSource.query(
      `SELECT
        company_id as "companyId",
        plant_id as "plantId",
        id,
        title,
        equipment_id as "equipmentId",
        department_id as "departmentId",
        check_type_code as "checkTypeCode",
        step_stage as "stepStage",
        cycle_from as "cycleFrom",
        cycle_end as "cycleEnd",
        close_yn as "closeYn",
        work_date as "workDate",
        worker_id as "workerId",
        judge_code as "judgeCode",
        remarks,
        cert_number as "certNumber",
        cert_expire_date as "certExpireDate",
        cert_agency as "certAgency",
        approval_id as "approvalId",
        ref_no as "refNo",
        ref_module as "refModule",
        status
       FROM pm_record WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id],
    );
    if (!records.length) {
      throw new NotFoundException('점검 기록을 찾을 수 없습니다.');
    }

    const items = await this.dataSource.query(
      `SELECT
        item_no as "itemNo",
        check_name as "checkName",
        check_method as "checkMethod",
        min_value as "minValue",
        max_value as "maxValue",
        base_value as "baseValue",
        unit,
        check_value as "checkValue"
      FROM pm_record_item
      WHERE company_id = $1 AND plant_id = $2 AND pm_record_id = $3
      ORDER BY item_no ASC`,
      [companyId, activePlantId, id],
    );

    return {
      pmRecord: records[0],
      checkItems: items,
    };
  }

  // =========================================================================
  // 점검 템플릿 조회 (pm_check_template)
  // =========================================================================
  async getCheckTemplates(
    companyId: string,
    plantId: string,
    checkTypeCode: string,
    operator: string,
  ): Promise<PmCheckTemplateItem[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    return this.dataSource.query(
      `SELECT
        item_no as "itemNo",
        check_name as "checkName",
        check_method as "checkMethod",
        min_value as "minValue",
        max_value as "maxValue",
        base_value as "baseValue",
        unit
      FROM pm_check_template
      WHERE company_id = $1 AND plant_id = $2 AND check_type_code = $3
      ORDER BY item_no ASC`,
      [companyId, activePlantId, checkTypeCode],
    );
  }

  // =========================================================================
  // 저장 (계획/실적 공용)
  // =========================================================================
  async savePmRecord(companyId: string, request: PmSaveRequest, operator: string): Promise<any> {
    const { pmRecord, checkItems } = request;
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, pmRecord.plantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let pmId = pmRecord.id;
      const isNew = !pmId || pmId.trim() === '';
      let previousStatus: string | null = null;
      const stepStage = (pmRecord.stepStage || 'R').toUpperCase();
      const refModule = pmRecord.refModule?.toUpperCase() ?? null;
      const refNo = pmRecord.refNo?.trim() || null;

      if (stepStage !== 'P' && stepStage !== 'R') {
        throw new BadRequestException('예방점검 단계는 P(계획) 또는 R(실적)만 가능합니다.');
      }
      if (stepStage === 'P' && (refModule || refNo)) {
        throw new BadRequestException('예방점검 계획은 참조 계획번호를 가질 수 없습니다.');
      }
      if (stepStage === 'R') {
        if (refModule !== AppModule.PM || !refNo) {
          throw new BadRequestException('예방점검 실적은 확정된 PM 계획번호를 참조해야 합니다.');
        }

        const plans = await qr.query(
          `SELECT * FROM pm_record
           WHERE company_id = $1 AND plant_id = $2 AND id = $3
             AND step_stage = 'P'
             AND status IN ($4, $5)
             AND delete_yn = 'N'
           FOR UPDATE`,
          [companyId, activePlantId, refNo, DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED],
        );
        if (!plans.length) {
          throw new BadRequestException('확정된 예방점검 계획에 대해서만 실적을 입력할 수 있습니다.');
        }
      }

      if (isNew) {
        pmId = await this.sequenceService.generateNextNo(companyId, AppModule.PM, pmRecord.departmentId);
      } else {
        const existing = await qr.query(
          `SELECT status FROM pm_record
           WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'
           FOR UPDATE`,
          [companyId, activePlantId, pmId],
        );
        previousStatus = existing[0]?.status ?? null;
      }

      const workDateStr = toDateOnly(pmRecord.workDate);
      const certExpireDateStr = pmRecord.certExpireDate
        ? toDateOnly(pmRecord.certExpireDate)
        : null;
      const cycleFromStr = pmRecord.cycleFrom ? toDateOnly(pmRecord.cycleFrom) : null;
      const cycleEndStr = pmRecord.cycleEnd ? toDateOnly(pmRecord.cycleEnd) : null;
      const titleStr = pmRecord.title?.trim() || null;

      if (isNew) {
        await qr.query(
          `INSERT INTO pm_record
            (company_id, plant_id, id, title, equipment_id, department_id, check_type_code, step_stage, cycle_from, cycle_end, close_yn, work_date, worker_id, judge_code, remarks, cert_number, cert_expire_date, cert_agency, approval_id, ref_no, ref_module, status, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23, 'N')`,
          [
            companyId, activePlantId, pmId, titleStr, pmRecord.equipmentId, pmRecord.departmentId, pmRecord.checkTypeCode,
            stepStage, cycleFromStr, cycleEndStr, stepStage === 'P' ? 'N' : null,
            workDateStr, pmRecord.workerId, pmRecord.judgeCode, pmRecord.remarks ?? null, pmRecord.certNumber ?? null,
            certExpireDateStr, pmRecord.certAgency ?? null, pmRecord.approvalId ?? null,
            stepStage === 'R' ? refNo : null,
            stepStage === 'R' ? refModule : null,
            pmRecord.status || DocStatus.TEMP, operator
          ],
        );
      } else {
        await qr.query(
          `UPDATE pm_record
           SET title = $4, equipment_id = $5, department_id = $6, check_type_code = $7, step_stage = $8, cycle_from = $9, cycle_end = $10, work_date = $11, worker_id = $12, judge_code = $13, remarks = $14, cert_number = $15, cert_expire_date = $16, cert_agency = $17, approval_id = $18, ref_no = $19, ref_module = $20, status = $21, updated_by = $22
           WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
          [
            companyId, activePlantId, pmId, titleStr, pmRecord.equipmentId, pmRecord.departmentId, pmRecord.checkTypeCode,
            stepStage, cycleFromStr, cycleEndStr,
            workDateStr, pmRecord.workerId, pmRecord.judgeCode, pmRecord.remarks ?? null, pmRecord.certNumber ?? null,
            certExpireDateStr, pmRecord.certAgency ?? null, pmRecord.approvalId ?? null,
            stepStage === 'R' ? refNo : null,
            stepStage === 'R' ? refModule : null,
            pmRecord.status || DocStatus.TEMP, operator
          ],
        );
      }

      // 항목 삭제 후 재삽입
      await qr.query(
        `DELETE FROM pm_record_item WHERE company_id = $1 AND plant_id = $2 AND pm_record_id = $3`,
        [companyId, activePlantId, pmId],
      );

      if (checkItems && checkItems.length > 0) {
        for (const item of checkItems) {
          await qr.query(
            `INSERT INTO pm_record_item
              (company_id, plant_id, pm_record_id, item_no, check_name, check_method, min_value, max_value, base_value, unit, check_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              companyId, activePlantId, pmId, item.itemNo, item.checkName, item.checkMethod ?? null,
              item.minValue ?? null, item.maxValue ?? null, item.baseValue ?? null, item.unit ?? null,
              stepStage === 'P' ? null : (item.checkValue ?? null)
            ],
          );
        }
      }

      // 실적 확정 시 점검주기 갱신
      const isFirstSelfConfirmation =
        stepStage === 'R' &&
        pmRecord.status === DocStatus.SELF_CONFIRMED &&
        previousStatus !== DocStatus.SELF_CONFIRMED &&
        previousStatus !== DocStatus.CONFIRMED;

      if (isFirstSelfConfirmation) {
        const confirmedResults = await qr.query(
          `SELECT id FROM pm_record
           WHERE company_id = $1
             AND plant_id = $2
             AND step_stage = 'R'
             AND ref_module = 'PM'
             AND ref_no = $3
             AND status IN ($4, $5)
             AND id <> $6
             AND delete_yn = 'N'`,
          [companyId, activePlantId, refNo, DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED, pmId],
        );
        if (confirmedResults.length > 0) {
          throw new BadRequestException('이미 확정된 예방점검 실적이 있는 계획입니다.');
        }

        const cycles = await qr.query(
          `SELECT * FROM equipment_check_cycle
           WHERE company_id = $1 AND plant_id = $2 AND equipment_id = $3 AND check_type_code = $4 AND delete_yn = 'N'`,
          [companyId, activePlantId, pmRecord.equipmentId, pmRecord.checkTypeCode],
        );

        if (cycles.length > 0) {
          const cycle = cycles[0];
          const nextDateStr = addDateOnly(workDateStr, Number(cycle.cycle_val), cycle.cycle_unit);

          await qr.query(
            `UPDATE equipment_check_cycle
             SET last_check_date = $5, next_check_date = $6, updated_by = $7
             WHERE company_id = $1 AND plant_id = $2 AND equipment_id = $3 AND check_type_code = $4`,
            [companyId, activePlantId, pmRecord.equipmentId, pmRecord.checkTypeCode, workDateStr, nextDateStr, operator],
          );
        }
      }

      await qr.commitTransaction();

      const savedList = await this.dataSource.query(
        `SELECT * FROM pm_record WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
        [companyId, activePlantId, pmId],
      );
      return savedList[0];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // =========================================================================
  // 계획 종료 (close_yn = 'Y')
  // =========================================================================
  async closePmPlan(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const result = await this.dataSource.query(
      `SELECT step_stage, close_yn FROM pm_record
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id],
    );
    if (!result.length) {
      throw new NotFoundException('예방점검 계획을 찾을 수 없습니다.');
    }
    if (result[0].step_stage !== 'P') {
      throw new BadRequestException('실적 문서는 종료할 수 없습니다.');
    }
    if (result[0].close_yn === 'Y') {
      throw new BadRequestException('이미 종료된 계획입니다.');
    }

    await this.dataSource.query(
      `UPDATE pm_record
       SET close_yn = 'Y', updated_by = $4
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id, operator],
    );
  }

  // =========================================================================
  // 삭제
  // =========================================================================
  async deletePmRecord(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const result = await this.dataSource.query(
      `SELECT step_stage FROM pm_record
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id],
    );
    if (!result.length) {
      throw new NotFoundException('예방점검 문서를 찾을 수 없습니다.');
    }
    if (result[0].step_stage === 'R') {
      // 실적이 참조하는 다른 실적이 있는지 확인 (ref_no = 현재 실적 id)
      const refs = await this.dataSource.query(
        `SELECT id FROM pm_record
         WHERE company_id = $1 AND plant_id = $2 AND ref_no = $3 AND step_stage = 'R' AND delete_yn = 'N'`,
        [companyId, activePlantId, id],
      );
      if (refs.length > 0) {
        throw new BadRequestException('참조하는 다른 실적이 있어 삭제할 수 없습니다.');
      }
    }

    await this.dataSource.query(
      `UPDATE pm_record
       SET delete_yn = 'Y', updated_by = $4
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id, operator],
    );
  }
}
