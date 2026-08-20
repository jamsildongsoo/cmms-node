import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import Decimal from 'decimal.js';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import {
  DocStatus,
  TxReason,
  TxType,
} from '../../common/constants/status.constants';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { Allocation } from '../../entities/allocation.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { Plant } from '../../entities/plant.entity';
import { InventoryDocument } from '../../entities/inventory-document.entity';
import { InventoryDocumentItem } from '../../entities/inventory-document-item.entity';
import { ProcurementRepository } from './procurement.repository';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import { FileStorageService } from '../file/file-storage.service';

export interface ItemLine {
  itemNo: number;
  inventoryId: string;
  qty: string;
  unit?: string | null;
  remarks?: string | null;
}
export interface SaveRequest {
  header: {
    id?: string | null;
    plantId?: string | null;
    departmentId?: string | null;
    warehouseId: string;
    fileGroupId?: string | number | null;
    requestDate?: string | Date;
    requestType?: string | null;
    title?: string;
    remarks?: string | null;
    status?: string;
  };
  items?: ItemLine[];
}
export interface RequestDetail { header: PurchaseRequestResponse; items: ItemLine[] }
export interface PurchaseRequestResponse {
  companyId: string; id: string; plantId: string; warehouseId: string;
  requesterId: string; departmentId: string | null; requestDate: string; requestType: string | null;
  fileGroupId: number | null;
  title: string; approvalId: string | null;
  orderDate: string | null; etaDate: string | null;
  shipStartDate: string | null;
  purchaseManager: string | null; purchaseManagerContact: string | null;
  purchaseManagerRemarks: string | null;
  status: string;
  remarks: string | null; createdAt: string; createdBy: string;
  purchaseRequestId?: string;
  purchaseOrderId?: string;
  closedAt?: string | null;
  remainingQty?: string;
}
export interface PurchaseOrderAllocationResponse {
  docId: string;
  docItemNo: number;
  prId: string;
  prItemNo: number;
  warehouseId: string;
  inventoryId: string;
  allocatedQty: string;
}
export interface PurchaseOrderLinkResponse {
  orderId: string;
  status: string;
}
export interface PurchaseOrderInventoryDocumentResponse {
  id: string;
  txDate: Date | string;
  refModule: string | null;
  refNo: string | null;
  remarks: string | null;
  createdBy: string;
  createdAt: Date;
  reverseDocumentId: string | null;
}
interface PurchaseOrderAllocationInput {
  docItemNo: number;
  prId: string;
  prItemNo: number;
  allocatedQty: string;
}
interface IntegratedOrderInput {
  orderDate?: string;
  etaDate?: string;
  lines: Array<{ prId: string; prItemNo: number; qty: string }>;
}
interface StandaloneOrderInput {
  plantId: string;
  warehouseId?: string | null;
  orderDate?: string;
  etaDate?: string;
  items: ItemLine[];
}
interface UpdateOrderInput {
  plantId: string;
  warehouseId?: string | null;
  orderDate?: string;
  etaDate?: string;
  items?: ItemLine[];
}
const dateOnly = (value?: string | Date | null): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
};
const today = (): string => new Date().toISOString().slice(0, 10);

@Injectable()
export class ProcurementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly procurementRepository: ProcurementRepository,
    private readonly permissionPolicyService: PermissionPolicyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  private async getRequests(
    companyId: string,
    operator: string,
    roleId: string,
    requestedPlantId?: string | null,
    receivableOnly = false,
    tempOnly = false,
  ): Promise<PurchaseRequestResponse[]> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      requestedPlantId,
      AppModule.PUR,
    );
    let requests = await this.procurementRepository.findAll(companyId, activePlantId ?? undefined, tempOnly, operator);
    if (receivableOnly) {
      const canReadStock = await this.permissionPolicyService.hasActionPermission(
        {
          companyId,
          roleId,
          module: AppModule.STK,
          action: 'R',
        },
      );
      if (!canReadStock) {
        throw new ForbiddenException('구매입고 대상 조회 권한이 없습니다.');
      }
      requests = requests.filter((request) => request.status === DocStatus.CONFIRMED);
    }
    return requests.map((entity) => this.toResponse(entity));
  }

  async getPurchaseRequests(
    companyId: string,
    operator: string,
    roleId: string,
    requestedPlantId?: string | null,
    receivableOnly = false,
    tempOnly = false,
  ): Promise<PurchaseRequestResponse[]> {
    return this.getRequests(
      companyId, operator, roleId, requestedPlantId, receivableOnly, tempOnly,
    );
  }

  async getPurchaseOrders(
    companyId: string,
    operator: string,
    roleId: string,
    requestedPlantId?: string | null,
    receivableOnly = false,
    accessModule: AppModule = AppModule.POR,
    tempOnly = false,
  ): Promise<PurchaseRequestResponse[]> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource, companyId, operator, requestedPlantId, accessModule,
    );
    const orderQuery = this.dataSource.getRepository(PurchaseOrder)
      .createQueryBuilder('purchaseOrder')
      .where('purchaseOrder.companyId = :companyId', { companyId })
      .andWhere('purchaseOrder.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (tempOnly) {
      orderQuery
        .andWhere('purchaseOrder.status = :tempStatus', { tempStatus: DocStatus.TEMP })
        .andWhere('purchaseOrder.createdBy = :operator', { operator });
    } else {
      orderQuery.andWhere('purchaseOrder.status <> :tempStatus', { tempStatus: DocStatus.TEMP });
    }
    const orders = await orderQuery.orderBy('purchaseOrder.id', 'DESC').getMany();
    const allocationRepository = this.dataSource.getRepository(Allocation);
    const orderItems = orders.length
      ? await this.dataSource.getRepository(PurchaseOrderItem).find({
        where: { companyId, orderId: In(orders.map((order) => order.id)) },
        order: { itemNo: 'ASC' },
      })
      : [];
    const receivedByOrderLine = await this.getReceivedQuantities(
      companyId,
      orders.map((order) => order.id),
    );
    const orderItemsByOrder = new Map<string, PurchaseOrderItem[]>();
    orderItems.forEach((item) => {
      const current = orderItemsByOrder.get(item.orderId) ?? [];
      current.push(item);
      orderItemsByOrder.set(item.orderId, current);
    });
    const result: PurchaseRequestResponse[] = [];
    for (const order of orders) {
      const seedAllocation = await allocationRepository.findOne({
        where: { companyId, allocationType: 'PO', docId: order.id },
        order: { prId: 'ASC', prItemNo: 'ASC' },
      });
      const requestId = order.purchaseRequestId ?? seedAllocation?.prId;
      if (!requestId) {
        if (activePlantId && order.plantId !== activePlantId) continue;
        if (receivableOnly && ![DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(order.status as DocStatus)) continue;
        if (receivableOnly && order.closedAt) continue;
        const response = this.toStandaloneOrderResponse(order);
        response.remainingQty = this.getRemainingOrderQty(order.id, orderItemsByOrder, receivedByOrderLine);
        if (receivableOnly && response.remainingQty === '0.0000') continue;
        result.push(response);
        continue;
      }
      const request = await this.dataSource.getRepository(PurchaseRequest).findOne({
        where: { companyId, id: requestId, deleteYn: 'N' },
      });
      if (!request || request.status !== DocStatus.CONFIRMED) continue;
      if (activePlantId && request.plantId !== activePlantId) continue;
      if (receivableOnly && order.closedAt) continue;
      const response = this.toResponse(request);
      response.id = order.id;
      response.purchaseRequestId = order.purchaseRequestId ?? undefined;
      response.purchaseOrderId = order.id;
      response.warehouseId = order.warehouseId ?? '';
      response.orderDate = order.orderDate;
      response.etaDate = order.etaDate;
      response.shipStartDate = order.shipStartDate;
      response.status = order.status;
      response.closedAt = order.closedAt?.toISOString() ?? null;
      response.remainingQty = this.getRemainingOrderQty(order.id, orderItemsByOrder, receivedByOrderLine);
      if (receivableOnly && response.remainingQty === '0.0000') continue;
      result.push(response);
    }
    return result;
  }

  async createIntegratedOrder(
    companyId: string,
    input: IntegratedOrderInput,
    operator: string,
  ): Promise<PurchaseRequestResponse> {
    if (!input.lines.length) throw new BadRequestException('발주할 PR item이 없습니다.');
    const duplicateKeys = new Set<string>();
    for (const line of input.lines) {
      const key = `${line.prId}:${line.prItemNo}`;
      if (duplicateKeys.has(key)) throw new BadRequestException(`중복된 PR item입니다: ${key}`);
      duplicateKeys.add(key);
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const requestIds = [...new Set(input.lines.map((line) => line.prId))];
      const requests = await runner.manager.getRepository(PurchaseRequest)
        .createQueryBuilder('request')
        .setLock('pessimistic_write')
        .where('request.companyId = :companyId', { companyId })
        .andWhere('request.id IN (:...requestIds)', { requestIds })
        .andWhere('request.deleteYn = :deleteYn', { deleteYn: 'N' })
        .getMany();
      if (requests.length !== requestIds.length) throw new NotFoundException('일부 구매요청을 찾을 수 없습니다.');
      if (requests.some((request) => request.status !== DocStatus.CONFIRMED)) {
        throw new BadRequestException('결재완료된 구매요청만 통합 발주할 수 있습니다.');
      }
      const items = await runner.manager.getRepository(PurchaseRequestItem)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.companyId = :companyId', { companyId })
        .andWhere('item.requestId IN (:...requestIds)', { requestIds })
        .getMany();
      const itemByKey = new Map(items.map((item) => [`${item.requestId}:${item.itemNo}`, item]));
      const poAllocations = await runner.manager.getRepository(Allocation).find({
        where: { companyId, allocationType: 'PO', prId: In(requestIds) },
      });
      const allocatedByKey = new Map<string, Decimal>();
      for (const allocation of poAllocations) {
        const key = `${allocation.prId}:${allocation.prItemNo}`;
        allocatedByKey.set(key, (allocatedByKey.get(key) ?? new Decimal(0)).add(allocation.allocationQty));
      }
      const grouped = new Map<string, { inventoryId: string; unit: string | null; qty: Decimal; lines: Array<{ prId: string; prItemNo: number; qty: Decimal }> }>();
      for (const line of input.lines) {
        const key = `${line.prId}:${line.prItemNo}`;
        const item = itemByKey.get(key);
        if (!item) throw new BadRequestException(`PR item을 찾을 수 없습니다: ${key}`);
        const qty = new Decimal(line.qty);
        const available = new Decimal(item.qty).sub(allocatedByKey.get(key) ?? 0);
        if (qty.gt(available)) throw new BadRequestException(`PR item ${key}의 발주 가능수량을 초과했습니다.`);
        const group = grouped.get(item.inventoryId) ?? {
          inventoryId: item.inventoryId,
          unit: item.unit,
          qty: new Decimal(0),
          lines: [],
        };
        group.qty = group.qty.add(qty);
        group.lines.push({ prId: line.prId, prItemNo: line.prItemNo, qty });
        grouped.set(item.inventoryId, group);
      }
      const first = requests[0];
      const orderId = await this.sequenceService.generateNextNo(companyId, AppModule.POR, null);
      const order = runner.manager.getRepository(PurchaseOrder).create({
        companyId,
        id: orderId,
        purchaseRequestId: null,
        plantId: first.plantId,
        warehouseId: null,
        requesterId: first.requesterId,
        departmentId: first.departmentId,
        orderDate: input.orderDate || today(),
        etaDate: input.etaDate || null,
        shipStartDate: null,
        status: DocStatus.TEMP,
        closedAt: null,
        closeReason: null,
        createdBy: operator,
        updatedBy: operator,
        deleteYn: 'N',
      });
      await runner.manager.getRepository(PurchaseOrder).save(order);
      const orderItems: PurchaseOrderItem[] = [];
      const allocations: Allocation[] = [];
      let itemNo = 1;
      for (const group of grouped.values()) {
        const savedItem = runner.manager.getRepository(PurchaseOrderItem).create({
          companyId,
          orderId,
          itemNo,
          purchaseRequestId: null,
          purchaseRequestItemNo: null,
          inventoryId: group.inventoryId,
          orderedQty: group.qty.toFixed(4),
          unit: group.unit,
        });
        orderItems.push(savedItem);
        for (const line of group.lines) {
          allocations.push(runner.manager.getRepository(Allocation).create({
            companyId,
            allocationType: 'PO',
            docId: orderId,
            docItemNo: itemNo,
            prId: line.prId,
            prItemNo: line.prItemNo,
            inventoryId: group.inventoryId,
            allocationQty: line.qty.toFixed(4),
          }));
        }
        itemNo += 1;
      }
      await runner.manager.getRepository(PurchaseOrderItem).save(orderItems);
      await runner.manager.getRepository(Allocation).save(allocations);
      await runner.commitTransaction();
      const response = this.toResponse(first);
      response.id = orderId;
      response.purchaseRequestId = undefined;
      response.purchaseOrderId = orderId;
      response.warehouseId = '';
      response.orderDate = order.orderDate;
      response.etaDate = order.etaDate;
      response.status = order.status;
      response.closedAt = order.closedAt?.toISOString() ?? null;
      return response;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async createStandaloneOrder(
    companyId: string,
    input: StandaloneOrderInput,
    operator: string,
  ): Promise<PurchaseRequestResponse> {
    if (!input.items.length) throw new BadRequestException('구매오더 품목이 없습니다.');
    const warehouse = input.warehouseId
      ? await this.dataSource.getRepository(Warehouse).findOne({
        where: { companyId, id: input.warehouseId, deleteYn: 'N' },
      })
      : null;
    if (input.warehouseId && !warehouse) throw new NotFoundException('구매오더 창고를 찾을 수 없습니다.');
    const plant = await this.dataSource.getRepository(Plant).findOne({
      where: { companyId, id: input.plantId, deleteYn: 'N' },
    });
    if (!plant) throw new NotFoundException('구매오더 플랜트를 찾을 수 없습니다.');
    const duplicateItems = new Set<number>();
    for (const item of input.items) {
      if (duplicateItems.has(item.itemNo)) throw new BadRequestException(`중복된 POR item입니다: ${item.itemNo}`);
      duplicateItems.add(item.itemNo);
      if (!item.inventoryId || !new Decimal(item.qty).isFinite() || new Decimal(item.qty).lte(0)) {
        throw new BadRequestException('구매오더 품목과 수량을 확인하세요.');
      }
    }
    const orderRepository = this.dataSource.getRepository(PurchaseOrder);
    const orderItemRepository = this.dataSource.getRepository(PurchaseOrderItem);
    const orderId = await this.sequenceService.generateNextNo(companyId, AppModule.POR, null);
    const order = orderRepository.create({
      companyId,
      id: orderId,
      purchaseRequestId: null,
      plantId: input.plantId,
      warehouseId: input.warehouseId ?? null,
      requesterId: operator,
      departmentId: null,
      orderDate: input.orderDate || today(),
      etaDate: input.etaDate || null,
      shipStartDate: null,
      status: DocStatus.TEMP,
      closedAt: null,
      closeReason: null,
      createdBy: operator,
      updatedBy: operator,
      deleteYn: 'N',
    });
    await orderRepository.save(order);
    await orderItemRepository.save(input.items.map((item) => orderItemRepository.create({
      companyId,
      orderId,
      itemNo: item.itemNo,
      purchaseRequestId: null,
      purchaseRequestItemNo: null,
      inventoryId: item.inventoryId,
      orderedQty: new Decimal(item.qty).toFixed(4),
      unit: item.unit ?? null,
    })));
    return {
      companyId,
      id: orderId,
      plantId: order.plantId,
      warehouseId: order.warehouseId ?? '',
      requesterId: operator,
      departmentId: null,
      requestDate: order.orderDate,
      requestType: null,
      fileGroupId: null,
      title: '독립 구매오더',
      approvalId: null,
      orderDate: order.orderDate,
      etaDate: order.etaDate,
      shipStartDate: null,
      purchaseManager: null,
      purchaseManagerContact: null,
      purchaseManagerRemarks: null,
      status: order.status,
      remarks: null,
      createdAt: order.createdAt.toISOString(),
      createdBy: operator,
      purchaseOrderId: orderId,
      closedAt: null,
    };
  }

  async updatePurchaseOrder(
    companyId: string,
    orderId: string,
    input: UpdateOrderInput,
    operator: string,
  ): Promise<RequestDetail> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource,
      companyId,
      operator,
      input.plantId,
      AppModule.POR,
    );
    if (!activePlantId) throw new BadRequestException('구매오더 플랜트를 확인할 수 없습니다.');

    const warehouse = input.warehouseId
      ? await this.dataSource.getRepository(Warehouse).findOne({
        where: { companyId, id: input.warehouseId, deleteYn: 'N' },
      })
      : null;
    if (input.warehouseId && !warehouse) {
      throw new NotFoundException('구매오더 창고를 찾을 수 없습니다.');
    }
    if (warehouse?.plantId && warehouse.plantId !== activePlantId) {
      throw new BadRequestException('선택한 플랜트 범위의 창고만 지정할 수 있습니다.');
    }

    await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(PurchaseOrder);
      const order = await orderRepository
        .createQueryBuilder('purchaseOrder')
        .setLock('pessimistic_write')
        .where('purchaseOrder.companyId = :companyId', { companyId })
        .andWhere('purchaseOrder.id = :orderId', { orderId })
        .andWhere('purchaseOrder.deleteYn = :deleteYn', { deleteYn: 'N' })
        .getOne();
      if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
      if (order.status !== DocStatus.TEMP) {
        throw new BadRequestException('임시저장 상태의 POR만 수정할 수 있습니다.');
      }
      if (order.createdBy !== operator) {
        throw new ForbiddenException('본인이 임시저장한 POR만 수정할 수 있습니다.');
      }

      const hasAllocation = await manager.getRepository(Allocation).exists({
        where: { companyId, allocationType: 'PO', docId: orderId },
      });
      const isLinkedOrder = !!order.purchaseRequestId || hasAllocation;
      if (isLinkedOrder && order.plantId !== activePlantId) {
        throw new BadRequestException('PR 배부 기반 POR의 플랜트는 변경할 수 없습니다.');
      }
      if (isLinkedOrder && input.items !== undefined) {
        throw new BadRequestException('PR 배부 기반 POR의 품목은 배부 정보에서 관리해야 합니다.');
      }

      if (!isLinkedOrder) {
        if (!input.items?.length) throw new BadRequestException('구매오더 품목이 없습니다.');
        const itemNumbers = new Set<number>();
        for (const item of input.items) {
          if (itemNumbers.has(item.itemNo)) {
            throw new BadRequestException(`중복된 POR item입니다: ${item.itemNo}`);
          }
          itemNumbers.add(item.itemNo);
          const qty = new Decimal(item.qty);
          if (!item.inventoryId || !qty.isFinite() || qty.lte(0)) {
            throw new BadRequestException('구매오더 품목과 수량을 확인하세요.');
          }
        }
        const itemRepository = manager.getRepository(PurchaseOrderItem);
        await itemRepository.delete({ companyId, orderId });
        await itemRepository.save(input.items.map((item) => itemRepository.create({
          companyId,
          orderId,
          itemNo: item.itemNo,
          purchaseRequestId: null,
          purchaseRequestItemNo: null,
          inventoryId: item.inventoryId,
          orderedQty: new Decimal(item.qty).toFixed(4),
          unit: item.unit ?? null,
        })));
      }

      Object.assign(order, {
        plantId: activePlantId,
        warehouseId: input.warehouseId ?? null,
        orderDate: input.orderDate || order.orderDate,
        etaDate: input.etaDate ?? null,
        updatedBy: operator,
      });
      await orderRepository.save(order);
    });

    return this.getPurchaseOrderDetail(companyId, orderId, operator, activePlantId);
  }

  private async getRequestDetail(
    companyId: string,
    id: string,
    operator?: string,
    requestedPlantId?: string | null,
  ): Promise<RequestDetail> {
    const request = await this.mustGetActive(companyId, id);
    if (operator) {
      const activePlantId = await resolveActivePlantId(
        this.dataSource,
        companyId,
        operator,
        requestedPlantId,
        AppModule.PUR,
      );
      if (activePlantId && request.plantId !== activePlantId) {
        throw new ForbiddenException('현재 선택한 플랜트 범위의 구매요청만 조회할 수 있습니다.');
      }
    }
    const items = await this.procurementRepository.findItems(companyId, id);
    return {
      header: this.toResponse(request),
      items: items.map((item) => ({
        itemNo: item.itemNo,
        inventoryId: item.inventoryId,
        qty: item.qty,
        unit: item.unit,
        remarks: item.remarks,
      })),
    };
  }

  async getPurchaseRequestDetail(
    companyId: string,
    id: string,
    operator?: string,
    requestedPlantId?: string | null,
  ): Promise<RequestDetail> {
    return this.getRequestDetail(companyId, id, operator, requestedPlantId);
  }

  async getPurchaseOrderLinks(
    companyId: string,
    requestId: string,
  ): Promise<PurchaseOrderLinkResponse[]> {
    const rows = await this.dataSource.getRepository(Allocation)
      .createQueryBuilder('allocation')
      .innerJoin(PurchaseOrder, 'order',
        'order.companyId = allocation.companyId AND order.id = allocation.docId AND order.deleteYn = :deleteYn',
        { deleteYn: 'N' })
      .select('order.id', 'orderId')
      .addSelect('order.status', 'status')
      .where('allocation.companyId = :companyId', { companyId })
      .andWhere('allocation.prId = :requestId', { requestId })
      .andWhere('allocation.allocationType = :allocationType', { allocationType: 'PO' })
      .groupBy('order.id')
      .addGroupBy('order.status')
      .orderBy('order.id', 'ASC')
      .getRawMany<{ orderId: string; status: string }>();
    return rows;
  }

  async getPurchaseOrderInventoryDocuments(companyId: string, orderId: string): Promise<PurchaseOrderInventoryDocumentResponse[]> {
    return this.dataSource.getRepository(InventoryDocument).find({
      where: { companyId, refModule: AppModule.POR, refNo: orderId, deleteYn: 'N' },
      order: { txDate: 'DESC', id: 'DESC' },
    });
  }

  async getPurchaseOrderDetail(
    companyId: string,
    id: string,
    operator?: string,
    requestedPlantId?: string | null,
    accessModule: AppModule = AppModule.POR,
  ): Promise<RequestDetail> {
    const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { companyId, id, deleteYn: 'N' },
    });
    const seedAllocation = order && !order.purchaseRequestId
      ? await this.dataSource.getRepository(Allocation).findOne({
        where: { companyId, allocationType: 'PO', docId: order.id },
        order: { prId: 'ASC', prItemNo: 'ASC' },
      })
      : null;
    const requestId = order?.purchaseRequestId ?? seedAllocation?.prId;
    if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
    if (accessModule === AppModule.STK
      && (![DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(order.status as DocStatus) || order.closedAt)) {
      throw new NotFoundException('입고 가능한 구매오더가 아닙니다.');
    }
    if (!requestId) {
      const activePlantId = operator
        ? await resolveActivePlantId(this.dataSource, companyId, operator, requestedPlantId, accessModule)
        : null;
      if (activePlantId && order.plantId !== activePlantId) {
        throw new ForbiddenException('현재 선택한 플랜트 범위의 구매오더가 아닙니다.');
      }
      const orderItems = await this.dataSource.getRepository(PurchaseOrderItem).find({
        where: { companyId, orderId: order.id },
        order: { itemNo: 'ASC' },
      });
      const receivedByOrderLine = await this.getReceivedQuantities(companyId, [order.id]);
      return {
        header: this.toStandaloneOrderResponse(order),
        items: orderItems.map((item) => ({
          itemNo: item.itemNo,
          inventoryId: item.inventoryId,
          qty: this.getRemainingOrderLineQty(order.id, item, receivedByOrderLine),
          unit: item.unit,
        })).filter((item) => item.qty !== '0.0000'),
      };
    }
    const detail = await this.getRequestDetail(companyId, requestId, operator, requestedPlantId);
    if (detail.header.status !== DocStatus.CONFIRMED) {
      throw new NotFoundException('구매관리 대상 문서를 찾을 수 없습니다.');
    }
    if (order) {
      detail.header.id = order.id;
      detail.header.purchaseRequestId = order.purchaseRequestId ?? undefined;
      detail.header.purchaseOrderId = order.id;
      detail.header.orderDate = order.orderDate;
      detail.header.etaDate = order.etaDate;
      detail.header.shipStartDate = order.shipStartDate;
      detail.header.status = order.status;
      detail.header.closedAt = order.closedAt?.toISOString() ?? null;
      if (!order.purchaseRequestId) {
        const orderItems = await this.dataSource.getRepository(PurchaseOrderItem).find({
          where: { companyId, orderId: order.id },
          order: { itemNo: 'ASC' },
        });
        const receivedByOrderLine = await this.getReceivedQuantities(companyId, [order.id]);
        detail.items = orderItems.map((item) => ({
          itemNo: item.itemNo,
          inventoryId: item.inventoryId,
          qty: this.getRemainingOrderLineQty(order.id, item, receivedByOrderLine),
          unit: item.unit,
        })).filter((item) => item.qty !== '0.0000');
      }
    }
    return detail;
  }

  private async getReceivedQuantities(
    companyId: string,
    orderIds: string[],
  ): Promise<Map<string, Decimal>> {
    if (!orderIds.length) return new Map();
    const documents = await this.dataSource.getRepository(InventoryDocument).find({
      where: { companyId, refModule: AppModule.POR, refNo: In(orderIds), deleteYn: 'N' },
    });
    if (!documents.length) return new Map();
    const items = await this.dataSource.getRepository(InventoryDocumentItem).find({
      where: {
        companyId,
        documentId: In(documents.map((document) => document.id)),
        txTypeCode: TxType.IN,
      },
    });
    const orderByDocument = new Map(documents.map((document) => [document.id, document.refNo ?? '']));
    const received = new Map<string, Decimal>();
    items.forEach((item) => {
      if (!item.refLineNo) return;
      const orderId = orderByDocument.get(item.documentId);
      if (!orderId) return;
      const key = `${orderId}:${item.refLineNo}`;
      received.set(key, (received.get(key) ?? new Decimal(0)).add(item.qty));
    });
    return received;
  }

  private getRemainingOrderLineQty(
    orderId: string,
    item: PurchaseOrderItem,
    receivedByOrderLine: Map<string, Decimal>,
  ): string {
    const received = receivedByOrderLine.get(`${orderId}:${item.itemNo}`) ?? new Decimal(0);
    return Decimal.max(new Decimal(0), new Decimal(item.orderedQty).sub(received)).toFixed(4);
  }

  private getRemainingOrderQty(
    orderId: string,
    itemsByOrder: Map<string, PurchaseOrderItem[]>,
    receivedByOrderLine: Map<string, Decimal>,
  ): string {
    return (itemsByOrder.get(orderId) ?? [])
      .reduce((total, item) => total.add(this.getRemainingOrderLineQty(orderId, item, receivedByOrderLine)), new Decimal(0))
      .toFixed(4);
  }

  async createOrUpdate(
    companyId: string,
    req: SaveRequest,
    operator: string,
    mode: 'create' | 'update',
    roleId?: string,
  ): Promise<PurchaseRequestResponse> {
    const { header, items = [] } = req;
    const user = await this.dataSource.getRepository(User).findOne({
      where: { companyId, id: operator, deleteYn: 'N' },
    });
    if (!user) throw new BadRequestException('사용자 정보를 찾을 수 없습니다.');
    let plantId = header.plantId?.trim() || null;
    if (mode === 'create' && !plantId) {
      throw new BadRequestException('구매요청 생성 시 플랜트 ID는 필수입니다.');
    }
    if (!user.departmentId) {
      throw new BadRequestException('사용자 소속 부서가 없어 구매요청을 생성할 수 없습니다.');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let id = header.id?.trim() || '';
    if (mode === 'create' && id) {
      throw new BadRequestException('신규 구매요청에는 문서번호를 지정할 수 없습니다.');
    }
    if (mode === 'update' && !id) {
      throw new BadRequestException('수정할 구매요청 문서번호가 필요합니다.');
    }
    try {
      const repository = runner.manager.getRepository(PurchaseRequest);
      let entity: PurchaseRequest;
      if (!id) {
        id = await this.sequenceService.generateNextNo(
          companyId, AppModule.PUR, user.departmentId,
        );
        entity = repository.create({
          companyId,
          id,
          plantId: plantId!,
          requesterId: operator,
          departmentId: user.departmentId,
          requestDate: dateOnly(header.requestDate) || today(),
          status: DocStatus.TEMP,
          createdBy: operator,
          deleteYn: 'N',
        });
      } else {
        entity = await this.findLocked(runner.manager, companyId, id);
        // 수정은 요청값이 아닌 기존 문서의 plant를 기준으로 처리한다.
        plantId = entity.plantId;
        await this.permissionPolicyService.assertCanUpdateOwnTempOrPermission({
          companyId,
          roleId: roleId ?? '',
          module: AppModule.PUR,
          status: entity.status,
          ownerId: entity.requesterId,
          operatorId: operator,
          resourceLabel: '구매',
        });
        if (entity.status !== DocStatus.TEMP) {
          throw new BadRequestException('임시저장 상태의 구매요청만 수정할 수 있습니다.');
        }
      }
      Object.assign(entity, {
        fileGroupId: header.fileGroupId ?? null,
        title: header.title?.trim() || '',
        warehouseId: header.warehouseId,
        requestType: header.requestType ?? null,
        remarks: header.remarks ?? null,
        status: entity.status,
        updatedBy: operator,
      });
      if (!entity.departmentId) {
        entity.departmentId = user.departmentId;
      }
      await repository.save(entity);
      if (entity.fileGroupId != null) {
        await this.fileStorageService.bindGroupToReference({
          manager: runner.manager,
          companyId,
          groupNo: entity.fileGroupId,
          refModule: AppModule.PUR,
          refNo: id,
          operatorId: operator,
        });
      }
      const itemRepository = runner.manager.getRepository(PurchaseRequestItem);
      await itemRepository.delete({ companyId, requestId: id });
      if (items.length) {
        await itemRepository.save(items.map((item, index) =>
          itemRepository.create({
            companyId,
            requestId: id,
            itemNo: index + 1,
            inventoryId: item.inventoryId,
            qty: new Decimal(item.qty).toFixed(4),
            unit: item.unit ?? null,
            remarks: item.remarks ?? null,
          }),
        ));
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    return this.toResponse(await this.mustGetActive(companyId, id));
  }

  async confirmOrder(
    companyId: string, orderId: string, operator: string,
  ): Promise<RequestDetail> {
    const repository = this.dataSource.getRepository(PurchaseOrder);
    const order = await repository.findOne({
      where: { companyId, id: orderId, deleteYn: 'N' },
    });
    if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
    if (order.status !== DocStatus.TEMP) {
      throw new BadRequestException('임시저장 상태의 POR만 확정할 수 있습니다.');
    }
    order.status = DocStatus.SELF_CONFIRMED;
    order.updatedBy = operator;
    await repository.save(order);
    return this.getPurchaseOrderDetail(companyId, orderId, operator);
  }

  async deleteOrder(companyId: string, orderId: string, operator: string): Promise<void> {
    const repository = this.dataSource.getRepository(PurchaseOrder);
    const order = await repository.findOne({
      where: { companyId, id: orderId, deleteYn: 'N' },
    });
    if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
    if (order.status !== DocStatus.TEMP) {
      throw new BadRequestException('임시저장 상태의 POR만 삭제할 수 있습니다.');
    }
    order.deleteYn = 'Y';
    order.updatedBy = operator;
    await repository.save(order);
  }

  async getOrderAllocations(
    companyId: string,
    orderId: string,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { companyId, id: orderId, deleteYn: 'N' },
    });
    if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
    const rows = await this.dataSource.getRepository(Allocation).find({
      where: { companyId, allocationType: 'PO', docId: orderId },
      order: { docItemNo: 'ASC', prItemNo: 'ASC' },
    });
    const requestIds = [...new Set(rows.map((row) => row.prId))];
    const requests = requestIds.length
      ? await this.dataSource.getRepository(PurchaseRequest).find({
        where: requestIds.map((requestId) => ({ companyId, id: requestId, deleteYn: 'N' })),
      })
      : [];
    const requestById = new Map(requests.map((request) => [request.id, request]));
    return rows.map((row) => ({
      docId: row.docId,
      docItemNo: row.docItemNo,
      prId: row.prId,
      prItemNo: row.prItemNo,
      warehouseId: requestById.get(row.prId)?.warehouseId ?? '',
      inventoryId: row.inventoryId,
      allocatedQty: new Decimal(row.allocationQty).toFixed(4),
    }));
  }

  async saveOrderAllocations(
    companyId: string,
    orderId: string,
    inputs: PurchaseOrderAllocationInput[],
    operator: string,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    if (!inputs.length) throw new BadRequestException('배부 라인이 비어 있습니다.');
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const order = await runner.manager.getRepository(PurchaseOrder)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.companyId = :companyId', { companyId })
        .andWhere('order.id = :orderId', { orderId })
        .andWhere('order.deleteYn = :deleteYn', { deleteYn: 'N' })
        .getOne();
      if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
      if (order.status !== DocStatus.TEMP) {
        throw new BadRequestException('임시저장 상태에서만 배부를 변경할 수 있습니다.');
      }
      if (order.createdBy !== operator) {
        throw new ForbiddenException('본인이 임시저장한 POR만 수정할 수 있습니다.');
      }
      const orderItems = await runner.manager.getRepository(PurchaseOrderItem).find({
        where: { companyId, orderId },
      });
      const itemByLine = new Map(orderItems.map((item) => [item.itemNo, item]));
      const requestIds = [...new Set(inputs.map((input) => input.prId))];
      const requestItems = await runner.manager.getRepository(PurchaseRequestItem).find({
        where: requestIds.map((requestId) => ({ companyId, requestId })),
      });
      const requestItemByKey = new Map(
        requestItems.map((item) => [`${item.requestId}:${item.itemNo}`, item]),
      );
      const inputKeys = new Set<string>();
      const orderTotals = new Map<number, Decimal>();
      const requestTotals = new Map<string, Decimal>();
      for (const input of inputs) {
        const orderItem = itemByLine.get(input.docItemNo);
        if (!orderItem) throw new BadRequestException(`PO item ${input.docItemNo}을 찾을 수 없습니다.`);
        const requestItem = requestItemByKey.get(`${input.prId}:${input.prItemNo}`);
        if (!requestItem) throw new BadRequestException('유효하지 않은 PR 배부 라인입니다.');
        if (requestItem.inventoryId !== orderItem.inventoryId) {
          throw new BadRequestException(`PO item ${input.docItemNo}과 자재가 일치하지 않습니다.`);
        }
        const key = `${input.docItemNo}:${input.prId}:${input.prItemNo}`;
        if (inputKeys.has(key)) throw new BadRequestException('중복된 배부 라인이 있습니다.');
        inputKeys.add(key);
        const qty = new Decimal(input.allocatedQty);
        if (!qty.isFinite() || qty.lte(0)) throw new BadRequestException('배부수량은 0보다 커야 합니다.');
        orderTotals.set(input.docItemNo, (orderTotals.get(input.docItemNo) ?? new Decimal(0)).add(qty));
        const requestKey = `${input.prId}:${input.prItemNo}`;
        requestTotals.set(requestKey, (requestTotals.get(requestKey) ?? new Decimal(0)).add(qty));
      }
      for (const [itemNo, item] of itemByLine) {
        const total = orderTotals.get(itemNo) ?? new Decimal(0);
        if (!total.eq(item.orderedQty)) {
          throw new BadRequestException(`PO item ${itemNo} 배부 합계가 발주수량과 다릅니다.`);
        }
      }
      for (const [key, total] of requestTotals) {
        const requestItem = requestItemByKey.get(key)!;
        if (total.gt(requestItem.qty)) {
          throw new BadRequestException(`PR 라인 ${key}의 요청수량을 초과했습니다.`);
        }
      }
      const repository = runner.manager.getRepository(Allocation);
      await repository.delete({ companyId, allocationType: 'PO', docId: orderId });
      await repository.save(inputs.map((input) => ({
        companyId,
        allocationType: 'PO' as const,
        docId: orderId,
        docItemNo: input.docItemNo,
        prId: input.prId,
        prItemNo: input.prItemNo,
        inventoryId: itemByLine.get(input.docItemNo)!.inventoryId,
        allocationQty: new Decimal(input.allocatedQty).toFixed(4),
      })));
      order.updatedBy = operator;
      await runner.manager.getRepository(PurchaseOrder).save(order);
      await runner.commitTransaction();
      return this.getOrderAllocations(companyId, orderId);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async close(
    companyId: string, requestId: string, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetConfirmed(companyId, await this.resolveRequestId(companyId, requestId));
    const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { companyId, purchaseRequestId: entity.id, deleteYn: 'N' },
    });
    if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
    if (![DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(order.status as DocStatus)) {
      throw new BadRequestException('확정된 POR만 종료할 수 있습니다.');
    }
    if (order.closedAt) throw new BadRequestException('이미 종료된 POR입니다.');
    order.closedAt = new Date();
    order.updatedBy = operator;
    await this.dataSource.getRepository(PurchaseOrder).save(order);
    return this.toResponse(entity);
  }

  async deleteRequest(
    companyId: string, requestId: string, operator: string, roleId: string,
  ): Promise<void> {
    const entity = await this.mustGetActive(companyId, requestId);
    await this.permissionPolicyService.assertCanDeleteOwnTempOrPermission({
      companyId,
      roleId,
      module: AppModule.PUR,
      status: entity.status,
      ownerId: entity.requesterId,
      operatorId: operator,
      resourceLabel: '구매',
    });
    if (entity.status !== DocStatus.TEMP) {
      throw new BadRequestException(
        '저장 상태(T)에서만 삭제할 수 있습니다. 확정 이후는 종료(E)로 처리하세요.',
      );
    }
    const fileGroupId = entity.fileGroupId;
    entity.deleteYn = 'Y';
    entity.updatedBy = operator;
    await this.dataSource.getRepository(PurchaseRequest).save(entity);
    await this.fileStorageService.deleteGroupByCompany(companyId, fileGroupId, operator);
  }

  private async mustGetActive(
    companyId: string, requestId: string,
  ): Promise<PurchaseRequest> {
    const entity = await this.procurementRepository.findOne(companyId, requestId);
    if (!entity) throw new NotFoundException('구매요청을 찾을 수 없습니다.');
    return entity;
  }

  private async resolveRequestId(companyId: string, id: string): Promise<string> {
    const request = await this.procurementRepository.findOne(companyId, id);
    if (request) return request.id;
    const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { companyId, id, deleteYn: 'N' },
    });
    if (!order) throw new NotFoundException('구매요청 또는 구매오더를 찾을 수 없습니다.');
    if (!order.purchaseRequestId) {
      throw new BadRequestException('통합 구매오더는 PR 번호로 처리할 수 없습니다. PO 기준 API를 사용하세요.');
    }
    return order.purchaseRequestId;
  }

  private async mustGetConfirmed(
    companyId: string, requestId: string,
  ): Promise<PurchaseRequest> {
    const entity = await this.mustGetActive(companyId, requestId);
    if (entity.status !== DocStatus.CONFIRMED) {
      throw new BadRequestException('결재완료(C) 상태가 아닙니다.');
    }
    return entity;
  }

  private async findLocked(
    manager: EntityManager, companyId: string, id: string,
  ): Promise<PurchaseRequest> {
    const entity = await manager.getRepository(PurchaseRequest)
      .createQueryBuilder('request')
      .setLock('pessimistic_write')
      .where('request.companyId = :companyId', { companyId })
      .andWhere('request.id = :id', { id })
      .andWhere('request.deleteYn = :notDeleted', { notDeleted: 'N' })
      .getOne();
    if (!entity) throw new NotFoundException('구매요청을 찾을 수 없습니다.');
    return entity;
  }

  private toResponse(entity: PurchaseRequest): PurchaseRequestResponse {
    return {
      companyId: entity.companyId,
      id: entity.id,
      plantId: entity.plantId,
      warehouseId: entity.warehouseId,
      requesterId: entity.requesterId,
      departmentId: entity.departmentId,
      requestDate: entity.requestDate,
      fileGroupId: entity.fileGroupId == null ? null : Number(entity.fileGroupId),
      title: entity.title,
      requestType: entity.requestType,
      approvalId: entity.approvalId,
      orderDate: entity.orderDate,
      etaDate: entity.etaDate,
      shipStartDate: entity.shipStartDate,
      purchaseManager: entity.purchaseManager,
      purchaseManagerContact: entity.purchaseManagerContact,
      purchaseManagerRemarks: entity.purchaseManagerRemarks,
      status: entity.status,
      remarks: entity.remarks,
      createdAt: entity.createdAt.toISOString(),
      createdBy: entity.createdBy,
    };
  }

  private toStandaloneOrderResponse(order: PurchaseOrder): PurchaseRequestResponse {
    return {
      companyId: order.companyId,
      id: order.id,
      plantId: order.plantId,
      warehouseId: order.warehouseId ?? '',
      requesterId: order.requesterId,
      departmentId: order.departmentId,
      requestDate: order.orderDate,
      requestType: null,
      fileGroupId: null,
      title: '독립 구매오더',
      approvalId: null,
      orderDate: order.orderDate,
      etaDate: order.etaDate,
      shipStartDate: null,
      purchaseManager: null,
      purchaseManagerContact: null,
      purchaseManagerRemarks: null,
      status: order.status,
      remarks: null,
      createdAt: order.createdAt.toISOString(),
      createdBy: order.createdBy,
      purchaseOrderId: order.id,
      closedAt: order.closedAt?.toISOString() ?? null,
    };
  }

}
