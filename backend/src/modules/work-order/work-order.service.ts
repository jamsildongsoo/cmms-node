import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { DocStatus } from '../../common/constants/status.constants';
import { toFixedSafe } from '../../common/utils/decimal.util';

export interface WorkOrderSaveRequest {
  workOrder: {
    plantId: string;
    id?: string | null;
    equipmentId: string;
    title: string;
    stepStage: string;
    woTypeCode: string;
    departmentId: string;
    workerId?: string | null;
    workDate?: Date | string | null;
    cost?: string;
    manHours?: string;
    manHoursUnit?: string;
    remarks?: string | null;
    fileGroupId?: string | number | null;
    refNo?: string | null;
    refModule?: string | null;
    approvalId?: string | null;
    status: string;
  };
  workItems: Array<{
    itemNo: number;
    workName: string;
    workMethod?: string | null;
    workResult?: string | null;
  }>;
}

@Injectable()
export class WorkOrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

  async getWorkOrdersByCompany(companyId: string, operator: string): Promise<any[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator);
    if (activePlantId) {
      return this.dataSource.query(
        `SELECT * FROM work_order WHERE company_id = $1 AND plant_id = $2 AND delete_yn = 'N' ORDER BY id DESC`,
        [companyId, activePlantId],
      );
    }
    return this.dataSource.query(
      `SELECT * FROM work_order WHERE company_id = $1 AND delete_yn = 'N' ORDER BY id DESC`,
      [companyId],
    );
  }

  async getWorkOrderDetails(companyId: string, plantId: string, id: string, operator: string): Promise<WorkOrderSaveRequest> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    const workOrders = await this.dataSource.query(
      `SELECT * FROM work_order WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id],
    );
    if (!workOrders.length) {
      throw new NotFoundException('작업 지시를 찾을 수 없습니다.');
    }

    const items = await this.dataSource.query(
      `SELECT 
        item_no as "itemNo",
        work_name as "workName",
        work_method as "workMethod",
        work_result as "workResult"
      FROM work_order_item 
      WHERE company_id = $1 AND plant_id = $2 AND work_order_id = $3 
      ORDER BY item_no ASC`,
      [companyId, activePlantId, id],
    );

    return {
      workOrder: workOrders[0],
      workItems: items,
    };
  }

  async saveWorkOrder(companyId: string, request: WorkOrderSaveRequest, operator: string): Promise<any> {
    const { workOrder, workItems } = request;
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, workOrder.plantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let woId = workOrder.id;
      const isNew = !woId || woId.trim() === '';

      if (isNew) {
        woId = await this.sequenceService.generateNextNo(companyId, AppModule.WO, workOrder.departmentId);
      }

      const workDateStr = workOrder.workDate
        ? (workOrder.workDate instanceof Date ? workOrder.workDate.toISOString().split('T')[0] : workOrder.workDate)
        : null;

      if (isNew) {
        await qr.query(
          `INSERT INTO work_order 
            (company_id, plant_id, id, equipment_id, title, step_stage, wo_type_code, department_id, worker_id, work_date, cost, man_hours, man_hours_unit, remarks, file_group_id, ref_no, ref_module, approval_id, status, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20, 'N')`,
          [
            companyId, activePlantId, woId, workOrder.equipmentId, workOrder.title, workOrder.stepStage,
            workOrder.woTypeCode, workOrder.departmentId, workOrder.workerId ?? null, workDateStr,
            toFixedSafe(workOrder.cost, 2), toFixedSafe(workOrder.manHours, 2), workOrder.manHoursUnit || 'H',
            workOrder.remarks ?? null, workOrder.fileGroupId ?? null, workOrder.refNo ?? null,
            workOrder.refModule ?? null, workOrder.approvalId ?? null, workOrder.status || DocStatus.TEMP, operator
          ],
        );
      } else {
        await qr.query(
          `UPDATE work_order 
           SET equipment_id = $4, title = $5, step_stage = $6, wo_type_code = $7, department_id = $8, worker_id = $9, work_date = $10, cost = $11, man_hours = $12, man_hours_unit = $13, remarks = $14, file_group_id = $15, ref_no = $16, ref_module = $17, approval_id = $18, status = $19, updated_by = $20
           WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
          [
            companyId, activePlantId, woId, workOrder.equipmentId, workOrder.title, workOrder.stepStage,
            workOrder.woTypeCode, workOrder.departmentId, workOrder.workerId ?? null, workDateStr,
            toFixedSafe(workOrder.cost, 2), toFixedSafe(workOrder.manHours, 2), workOrder.manHoursUnit || 'H',
            workOrder.remarks ?? null, workOrder.fileGroupId ?? null, workOrder.refNo ?? null,
            workOrder.refModule ?? null, workOrder.approvalId ?? null, workOrder.status || DocStatus.TEMP, operator
          ],
        );
      }

      await qr.query(
        `DELETE FROM work_order_item WHERE company_id = $1 AND plant_id = $2 AND work_order_id = $3`,
        [companyId, activePlantId, woId],
      );

      if (workItems && workItems.length > 0) {
        for (const item of workItems) {
          await qr.query(
            `INSERT INTO work_order_item
              (company_id, plant_id, work_order_id, item_no, work_name, work_method, work_result)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              companyId, activePlantId, woId, item.itemNo, item.workName,
              item.workMethod ?? null, item.workResult ?? null
            ],
          );
        }
      }

      await qr.commitTransaction();

      const savedList = await this.dataSource.query(
        `SELECT * FROM work_order WHERE company_id = $1 AND plant_id = $2 AND id = $3`,
        [companyId, activePlantId, woId],
      );
      return savedList[0];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async deleteWorkOrder(companyId: string, plantId: string, id: string, operator: string): Promise<void> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, plantId);
    await this.dataSource.query(
      `UPDATE work_order 
       SET delete_yn = 'Y', updated_by = $4 
       WHERE company_id = $1 AND plant_id = $2 AND id = $3 AND delete_yn = 'N'`,
      [companyId, activePlantId, id, operator],
    );
  }
}
