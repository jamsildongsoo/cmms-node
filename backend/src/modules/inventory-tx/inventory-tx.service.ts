/* =========================================================================
   재고 처리 핵심 서비스 — 비관적 락 + 이동평균법
   난제 해결:
     - 비관적 락: SELECT ... FOR UPDATE NOWAIT + statement_timeout
     - 금액 정밀도: Decimal.js (BigDecimal 대응)
     - 데드락 방지: (warehouse_id, inventory_id) 기준 정렬 잠금
   ========================================================================= */
import { Injectable, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { getTenantContext } from '../../common/context/tenant.context';
import { TxType, MoveTxType } from '../../common/constants/status.constants';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface TxItem {
  txTypeCode: TxType;
  warehouseId: string;
  inventoryId: string;
  targetWarehouseId?: string; // MOVE 전용
  qty: string;                // Decimal-safe string
  unitPrice?: string;         // IN 전용, null이면 '0'
  txDate?: Date;
  docNo?: string;
  refNo?: string;
  refModule?: string;
}

export interface InventoryTxRequest {
  items: TxItem[];
}

interface StatusRow {
  company_id: string;
  warehouse_id: string;
  inventory_id: string;
  qty: string;
  amount: string;
  delete_yn: string;
}

@Injectable()
export class InventoryTxService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

  async processTransactions(request: InventoryTxRequest): Promise<void> {
    const { companyId, userId } = getTenantContext();

    if (!request.items?.length) return;

    // 1. 전표번호 일괄 채번 (items 중 docNo가 없으면 STK 채번)
    const userDept = await this.getUserDept(companyId, userId);
    let docNo = request.items.find((i) => i.docNo)?.docNo;
    if (!docNo) {
      docNo = await this.sequenceService.generateNextNo(companyId, AppModule.STK, userDept);
    }
    for (const item of request.items) {
      if (!item.docNo) item.docNo = docNo;
    }

    // 2. 데드락 방지: (warehouseId, inventoryId) 기준 정렬
    const keysToLock = this.extractSortedKeys(request.items);

    // 3. QueryRunner 트랜잭션 시작
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('READ COMMITTED');

    try {
      // 락 대기 한도(lock_timeout)는 data-source.config extra(전역 3초)로 일괄 관리.
      // FOR UPDATE NOWAIT는 충돌 시 lock_timeout과 무관하게 즉시 55P03 에러(고경합 빠른 실패용).
      const statusMap = new Map<string, StatusRow | null>();
      for (const key of keysToLock) {
        const rows = await qr.query(
          `SELECT * FROM inventory_status
           WHERE company_id = $1 AND warehouse_id = $2 AND inventory_id = $3
             AND delete_yn = 'N'
           FOR UPDATE NOWAIT`,
          [companyId, key.warehouseId, key.inventoryId],
        ) as any[];
        statusMap.set(`${key.warehouseId}:${key.inventoryId}`, rows[0] ?? null);
      }

      // 6. 비즈니스 로직 순차 수행
      for (const item of request.items) {
        const txDate = item.txDate ?? new Date();
        switch (item.txTypeCode.toUpperCase()) {
          case TxType.IN:
            await this.executeIn(qr, companyId, item, statusMap, txDate, userId);
            break;
          case TxType.OUT:
            await this.executeOut(qr, companyId, item, statusMap, txDate, userId);
            break;
          case TxType.MOVE:
            await this.executeMove(qr, companyId, item, statusMap, txDate, userId);
            break;
          case TxType.ADJ:
            await this.executeAdj(qr, companyId, item, statusMap, txDate, userId);
            break;
        }
      }

      await qr.commitTransaction();
    } catch (err: any) {
      await qr.rollbackTransaction();
      // PostgreSQL lock_not_available 에러 코드: 55P03
      if (err?.code === '55P03' || err?.message?.includes('could not obtain lock')) {
        throw new ConflictException('다른 사용자가 처리 중입니다. 잠시 후 다시 시도하세요.');
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  // -----------------------------------------------------------------------
  // 입고 (이동평균법 적용)
  // -----------------------------------------------------------------------
  private async executeIn(
    qr: any,
    companyId: string,
    item: TxItem,
    statusMap: Map<string, StatusRow | null>,
    txDate: Date,
    operator: string,
  ) {
    const key = `${item.warehouseId}:${item.inventoryId}`;
    let status = statusMap.get(key);

    const qty = new Decimal(item.qty);
    const price = new Decimal(item.unitPrice ?? '0');
    const amount = qty.mul(price);

    if (!status) {
      // 신규 재고 상태 행 INSERT
      await qr.query(
        `INSERT INTO inventory_status
           (company_id, warehouse_id, inventory_id, qty, amount, delete_yn, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,'N',$6,$6)`,
        [companyId, item.warehouseId, item.inventoryId,
         qty.toFixed(4), amount.toFixed(4), operator],
      );
    } else {
      const newQty = new Decimal(status.qty).add(qty);
      const newAmount = new Decimal(status.amount).add(amount);
      await qr.query(
        `UPDATE inventory_status SET qty=$1, amount=$2, updated_by=$3
         WHERE company_id=$4 AND warehouse_id=$5 AND inventory_id=$6`,
        [newQty.toFixed(4), newAmount.toFixed(4), operator,
         companyId, item.warehouseId, item.inventoryId],
      );
    }

    // 이력 INSERT
    await qr.query(
      `INSERT INTO inventory_history
         (company_id, warehouse_id, inventory_id, tx_type_code,
          qty, unit_price, amount, tx_date, user_id, doc_no,
          ref_no, ref_module, delete_yn, created_by, updated_by)
       VALUES ($1,$2,$3,'${TxType.IN}',$4,$5,$6,$7,$8,$9,$10,$11,'N',$8,$8)`,
      [companyId, item.warehouseId, item.inventoryId,
       qty.toFixed(4), price.toFixed(4), amount.toFixed(4),
       txDate, operator, item.docNo, item.refNo ?? null, item.refModule ?? null],
    );
  }

  // -----------------------------------------------------------------------
  // 출고 (현재 평균단가 계산)
  // -----------------------------------------------------------------------
  private async executeOut(
    qr: any,
    companyId: string,
    item: TxItem,
    statusMap: Map<string, StatusRow | null>,
    txDate: Date,
    operator: string,
  ) {
    const key = `${item.warehouseId}:${item.inventoryId}`;
    const status = statusMap.get(key);

    const currentQty = new Decimal(status?.qty ?? '0');
    const currentAmount = new Decimal(status?.amount ?? '0');
    const qty = new Decimal(item.qty);

    // 현재 평균단가
    const avgPrice = currentQty.gt(0)
      ? currentAmount.div(currentQty).toDecimalPlaces(4)
      : new Decimal(0);

    const amount = qty.mul(avgPrice);
    const newQty = Decimal.max(currentQty.sub(qty), 0);
    const newAmount = Decimal.max(currentAmount.sub(amount), 0);

    if (status) {
      await qr.query(
        `UPDATE inventory_status SET qty=$1, amount=$2, updated_by=$3
         WHERE company_id=$4 AND warehouse_id=$5 AND inventory_id=$6`,
        [newQty.toFixed(4), newAmount.toFixed(4), operator,
         companyId, item.warehouseId, item.inventoryId],
      );
    }

    await qr.query(
      `INSERT INTO inventory_history
         (company_id, warehouse_id, inventory_id, tx_type_code,
          qty, unit_price, amount, tx_date, user_id, doc_no,
          ref_no, ref_module, delete_yn, created_by, updated_by)
       VALUES ($1,$2,$3,'${TxType.OUT}',$4,$5,$6,$7,$8,$9,$10,$11,'N',$8,$8)`,
      [companyId, item.warehouseId, item.inventoryId,
       qty.negated().toFixed(4), avgPrice.toFixed(4), amount.negated().toFixed(4),
       txDate, operator, item.docNo, item.refNo ?? null, item.refModule ?? null],
    );
  }

  // -----------------------------------------------------------------------
  // 이동 (출고 창고 → 입고 창고)
  // -----------------------------------------------------------------------
  private async executeMove(
    qr: any,
    companyId: string,
    item: TxItem,
    statusMap: Map<string, StatusRow | null>,
    txDate: Date,
    operator: string,
  ) {
    // 출고 처리
    await this.executeOut(qr, companyId, item, statusMap, txDate, operator);
    // 입고 처리 (targetWarehouseId로 변환)
    const inItem: TxItem = { ...item, txTypeCode: TxType.IN, warehouseId: item.targetWarehouseId! };
    await this.executeIn(qr, companyId, inItem, statusMap, txDate, operator);
    // 이력의 tx_type_code를 MOVE_OUT / MOVE_IN으로 수정
    await qr.query(
      `UPDATE inventory_history SET tx_type_code='${MoveTxType.MOVE_OUT}'
       WHERE company_id=$1 AND warehouse_id=$2 AND inventory_id=$3
         AND doc_no=$4 AND tx_type_code='${TxType.OUT}' AND tx_date=$5`,
      [companyId, item.warehouseId, item.inventoryId, item.docNo, txDate],
    );
    await qr.query(
      `UPDATE inventory_history SET tx_type_code='${MoveTxType.MOVE_IN}'
       WHERE company_id=$1 AND warehouse_id=$2 AND inventory_id=$3
         AND doc_no=$4 AND tx_type_code='${TxType.IN}' AND tx_date=$5`,
      [companyId, item.targetWarehouseId, item.inventoryId, item.docNo, txDate],
    );
  }

  // -----------------------------------------------------------------------
  // 조정 (ADJ)
  // -----------------------------------------------------------------------
  private async executeAdj(
    qr: any,
    companyId: string,
    item: TxItem,
    statusMap: Map<string, StatusRow | null>,
    txDate: Date,
    operator: string,
  ) {
    const key = `${item.warehouseId}:${item.inventoryId}`;
    const status = statusMap.get(key);
    const adjQty = new Decimal(item.qty);
    const adjAmount = new Decimal(item.unitPrice ?? '0').mul(adjQty);

    const newQty = new Decimal(status?.qty ?? '0').add(adjQty);
    const newAmount = new Decimal(status?.amount ?? '0').add(adjAmount);

    if (status) {
      await qr.query(
        `UPDATE inventory_status SET qty=$1, amount=$2, updated_by=$3
         WHERE company_id=$4 AND warehouse_id=$5 AND inventory_id=$6`,
        [newQty.toFixed(4), newAmount.toFixed(4), operator,
         companyId, item.warehouseId, item.inventoryId],
      );
    }
    await qr.query(
      `INSERT INTO inventory_history
         (company_id, warehouse_id, inventory_id, tx_type_code,
          qty, unit_price, amount, tx_date, user_id, doc_no,
          delete_yn, created_by, updated_by)
       VALUES ($1,$2,$3,'${TxType.ADJ}',$4,$5,$6,$7,$8,$9,'N',$8,$8)`,
      [companyId, item.warehouseId, item.inventoryId,
       adjQty.toFixed(4), new Decimal(item.unitPrice ?? '0').toFixed(4), adjAmount.toFixed(4),
       txDate, operator, item.docNo],
    );
  }

  // -----------------------------------------------------------------------
  // 재고 마감 (M4 버그 해결 — 현재 재고 대신 해당 월 이력 집계)
  // -----------------------------------------------------------------------
  async closeMonth(closingYm: string, operator: string): Promise<void> {
    const { companyId } = getTenantContext();
    const year = parseInt(closingYm.slice(0, 4));
    const month = parseInt(closingYm.slice(4, 6));
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // 월말 마지막 날

    const statuses = await this.dataSource.query<StatusRow[]>(
      `SELECT * FROM inventory_status WHERE company_id=$1 AND delete_yn='N'`,
      [companyId],
    );

    for (const status of statuses) {
      // ✅ 해당 월 이력만 집계 (M4 버그 수정 핵심)
      const histories = await this.dataSource.query(
        `SELECT tx_type_code, qty, amount FROM inventory_history
         WHERE company_id=$1 AND warehouse_id=$2 AND inventory_id=$3
           AND tx_date >= $4 AND tx_date <= $5 AND delete_yn='N'`,
        [companyId, status.warehouse_id, status.inventory_id, startDate, endDate],
      );

      let inQty = new Decimal(0), inAmt = new Decimal(0);
      let outQty = new Decimal(0), outAmt = new Decimal(0);
      let moveQty = new Decimal(0), moveAmt = new Decimal(0);
      let adjQty = new Decimal(0), adjAmt = new Decimal(0);

      for (const h of histories) {
        const q = new Decimal(h.qty);
        const a = new Decimal(h.amount);
        switch (h.tx_type_code.toUpperCase()) {
          case TxType.IN:       inQty = inQty.add(q); inAmt = inAmt.add(a); break;
          case TxType.OUT:      outQty = outQty.add(q.abs()); outAmt = outAmt.add(a.abs()); break;
          case MoveTxType.MOVE_IN:  moveQty = moveQty.add(q); moveAmt = moveAmt.add(a); break;
          case MoveTxType.MOVE_OUT: moveQty = moveQty.add(q); moveAmt = moveAmt.add(a); break;
          case TxType.ADJ:      adjQty = adjQty.add(q); adjAmt = adjAmt.add(a); break;
        }
      }

      // 마감 수량 = 해당 월 이력 합산 (기존 현재 재고 사용 버그 수정)
      const closingQty = inQty.sub(outQty).add(moveQty).add(adjQty);
      const closingAmount = inAmt.sub(outAmt).add(moveAmt).add(adjAmt);

      await this.dataSource.query(
        `INSERT INTO inventory_monthly_closing
           (company_id, warehouse_id, inventory_id, closing_ym,
            in_qty, in_amount, out_qty, out_amount,
            move_qty, move_amount, adj_qty, adj_amount,
            closing_qty, closing_amount, delete_yn, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'N',$15,$15)
         ON CONFLICT (company_id, warehouse_id, inventory_id, closing_ym)
         DO UPDATE SET
           in_qty=$5, in_amount=$6, out_qty=$7, out_amount=$8,
           move_qty=$9, move_amount=$10, adj_qty=$11, adj_amount=$12,
           closing_qty=$13, closing_amount=$14, updated_by=$15`,
        [companyId, status.warehouse_id, status.inventory_id, closingYm,
         inQty.toFixed(4), inAmt.toFixed(4),
         outQty.toFixed(4), outAmt.toFixed(4),
         moveQty.toFixed(4), moveAmt.toFixed(4),
         adjQty.toFixed(4), adjAmt.toFixed(4),
         closingQty.toFixed(4), closingAmount.toFixed(4),
         operator],
      );
    }
  }

  // -----------------------------------------------------------------------
  // 조회
  // -----------------------------------------------------------------------
  async getStatusList(companyId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT * FROM inventory_status WHERE company_id = $1 AND delete_yn = 'N'`,
      [companyId],
    );
  }

  async getHistoryList(companyId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT * FROM inventory_history WHERE company_id = $1 AND delete_yn = 'N' ORDER BY history_no DESC`,
      [companyId],
    );
  }

  // -----------------------------------------------------------------------
  // 유틸
  // -----------------------------------------------------------------------
  private extractSortedKeys(items: TxItem[]): { warehouseId: string; inventoryId: string }[] {
    const keySet = new Set<string>();
    for (const item of items) {
      keySet.add(`${item.warehouseId}:${item.inventoryId}`);
      if (item.txTypeCode === TxType.MOVE && item.targetWarehouseId) {
        keySet.add(`${item.targetWarehouseId}:${item.inventoryId}`);
      }
    }
    return [...keySet]
      .sort()
      .map((k) => {
        const [warehouseId, inventoryId] = k.split(':');
        return { warehouseId, inventoryId };
      });
  }

  private async getUserDept(companyId: string, userId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT department_id FROM users WHERE company_id=$1 AND id=$2`,
      [companyId, userId],
    );
    return rows[0]?.department_id ?? null;
  }
}
