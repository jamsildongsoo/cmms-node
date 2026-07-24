import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { DocStatus } from '../../common/constants/status.constants';

@Injectable()
export class WorkPermitService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

  async getWorkPermitsByCompany(
    companyId: string,
    operator: string,
    searchType?: string,
    searchValue?: string,
  ): Promise<any[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator);
    const conditions = [`wp.company_id = $1`, `wp.delete_yn = 'N'`];
    const params: unknown[] = [companyId];
    if (activePlantId) {
      params.push(activePlantId);
      conditions.push(`wp.plant_id = $${params.length}`);
    }
    if (searchValue && ['id', 'title', 'supervisor'].includes(searchType || '')) {
      params.push(searchValue);
      const index = params.length;
      if (searchType === 'id') conditions.push(`wp.id ILIKE '%' || $${index} || '%'`);
      if (searchType === 'title') conditions.push(`wp.title ILIKE '%' || $${index} || '%'`);
      if (searchType === 'supervisor') {
        conditions.push(`(wp.supervisor_id ILIKE '%' || $${index} || '%' OR supervisor.name ILIKE '%' || $${index} || '%')`);
      }
    }
    return this.dataSource.query(
      `SELECT wp.*, wp.created_at as "createdAt", wp.created_by as "createdBy"
         FROM work_permit wp
         LEFT JOIN users supervisor
           ON wp.company_id = supervisor.company_id
          AND wp.supervisor_id = supervisor.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY wp.id DESC`,
      params,
    );
  }

  async getWorkPermitDetails(companyId: string, plantId: string, id: string, operator: string): Promise<any> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const permits = await this.dataSource.query(
      `SELECT wp.*, wp.created_at as "createdAt", wp.created_by as "createdBy"
         FROM work_permit wp
        WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id],
    );
    if (!permits.length) {
      throw new NotFoundException('작업허가서를 찾을 수 없습니다.');
    }
    return permits[0];
  }

  async saveWorkPermit(companyId: string, permit: any, operator: string): Promise<any> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, permit.plantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let wpId = permit.id;
      const isNew = !wpId || wpId.trim() === '';

      if (isNew) {
        wpId = await this.sequenceService.generateNextNo(companyId, AppModule.WP, permit.departmentId);
      }

      const stringifyJson = (val: any) => {
        if (!val) return null;
        return typeof val === 'object' ? JSON.stringify(val) : val;
      };

      const startAtStr = permit.startAt
        ? (permit.startAt instanceof Date ? permit.startAt.toISOString() : permit.startAt)
        : null;
      const endAtStr = permit.endAt
        ? (permit.endAt instanceof Date ? permit.endAt.toISOString() : permit.endAt)
        : null;

      if (isNew) {
        await qr.query(
          `INSERT INTO work_permit 
            (company_id, plant_id, id, equipment_id, work_order_id, title, step_stage, permit_type_codes, start_at, end_at, department_id, supervisor_id, work_summary, risk_factors, safety_measures, json_general, json_fire, json_confined, json_electric, json_high_place, json_excavation, json_heavy_load, remarks, file_group_id, ref_no, ref_module, approval_id, status, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $29, 'N')`,
          [
            companyId, activePlantId, wpId, permit.equipmentId, permit.workOrderId ?? null, permit.title,
            permit.stepStage, permit.permitTypeCodes, startAtStr, endAtStr, permit.departmentId,
            permit.supervisorId, permit.workSummary ?? null, permit.riskFactors ?? null, permit.safetyMeasures ?? null,
            stringifyJson(permit.jsonGeneral), stringifyJson(permit.jsonFire), stringifyJson(permit.jsonConfined),
            stringifyJson(permit.jsonElectric), stringifyJson(permit.jsonHighPlace), stringifyJson(permit.jsonExcavation),
            stringifyJson(permit.jsonHeavyLoad), permit.remarks ?? null, permit.fileGroupId ?? null,
            permit.refNo ?? null, permit.refModule ?? null, permit.approvalId ?? null, permit.status || DocStatus.TEMP, operator
          ],
        );
      } else {
        await qr.query(
          `UPDATE work_permit 
           SET equipment_id = $4, work_order_id = $5, title = $6, step_stage = $7, permit_type_codes = $8, start_at = $9, end_at = $10, department_id = $11, supervisor_id = $12, work_summary = $13, risk_factors = $14, safety_measures = $15, json_general = $16, json_fire = $17, json_confined = $18, json_electric = $19, json_high_place = $20, json_excavation = $21, json_heavy_load = $22, remarks = $23, file_group_id = $24, ref_no = $25, ref_module = $26, approval_id = $27, status = $28, updated_by = $29
           WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
          [
            companyId, activePlantId, wpId, permit.equipmentId, permit.workOrderId ?? null, permit.title,
            permit.stepStage, permit.permitTypeCodes, startAtStr, endAtStr, permit.departmentId,
            permit.supervisorId, permit.workSummary ?? null, permit.riskFactors ?? null, permit.safetyMeasures ?? null,
            stringifyJson(permit.jsonGeneral), stringifyJson(permit.jsonFire), stringifyJson(permit.jsonConfined),
            stringifyJson(permit.jsonElectric), stringifyJson(permit.jsonHighPlace), stringifyJson(permit.jsonExcavation),
            stringifyJson(permit.jsonHeavyLoad), permit.remarks ?? null, permit.fileGroupId ?? null,
            permit.refNo ?? null, permit.refModule ?? null, permit.approvalId ?? null, permit.status || DocStatus.TEMP, operator
          ],
        );
      }

      await qr.commitTransaction();

      const savedList = await this.dataSource.query(
        `SELECT * FROM work_permit WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
        [companyId, activePlantId, wpId],
      );
      return savedList[0];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async deleteWorkPermit(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    await this.dataSource.query(
      `UPDATE work_permit 
       SET delete_yn = 'Y', updated_by = $4 
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id, operator],
    );
  }
}
