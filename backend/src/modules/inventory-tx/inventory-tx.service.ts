import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Between, DataSource, LessThan, QueryRunner } from 'typeorm';
import Decimal from 'decimal.js';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { getTenantContext } from '../../common/context/tenant.context';
import {
  TxType,
  MoveTxType,
  TxReason,
} from '../../common/constants/status.constants';
import { InventoryStatus } from '../../entities/inventory-status.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';
import { InventoryMonthlyClosing } from '../../entities/inventory-monthly-closing.entity';
import { InventoryClosing } from '../../entities/inventory-closing.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface TxItem {
  txTypeCode: TxType;
  txReasonCode?: TxReason;
  warehouseId: string;
  inventoryId: string;
  targetWarehouseId?: string;
  qty: string;
  unitPrice?: string;
  txDate?: Date | string;
  docNo?: string;
  refNo?: string;
  refModule?: string;
  refLineNo?: string;
}
export interface InventoryTxRequest { items: TxItem[] }
export interface InventoryTxContext {
  runner: QueryRunner;
  companyId: string;
  userId: string;
}

@Injectable()
export class InventoryTxService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
  ) {}

  async processTransactions(
    request: InventoryTxRequest,
    context?: InventoryTxContext,
  ): Promise<void> {
    const tenant = context ?? getTenantContext();
    const { companyId, userId } = tenant;
    if (!request.items?.length) return;
    const transactionMonths = new Set(
      request.items.map((item) => this.toDateOnly(item.txDate ?? new Date()).slice(0, 7).replace('-', '')),
    );
    const userDept = await this.getUserDept(companyId, userId);
    const generated = request.items.find((item) => item.docNo)?.docNo
      ?? await this.sequenceService.generateNextNo(companyId, AppModule.STK, userDept);
    request.items.forEach((item) => { item.docNo ||= generated; });
    const keys = this.extractSortedKeys(request.items);
    const ownsTransaction = !context;
    const runner = context?.runner ?? this.dataSource.createQueryRunner();
    if (ownsTransaction) {
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
    }
    try {
      for (const closingYm of [...transactionMonths].sort()) {
        // 월마감과 같은 키를 잠가 마감 집계 중 수불이 끼어들지 못하게 한다.
        await runner.query(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          [`inventory-closing:${companyId}:${closingYm}`],
        );
        const [closed, legacyClosed] = await Promise.all([
          runner.manager.getRepository(InventoryClosing).count({
            where: { companyId, closingYm, status: 'CLOSED', deleteYn: 'N' },
          }),
          runner.manager.getRepository(InventoryMonthlyClosing).count({
            where: { companyId, closingYm, deleteYn: 'N' },
          }),
        ]);
        if (closed > 0 || legacyClosed > 0) {
          throw new BadRequestException(
            `${closingYm.slice(0, 4)}-${closingYm.slice(4)}월은 이미 마감되어 재고 처리할 수 없습니다.`,
          );
        }
      }
      const statuses = new Map<string, InventoryStatus | null>();
      for (const key of keys) {
        const status = await runner.manager.getRepository(InventoryStatus)
          .createQueryBuilder('status')
          .setLock('pessimistic_write')
          .setOnLocked('nowait')
          .where('status.companyId = :companyId', { companyId })
          .andWhere('status.warehouseId = :warehouseId', key)
          .andWhere('status.inventoryId = :inventoryId', key)
          .andWhere('status.deleteYn = :notDeleted', { notDeleted: 'N' })
          .getOne();
        statuses.set(`${key.warehouseId}:${key.inventoryId}`, status);
      }
      for (const item of request.items) {
        this.validateTxItem(item);
        const txDate = item.txDate ?? new Date();
        const txType = item.txTypeCode.toUpperCase();
        if (txType === TxType.IN) {
          await this.executeIn(runner, companyId, item, statuses, txDate, userId);
        } else if (txType === TxType.OUT) {
          await this.executeOut(runner, companyId, item, statuses, txDate, userId);
        } else if (txType === TxType.MOVE) {
          await this.executeMove(runner, companyId, item, statuses, txDate, userId);
        } else {
          await this.executeAdj(runner, companyId, item, statuses, txDate, userId);
        }
      }
      if (ownsTransaction) await runner.commitTransaction();
    } catch (error: unknown) {
      if (ownsTransaction) await runner.rollbackTransaction();
      const lockError = error as { code?: string; message?: string };
      if (lockError.code === '55P03' || lockError.message?.includes('could not obtain lock')) {
        throw new ConflictException('다른 사용자가 처리 중입니다. 잠시 후 다시 시도하세요.');
      }
      throw error;
    } finally {
      if (ownsTransaction) await runner.release();
    }
  }

  private async executeIn(
    runner: QueryRunner,
    companyId: string,
    item: TxItem,
    statuses: Map<string, InventoryStatus | null>,
    txDate: Date | string,
    operator: string,
    historyType: string = TxType.IN,
  ): Promise<void> {
    const key = `${item.warehouseId}:${item.inventoryId}`;
    const repository = runner.manager.getRepository(InventoryStatus);
    let status = statuses.get(key);
    const qty = new Decimal(item.qty);
    const price = new Decimal(item.unitPrice ?? '0');
    const amount = qty.mul(price);
    if (!status) {
      status = repository.create({
        companyId,
        warehouseId: item.warehouseId,
        inventoryId: item.inventoryId,
        qty: qty.toFixed(4),
        amount: amount.toFixed(4),
        createdBy: operator,
        updatedBy: operator,
        deleteYn: 'N',
      });
    } else {
      status.qty = new Decimal(status.qty).add(qty).toFixed(4);
      status.amount = new Decimal(status.amount).add(amount).toFixed(4);
      status.updatedBy = operator;
    }
    status = await repository.save(status);
    statuses.set(key, status);
    await this.saveHistory(runner, companyId, item, historyType, qty, price, amount, txDate, operator);
  }

  private async executeOut(
    runner: QueryRunner,
    companyId: string,
    item: TxItem,
    statuses: Map<string, InventoryStatus | null>,
    txDate: Date | string,
    operator: string,
    historyType: string = TxType.OUT,
  ): Promise<void> {
    const key = `${item.warehouseId}:${item.inventoryId}`;
    const status = statuses.get(key);
    const currentQty = new Decimal(status?.qty ?? '0');
    const currentAmount = new Decimal(status?.amount ?? '0');
    const qty = new Decimal(item.qty);
    if (!status || currentQty.lt(qty)) {
      throw new BadRequestException(
        `재고가 부족합니다. 창고=${item.warehouseId}, 자재=${item.inventoryId}, 현재고=${currentQty.toFixed(4)}, 요청수량=${qty.toFixed(4)}`,
      );
    }
    const price = currentQty.gt(0)
      ? currentAmount.div(currentQty).toDecimalPlaces(4) : new Decimal(0);
    const amount = qty.mul(price);
    status.qty = currentQty.sub(qty).toFixed(4);
    status.amount = currentAmount.sub(amount).toFixed(4);
    status.updatedBy = operator;
    await runner.manager.getRepository(InventoryStatus).save(status);
    await this.saveHistory(
      runner, companyId, item, historyType,
      qty.negated(), price, amount.negated(), txDate, operator,
    );
  }

  private async executeMove(
    runner: QueryRunner,
    companyId: string,
    item: TxItem,
    statuses: Map<string, InventoryStatus | null>,
    txDate: Date | string,
    operator: string,
  ): Promise<void> {
    if (!item.targetWarehouseId) throw new BadRequestException('이동 처리에는 대상 창고가 필요합니다.');
    if (item.warehouseId === item.targetWarehouseId) {
      throw new BadRequestException('이동 출고 창고와 대상 창고가 같을 수 없습니다.');
    }
    const warehouses = await runner.manager.getRepository(Warehouse).find({
      where: [
        { companyId, id: item.warehouseId, deleteYn: 'N' },
        { companyId, id: item.targetWarehouseId, deleteYn: 'N' },
      ],
    });
    const source = warehouses.find((warehouse) => warehouse.id === item.warehouseId);
    const target = warehouses.find((warehouse) => warehouse.id === item.targetWarehouseId);
    if (!source || !target) throw new BadRequestException('유효한 이동 창고를 찾을 수 없습니다.');
    if (source.plantId !== target.plantId) {
      throw new BadRequestException(
        '다른 플랜트 간 이동은 보내는 플랜트에서 출고/플랜트이동, 받는 플랜트에서 입고/플랜트이동으로 각각 처리하세요.',
      );
    }
    await this.executeOut(
      runner, companyId, item, statuses, txDate, operator, MoveTxType.MOVE_OUT,
    );
    await this.executeIn(
      runner, companyId,
      { ...item, txTypeCode: TxType.IN, warehouseId: item.targetWarehouseId },
      statuses, txDate, operator, MoveTxType.MOVE_IN,
    );
  }

  private async executeAdj(
    runner: QueryRunner,
    companyId: string,
    item: TxItem,
    statuses: Map<string, InventoryStatus | null>,
    txDate: Date | string,
    operator: string,
  ): Promise<void> {
    const key = `${item.warehouseId}:${item.inventoryId}`;
    const repository = runner.manager.getRepository(InventoryStatus);
    let status = statuses.get(key);
    const qty = new Decimal(item.qty);
    const price = new Decimal(item.unitPrice ?? '0');
    const amount = price.mul(qty);
    const newQty = new Decimal(status?.qty ?? '0').add(qty);
    const newAmount = new Decimal(status?.amount ?? '0').add(amount);
    if (newQty.lt(0)) throw new BadRequestException('조정 후 재고가 음수가 될 수 없습니다.');
    if (!status) {
      status = repository.create({
        companyId,
        warehouseId: item.warehouseId,
        inventoryId: item.inventoryId,
        createdBy: operator,
        deleteYn: 'N',
      });
    }
    status.qty = newQty.toFixed(4);
    status.amount = newAmount.toFixed(4);
    status.updatedBy = operator;
    status = await repository.save(status);
    statuses.set(key, status);
    await this.saveHistory(
      runner, companyId, item, TxType.ADJ, qty, price, amount, txDate, operator,
    );
  }

  private async saveHistory(
    runner: QueryRunner,
    companyId: string,
    item: TxItem,
    txTypeCode: string,
    qty: Decimal,
    unitPrice: Decimal,
    amount: Decimal,
    txDate: Date | string,
    operator: string,
  ): Promise<void> {
    const repository = runner.manager.getRepository(InventoryHistory);
    await repository.save(repository.create({
      companyId,
      warehouseId: item.warehouseId,
      inventoryId: item.inventoryId,
      txTypeCode,
      txReasonCode: this.resolveReason(item),
      qty: qty.toFixed(4),
      unitPrice: unitPrice.toFixed(4),
      amount: amount.toFixed(4),
      txDate: this.toDateOnly(txDate),
      userId: operator,
      docNo: item.docNo ?? null,
      refNo: item.refNo ?? null,
      refModule: item.refModule ?? null,
      refLineNo: item.refLineNo ?? null,
      createdBy: operator,
      updatedBy: operator,
      deleteYn: 'N',
    }));
  }

  async closeMonth(closingYm: string, operator: string): Promise<void> {
    const { companyId } = getTenantContext();
    if (!/^\d{6}$/.test(closingYm)) {
      throw new BadRequestException('마감 년월은 YYYYMM 형식이어야 합니다.');
    }
    const year = Number(closingYm.slice(0, 4));
    const month = Number(closingYm.slice(4, 6));
    if (month < 1 || month > 12) {
      throw new BadRequestException('마감 월은 01부터 12 사이여야 합니다.');
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('SERIALIZABLE');
    try {
      // 동일 회사·월의 중복 마감을 직렬화한다.
      await runner.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`inventory-closing:${companyId}:${closingYm}`],
      );
      const headerRepository = runner.manager.getRepository(InventoryClosing);
      const existingHeader = await headerRepository.findOne({
        where: { companyId, closingYm, status: 'CLOSED', deleteYn: 'N' },
      });
      if (existingHeader) {
        throw new BadRequestException(`${closingYm.slice(0, 4)}-${closingYm.slice(4)}월은 이미 마감되었습니다.`);
      }

      const statuses = await runner.manager.getRepository(InventoryStatus).find({
        where: { companyId, deleteYn: 'N' },
      });
      const historyRepository = runner.manager.getRepository(InventoryHistory);
      const detailRepository = runner.manager.getRepository(InventoryMonthlyClosing);
      for (const status of statuses) {
        const [openingHistories, histories] = await Promise.all([
          historyRepository.find({
            where: {
              companyId,
              warehouseId: status.warehouseId,
              inventoryId: status.inventoryId,
              txDate: LessThan(start),
              deleteYn: 'N',
            },
          }),
          historyRepository.find({
            where: {
              companyId,
              warehouseId: status.warehouseId,
              inventoryId: status.inventoryId,
              txDate: Between(start, end),
              deleteYn: 'N',
            },
          }),
        ]);
        const openingQty = openingHistories.reduce(
          (sum, history) => sum.add(history.qty), new Decimal(0),
        );
        const openingAmount = openingHistories.reduce(
          (sum, history) => sum.add(history.amount), new Decimal(0),
        );
        let inQty = new Decimal(0), inAmt = new Decimal(0);
        let outQty = new Decimal(0), outAmt = new Decimal(0);
        let moveQty = new Decimal(0), moveAmt = new Decimal(0);
        let adjQty = new Decimal(0), adjAmt = new Decimal(0);
        histories.forEach((history) => {
          const qty = new Decimal(history.qty);
          const amount = new Decimal(history.amount);
          if (history.txTypeCode === TxType.IN) { inQty = inQty.add(qty); inAmt = inAmt.add(amount); }
          else if (history.txTypeCode === TxType.OUT) { outQty = outQty.add(qty.abs()); outAmt = outAmt.add(amount.abs()); }
          else if ([MoveTxType.MOVE_IN, MoveTxType.MOVE_OUT].includes(history.txTypeCode as MoveTxType)) {
            moveQty = moveQty.add(qty); moveAmt = moveAmt.add(amount);
          } else if (history.txTypeCode === TxType.ADJ) { adjQty = adjQty.add(qty); adjAmt = adjAmt.add(amount); }
        });
        const closing = detailRepository.create({
          companyId,
          warehouseId: status.warehouseId,
          inventoryId: status.inventoryId,
          closingYm,
          openingQty: openingQty.toFixed(4),
          openingAmount: openingAmount.toFixed(4),
          inQty: inQty.toFixed(4), inAmount: inAmt.toFixed(4),
          outQty: outQty.toFixed(4), outAmount: outAmt.toFixed(4),
          moveQty: moveQty.toFixed(4), moveAmount: moveAmt.toFixed(4),
          adjQty: adjQty.toFixed(4), adjAmount: adjAmt.toFixed(4),
          closingQty: openingQty.add(inQty).sub(outQty).add(moveQty).add(adjQty).toFixed(4),
          closingAmount: openingAmount.add(inAmt).sub(outAmt).add(moveAmt).add(adjAmt).toFixed(4),
          createdBy: operator,
          updatedBy: operator,
          deleteYn: 'N',
        });
        await detailRepository.save(closing);
      }
      await headerRepository.save(headerRepository.create({
        companyId,
        closingYm,
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: operator,
        createdBy: operator,
        updatedBy: operator,
        deleteYn: 'N',
      }));
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  getStatusList(companyId: string): Promise<InventoryStatus[]> {
    return this.dataSource.getRepository(InventoryStatus).find({
      where: { companyId, deleteYn: 'N' },
    });
  }

  getHistoryList(companyId: string): Promise<InventoryHistory[]> {
    return this.dataSource.getRepository(InventoryHistory).find({
      where: { companyId, deleteYn: 'N' },
      order: { historyNo: 'DESC' },
    });
  }

  private validateTxItem(item: TxItem): void {
    const type = item.txTypeCode?.toUpperCase();
    if (![TxType.IN, TxType.OUT, TxType.MOVE, TxType.ADJ].includes(type as TxType)) {
      throw new BadRequestException(`유효하지 않은 수불 유형입니다: ${item.txTypeCode}`);
    }
    if (!item.warehouseId || !item.inventoryId) throw new BadRequestException('창고와 자재는 필수입니다.');
    let qty: Decimal;
    try { qty = new Decimal(item.qty); } catch { throw new BadRequestException('수량 형식이 올바르지 않습니다.'); }
    if (!qty.isFinite() || qty.isZero()) throw new BadRequestException('수량은 0이 아닌 숫자여야 합니다.');
    if (type !== TxType.ADJ && qty.lte(0)) {
      throw new BadRequestException('입고, 출고, 이동 수량은 0보다 커야 합니다.');
    }
    const reason = this.resolveReason(item);
    const allowed: Record<TxType, TxReason[]> = {
      [TxType.IN]: [TxReason.GENERAL, TxReason.PURCHASE, TxReason.RETURN, TxReason.PLANT_TRANSFER],
      [TxType.OUT]: [TxReason.GENERAL, TxReason.WORK_ORDER, TxReason.DISPOSAL, TxReason.PLANT_TRANSFER],
      [TxType.MOVE]: [TxReason.TRANSFER],
      [TxType.ADJ]: [TxReason.STOCKTAKING],
    };
    if (!allowed[type as TxType].includes(reason)) {
      throw new BadRequestException(`수불 유형 ${type}에 사용할 수 없는 거래 사유입니다: ${reason}`);
    }
  }

  private resolveReason(item: TxItem): TxReason {
    const type = item.txTypeCode.toUpperCase();
    if (type === TxType.MOVE) return TxReason.TRANSFER;
    if (type === TxType.ADJ) return TxReason.STOCKTAKING;
    if (item.refModule === AppModule.PUR && type === TxType.IN) return TxReason.PURCHASE;
    return item.txReasonCode ?? TxReason.GENERAL;
  }

  private extractSortedKeys(items: TxItem[]): { warehouseId: string; inventoryId: string }[] {
    const keys = new Set<string>();
    items.forEach((item) => {
      keys.add(`${item.warehouseId}:${item.inventoryId}`);
      if (item.txTypeCode.toUpperCase() === TxType.MOVE && item.targetWarehouseId) {
        keys.add(`${item.targetWarehouseId}:${item.inventoryId}`);
      }
    });
    return [...keys].sort().map((key) => {
      const [warehouseId, inventoryId] = key.split(':');
      return { warehouseId, inventoryId };
    });
  }

  private async getUserDept(companyId: string, userId: string): Promise<string | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { companyId, id: userId, deleteYn: 'N' },
    });
    return user?.departmentId ?? null;
  }

  private toDateOnly(value: Date | string): string {
    if (typeof value === 'string') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('거래일자 형식이 올바르지 않습니다.');
    }
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
