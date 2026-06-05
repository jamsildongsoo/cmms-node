import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { getTenantContext } from '../../common/context/tenant.context';
import { DocStatus } from '../../common/constants/status.constants';

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

export interface PmSaveRequest {
  pmRecord: {
    plantId: string;
    id?: string | null;
    equipmentId: string;
    departmentId: string;
    checkTypeCode: string;
    workDate: string | Date;
    workerId: string;
    judgeCode: string;
    remarks?: string | null;
    certNumber?: string | null;
    certExpireDate?: string | Date | null;
    certAgency?: string | null;
    approvalId?: string | null;
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

@Injectable()
export class PmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

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

  async getPmRecordsByCompany(companyId: string, operator: string): Promise<any[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator);
    if (activePlantId) {
      return this.dataSource.query(
        `SELECT * FROM pm_record WHERE company_id = $1 AND plant_id = $2 AND delete_yn = 'N' ORDER BY id DESC`,
        [companyId, activePlantId],
      );
    }
    return this.dataSource.query(
      `SELECT * FROM pm_record WHERE company_id = $1 AND delete_yn = 'N' ORDER BY id DESC`,
      [companyId],
    );
  }

  async getPmRecordDetails(companyId: string, plantId: string, id: string, operator: string): Promise<PmSaveRequest> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const records = await this.dataSource.query(
      `SELECT * FROM pm_record WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
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

  async getInitialCheckItems(companyId: string, plantId: string, equipmentId: string, operator: string): Promise<any[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const items = await this.dataSource.query(
      `SELECT 
        item_no as "itemNo",
        check_name as "checkName",
        check_method as "checkMethod",
        min_value as "minValue",
        max_value as "maxValue",
        base_value as "baseValue",
        unit,
        NULL as "checkValue"
      FROM equipment_check_item
      WHERE company_id = $1 AND plant_id = $2 AND equipment_id = $3
      ORDER BY item_no ASC`,
      [companyId, activePlantId, equipmentId],
    );

    return items;
  }

  async savePmRecord(companyId: string, request: PmSaveRequest, operator: string): Promise<any> {
    const { pmRecord, checkItems } = request;
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, pmRecord.plantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let pmId = pmRecord.id;
      const isNew = !pmId || pmId.trim() === '';

      if (isNew) {
        pmId = await this.sequenceService.generateNextNo(companyId, AppModule.PM, pmRecord.departmentId);
      }

      const workDateStr = pmRecord.workDate instanceof Date ? pmRecord.workDate.toISOString().split('T')[0] : pmRecord.workDate;
      const certExpireDateStr = pmRecord.certExpireDate
        ? (pmRecord.certExpireDate instanceof Date ? pmRecord.certExpireDate.toISOString().split('T')[0] : pmRecord.certExpireDate)
        : null;

      if (isNew) {
        await qr.query(
          `INSERT INTO pm_record 
            (company_id, plant_id, id, equipment_id, department_id, check_type_code, work_date, worker_id, judge_code, remarks, cert_number, cert_expire_date, cert_agency, approval_id, status, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, 'N')`,
          [
            companyId, activePlantId, pmId, pmRecord.equipmentId, pmRecord.departmentId, pmRecord.checkTypeCode,
            workDateStr, pmRecord.workerId, pmRecord.judgeCode, pmRecord.remarks ?? null, pmRecord.certNumber ?? null,
            certExpireDateStr, pmRecord.certAgency ?? null, pmRecord.approvalId ?? null, pmRecord.status || DocStatus.TEMP, operator
          ],
        );
      } else {
        await qr.query(
          `UPDATE pm_record 
           SET equipment_id = $4, department_id = $5, check_type_code = $6, work_date = $7, worker_id = $8, judge_code = $9, remarks = $10, cert_number = $11, cert_expire_date = $12, cert_agency = $13, approval_id = $14, status = $15, updated_by = $16
           WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
          [
            companyId, activePlantId, pmId, pmRecord.equipmentId, pmRecord.departmentId, pmRecord.checkTypeCode,
            workDateStr, pmRecord.workerId, pmRecord.judgeCode, pmRecord.remarks ?? null, pmRecord.certNumber ?? null,
            certExpireDateStr, pmRecord.certAgency ?? null, pmRecord.approvalId ?? null, pmRecord.status || DocStatus.TEMP, operator
          ],
        );
      }

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
              item.minValue ?? null, item.maxValue ?? null, item.baseValue ?? null, item.unit ?? null, item.checkValue ?? null
            ],
          );
        }
      }

      if (pmRecord.status === DocStatus.SELF_CONFIRMED || pmRecord.status === DocStatus.CONFIRMED) {
        const cycles = await qr.query(
          `SELECT * FROM equipment_check_cycle 
           WHERE company_id = $1 AND plant_id = $2 AND equipment_id = $3 AND check_type_code = $4 AND delete_yn = 'N'`,
          [companyId, activePlantId, pmRecord.equipmentId, pmRecord.checkTypeCode],
        );

        if (cycles.length > 0) {
          const cycle = cycles[0];
          const lastDate = new Date(workDateStr);
          const nextDate = this.calculateNextDate(lastDate, cycle.cycle_val, cycle.cycle_unit);
          const nextDateStr = nextDate.toISOString().split('T')[0];

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

  async deletePmRecord(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    await this.dataSource.query(
      `UPDATE pm_record 
       SET delete_yn = 'Y', updated_by = $4 
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id, operator],
    );
  }

  private calculateNextDate(lastDate: Date, val: number, unit: string): Date {
    const u = unit.toUpperCase();
    switch (u) {
      case 'D': return addDays(lastDate, val);
      case 'W': return addWeeks(lastDate, val);
      case 'M': return addMonths(lastDate, val);
      case 'Y': return addYears(lastDate, val);
      default: return addMonths(lastDate, val);
    }
  }
}
