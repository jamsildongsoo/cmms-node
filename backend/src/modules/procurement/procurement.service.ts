import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { InventoryTxService } from '../inventory-tx/inventory-tx.service';
import { DocStatus, ProcStatus, TxType } from '../../common/constants/status.constants';
import { resolveActivePlantId } from '../../common/utils/plant.util';

export interface ItemLine {
  lineNo: number;
  inventoryId: string;
  qty: string;
  unit?: string | null;
  remarks?: string | null;
}

export interface SaveRequest {
  header: {
    id?: string | null;
    plantId?: string | null;
    warehouseId: string;
    requestDate?: string | Date;
    requestType?: string | null;
    vendorId?: string | null;
    remarks?: string | null;
    status?: string;
  };
  items?: ItemLine[];
  confirm?: boolean;
}

export interface RequestDetail {
  header: any;
  items: ItemLine[];
}

export interface OrderRequest {
  requestId: string;
  vendorId: string;
  orderDate?: string | Date;
  etaDate?: string | Date;
}

export interface ShipRequest {
  requestId: string;
  shipStartDate?: string | Date;
}

export interface ReceiveLine {
  lineNo: number;
  qty: string;
  unitPrice: string;
}

export interface ReceiveRequest {
  requestId: string;
  txDate?: string | Date;
  lines?: ReceiveLine[];
  close?: boolean;
}

@Injectable()
export class ProcurementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly inventoryTxService: InventoryTxService,
  ) {}

  async getRequests(companyId: string, operator: string, reqPlantId?: string | null): Promise<any[]> {
    const activePlant = await resolveActivePlantId(this.dataSource, companyId, operator, reqPlantId);
    if (!activePlant) {
      return this.dataSource.query(
        `SELECT * FROM purchase_request WHERE company_id = $1 AND delete_yn = 'N' ORDER BY id DESC`,
        [companyId],
      );
    }
    return this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND plant_id = $2 AND delete_yn = 'N' ORDER BY id DESC`,
      [companyId, activePlant],
    );
  }

  async getRequestDetail(companyId: string, id: string): Promise<RequestDetail> {
    const prs = await this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
      [companyId, id],
    );
    if (!prs.length) {
      throw new NotFoundException('구매요청을 찾을 수 없습니다.');
    }

    const items = await this.dataSource.query(
      `SELECT 
        line_no as "lineNo",
        inventory_id as "inventoryId",
        qty,
        unit,
        remarks
      FROM purchase_request_item 
      WHERE company_id = $1 AND request_id = $2 
      ORDER BY line_no ASC`,
      [companyId, id],
    );

    return {
      header: prs[0],
      items,
    };
  }

  async createOrUpdate(companyId: string, req: SaveRequest, operator: string): Promise<any> {
    const { header, items, confirm } = req;
    const isNew = !header.id || header.id.trim() === '';

    const userRows = await this.dataSource.query(
      `SELECT department_id, role_id, last_login_plant_id FROM users WHERE company_id = $1 AND id = $2`,
      [companyId, operator],
    );
    if (!userRows.length) {
      throw new BadRequestException('사용자 정보를 찾을 수 없습니다.');
    }
    const user = userRows[0];

    const multi = await this.isMultiPlant(companyId, user.role_id);
    let targetPlantId = header.plantId;
    if (!multi) {
      if (!user.last_login_plant_id) {
        throw new BadRequestException('지정 플랜트가 없어 구매요청을 생성할 수 없습니다.');
      }
      targetPlantId = user.last_login_plant_id;
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let prNo = header.id;
      const requestDateStr = header.requestDate
        ? (header.requestDate instanceof Date ? header.requestDate.toISOString().split('T')[0] : header.requestDate)
        : new Date().toISOString().split('T')[0];

      if (isNew) {
        prNo = await this.sequenceService.generateNextNo(companyId, AppModule.PUR, user.department_id);
        await qr.query(
          `INSERT INTO purchase_request 
            (company_id, id, plant_id, warehouse_id, requester_id, request_date, request_type, vendor_id, status, proc_status, remarks, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '${DocStatus.TEMP}', NULL, $9, $10, $10, 'N')`,
          [
            companyId, prNo, targetPlantId, header.warehouseId, operator, requestDateStr,
            header.requestType ?? null, header.vendorId ?? null, header.remarks ?? null, operator
          ],
        );
      } else {
        const existing = await qr.query(
          `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2 AND delete_yn = 'N' FOR UPDATE`,
          [companyId, prNo],
        );
        if (!existing.length) {
          throw new NotFoundException('구매요청을 찾을 수 없습니다.');
        }
        if (existing[0].status !== DocStatus.TEMP) {
          throw new BadRequestException('저장 상태(T)에서만 수정할 수 있습니다.');
        }

        await qr.query(
          `UPDATE purchase_request 
           SET warehouse_id = $3, request_type = $4, remarks = $5, updated_by = $6
           WHERE company_id = $1 AND id = $2`,
          [companyId, prNo, header.warehouseId, header.requestType ?? null, header.remarks ?? null, operator],
        );

        await qr.query(
          `DELETE FROM purchase_request_item WHERE company_id = $1 AND request_id = $2`,
          [companyId, prNo],
        );
      }

      if (items && items.length > 0) {
        let lineNo = 1;
        for (const item of items) {
          await qr.query(
            `INSERT INTO purchase_request_item 
              (company_id, request_id, line_no, inventory_id, qty, unit, received_qty, remarks)
             VALUES ($1, $2, $3, $4, $5, $6, '0', $7)`,
            [companyId, prNo, lineNo++, item.inventoryId, new Decimal(item.qty).toFixed(4), item.unit ?? null, item.remarks ?? null],
          );
        }
      }

      if (confirm) {
        await qr.query(
          `UPDATE purchase_request SET status = '${DocStatus.SELF_CONFIRMED}', updated_by = $3 WHERE company_id = $1 AND id = $2`,
          [companyId, prNo, operator],
        );
      }

      await qr.commitTransaction();

      const saved = await this.dataSource.query(
        `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2`,
        [companyId, prNo],
      );
      return saved[0];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async confirm(companyId: string, requestId: string, operator: string): Promise<any> {
    const pr = await this.mustGetActive(companyId, requestId);
    if (pr.status !== DocStatus.TEMP) {
      throw new BadRequestException('저장 상태(T)에서만 확정할 수 있습니다.');
    }

    await this.dataSource.query(
      `UPDATE purchase_request SET status = '${DocStatus.SELF_CONFIRMED}', updated_by = $3 WHERE company_id = $1 AND id = $2`,
      [companyId, requestId, operator],
    );

    const saved = await this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2`,
      [companyId, requestId],
    );
    return saved[0];
  }

  async placeOrder(companyId: string, req: OrderRequest, operator: string): Promise<any> {
    const pr = await this.mustGetConfirmed(companyId, req.requestId);
    const orderDateStr = req.orderDate
      ? (req.orderDate instanceof Date ? req.orderDate.toISOString().split('T')[0] : req.orderDate)
      : new Date().toISOString().split('T')[0];
    const etaDateStr = req.etaDate
      ? (req.etaDate instanceof Date ? req.etaDate.toISOString().split('T')[0] : req.etaDate)
      : null;

    await this.dataSource.query(
      `UPDATE purchase_request 
       SET vendor_id = $3, order_date = $4, eta_date = $5, proc_status = '${ProcStatus.ORDERED}', updated_by = $6
       WHERE company_id = $1 AND id = $2`,
      [companyId, req.requestId, req.vendorId, orderDateStr, etaDateStr, operator],
    );

    const saved = await this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2`,
      [companyId, req.requestId],
    );
    return saved[0];
  }

  async startShipping(companyId: string, req: ShipRequest, operator: string): Promise<any> {
    const pr = await this.mustGetConfirmed(companyId, req.requestId);
    const shipStartDateStr = req.shipStartDate
      ? (req.shipStartDate instanceof Date ? req.shipStartDate.toISOString().split('T')[0] : req.shipStartDate)
      : new Date().toISOString().split('T')[0];

    await this.dataSource.query(
      `UPDATE purchase_request 
       SET ship_start_date = $3, proc_status = '${ProcStatus.SHIPPING}', updated_by = $4
       WHERE company_id = $1 AND id = $2`,
      [companyId, req.requestId, shipStartDateStr, operator],
    );

    const saved = await this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2`,
      [companyId, req.requestId],
    );
    return saved[0];
  }

  async close(companyId: string, requestId: string, operator: string): Promise<any> {
    const pr = await this.mustGetConfirmed(companyId, requestId);
    if (pr.proc_status === ProcStatus.CLOSED) {
      throw new BadRequestException('이미 종료된 요청입니다.');
    }

    await this.dataSource.query(
      `UPDATE purchase_request 
       SET proc_status = '${ProcStatus.CLOSED}', updated_by = $3
       WHERE company_id = $1 AND id = $2`,
      [companyId, requestId, operator],
    );

    const saved = await this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2`,
      [companyId, requestId],
    );
    return saved[0];
  }

  async receive(companyId: string, req: ReceiveRequest, operator: string): Promise<any> {
    const pr = await this.mustGetConfirmed(companyId, req.requestId);
    if (pr.proc_status === ProcStatus.CLOSED) {
      throw new BadRequestException('종료된 요청에는 입고할 수 없습니다.');
    }
    if (!req.lines || req.lines.length === 0) {
      throw new BadRequestException('입고 라인이 비어 있습니다.');
    }

    const prItems = await this.dataSource.query(
      `SELECT * FROM purchase_request_item WHERE company_id = $1 AND request_id = $2`,
      [companyId, pr.id],
    );

    const userRows = await this.dataSource.query(
      `SELECT department_id FROM users WHERE company_id = $1 AND id = $2`,
      [companyId, operator],
    );
    const userDept = userRows[0]?.department_id ?? null;
    const docNo = await this.sequenceService.generateNextNo(companyId, AppModule.STK, userDept);
    const txDateStr = req.txDate
      ? (req.txDate instanceof Date ? req.txDate.toISOString().split('T')[0] : req.txDate)
      : new Date().toISOString().split('T')[0];

    const txItems: any[] = [];
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      for (const line of req.lines) {
        const prItem = prItems.find((it: any) => it.line_no === line.lineNo);
        if (!prItem) {
          throw new BadRequestException(`PR 라인 ${line.lineNo}을 찾을 수 없습니다.`);
        }

        const qtyDecimal = new Decimal(line.qty);
        const unitPriceDecimal = new Decimal(line.unitPrice);

        txItems.push({
          txTypeCode: TxType.IN,
          warehouseId: pr.warehouse_id,
          inventoryId: prItem.inventory_id,
          qty: qtyDecimal.toString(),
          unitPrice: unitPriceDecimal.toString(),
          txDate: new Date(txDateStr),
          docNo,
          refNo: pr.id,
          refModule: AppModule.PUR,
        });

        const newReceivedQty = new Decimal(prItem.received_qty).add(qtyDecimal);
        await qr.query(
          `UPDATE purchase_request_item SET received_qty = $4 
           WHERE company_id = $1 AND request_id = $2 AND line_no = $3`,
          [companyId, pr.id, line.lineNo, newReceivedQty.toFixed(4)],
        );
      }

      await this.inventoryTxService.processTransactions({ items: txItems });

      const finalProcStatus = req.close ? ProcStatus.CLOSED : ProcStatus.RECEIVED;
      await qr.query(
        `UPDATE purchase_request SET proc_status = $3, updated_by = $4 WHERE company_id = $1 AND id = $2`,
        [companyId, pr.id, finalProcStatus, operator],
      );

      await qr.commitTransaction();

      const saved = await this.dataSource.query(
        `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2`,
        [companyId, pr.id],
      );
      return saved[0];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async cancelSlip(companyId: string, docNo: string, operator: string): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT * FROM inventory_history WHERE company_id = $1 AND doc_no = $2 ORDER BY history_no ASC`,
      [companyId, docNo],
    );
    if (!rows.length) {
      throw new BadRequestException(`전표를 찾을 수 없습니다: ${docNo}`);
    }

    const firstType = rows[0].tx_type_code;
    if (firstType !== TxType.IN && firstType !== TxType.OUT) {
      throw new BadRequestException(`IN/OUT 전표만 취소 가능합니다 (현재: ${firstType}).`);
    }

    let prId: string | null = null;
    for (const h of rows) {
      if (h.tx_type_code !== firstType) {
        throw new BadRequestException('동일 전표 내 거래 타입이 일관되지 않습니다.');
      }
      if (!prId && h.ref_module === AppModule.PUR) {
        prId = h.ref_no;
      }

      const subsequent = await this.dataSource.query(
        `SELECT 1 FROM inventory_history 
         WHERE company_id = $1 AND warehouse_id = $2 AND inventory_id = $3 AND history_no > $4 
         LIMIT 1`,
        [companyId, h.warehouse_id, h.inventory_id, h.history_no],
      );
      if (subsequent.length > 0) {
        throw new BadRequestException(`후속 거래가 있어 취소할 수 없습니다 (품목 ${h.inventory_id}).`);
      }
    }

    const reverseType = firstType === TxType.IN ? TxType.OUT : TxType.IN;
    const txItems: any[] = [];
    for (const h of rows) {
      const qtyDecimal = new Decimal(h.qty).abs();
      const tx: any = {
        warehouseId: h.warehouse_id,
        inventoryId: h.inventory_id,
        txTypeCode: reverseType,
        qty: qtyDecimal.toString(),
        txDate: new Date(),
        docNo,
        refNo: h.ref_no,
        refModule: h.ref_module,
      };

      if (firstType === TxType.OUT) {
        tx.unitPrice = new Decimal(h.unit_price).toString();
      }
      txItems.push(tx);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await this.inventoryTxService.processTransactions({ items: txItems });

      if (firstType === TxType.IN && prId) {
        const prItems = await qr.query(
          `SELECT * FROM purchase_request_item WHERE company_id = $1 AND request_id = $2`,
          [companyId, prId],
        );

        for (const h of rows) {
          const prItem = prItems.find((pri: any) => pri.inventory_id === h.inventory_id);
          if (prItem) {
            const currentReceived = new Decimal(prItem.received_qty);
            const historyQty = new Decimal(h.qty);
            const updatedReceived = Decimal.max(currentReceived.sub(historyQty), 0);

            await qr.query(
              `UPDATE purchase_request_item SET received_qty = $4 
               WHERE company_id = $1 AND request_id = $2 AND line_no = $3`,
              [companyId, prId, prItem.line_no, updatedReceived.toFixed(4)],
            );
          }
        }
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async deleteRequest(companyId: string, requestId: string, operator: string): Promise<void> {
    const pr = await this.mustGetActive(companyId, requestId);
    if (pr.status !== DocStatus.TEMP) {
      throw new BadRequestException('저장 상태(T)에서만 삭제할 수 있습니다. 확정 이후는 종료(E)로 처리하세요.');
    }
    await this.dataSource.query(
      `UPDATE purchase_request SET delete_yn = 'Y', updated_by = $3 
       WHERE company_id = $1 AND id = $2`,
      [companyId, requestId, operator],
    );
  }

  private async mustGetActive(companyId: string, requestId: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT * FROM purchase_request WHERE company_id = $1 AND id = $2 AND delete_yn = 'N'`,
      [companyId, requestId],
    );
    if (!rows.length) {
      throw new NotFoundException('구매요청을 찾을 수 없습니다.');
    }
    return rows[0];
  }

  private async mustGetConfirmed(companyId: string, requestId: string): Promise<any> {
    const pr = await this.mustGetActive(companyId, requestId);
    if (pr.status !== DocStatus.SELF_CONFIRMED) {
      throw new BadRequestException('확정(S) 상태가 아닙니다.');
    }
    return pr;
  }

  private async isMultiPlant(companyId: string, roleId: string | null): Promise<boolean> {
    if (!roleId) return false;
    const rows = await this.dataSource.query(
      `SELECT multi_plant FROM role WHERE company_id = $1 AND id = $2`,
      [companyId, roleId],
    );
    return rows[0]?.multi_plant === 'Y';
  }

}
