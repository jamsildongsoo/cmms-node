import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, MoreThan } from 'typeorm';
import Decimal from 'decimal.js';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { InventoryTxService, TxItem } from '../inventory-tx/inventory-tx.service';
import {
  DocStatus,
  ProcStatus,
  TxReason,
  TxType,
} from '../../common/constants/status.constants';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { Allocation } from '../../entities/allocation.entity';
import { InventoryDocument } from '../../entities/inventory-document.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { ProcurementRepository } from './procurement.repository';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import { FileStorageService } from '../file/file-storage.service';

export interface ItemLine {
  itemNo: number;
  inventoryId: string;
  qty: string;
  unit?: string | null;
  receivedQty?: string;
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
export interface OrderRequest {
  requestId: string;
  orderDate?: string | Date; etaDate?: string | Date;
}
export interface ShipRequest { requestId: string; shipStartDate?: string | Date }
export interface ReceiveLine { itemNo: number; qty: string; unitPrice: string }
export interface ReceiveRequest {
  requestId: string; warehouseId: string; txDate?: string | Date;
  lines?: ReceiveLine[]; close?: boolean;
}
export interface PurchaseRequestResponse {
  companyId: string; id: string; plantId: string; warehouseId: string;
  requesterId: string; departmentId: string | null; requestDate: string; requestType: string | null;
  fileGroupId: number | null;
  title: string; approvalId: string | null;
  orderDate: string | null; etaDate: string | null;
  shipStartDate: string | null;
  purchaseManager: string | null; purchaseManagerContact: string | null;
  purchaseManagerRemarks: string | null;
  status: string; procStatus: string | null;
  remarks: string | null; createdAt: string; createdBy: string;
  purchaseRequestId?: string;
  purchaseOrderId?: string;
}
export interface ReceivableRequestResponse extends PurchaseRequestResponse {
  requestedQty: string;
  remainingQty: string;
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
interface PurchaseOrderAllocationInput {
  docItemNo: number;
  prId: string;
  prItemNo: number;
  allocatedQty: string;
}
interface TransferOrderInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  txDate?: string;
  lines: Array<{ docItemNo: number; qty: string }>;
}
interface IntegratedOrderInput {
  orderDate?: string;
  etaDate?: string;
  lines: Array<{ prId: string; prItemNo: number; qty: string }>;
}
interface PrTransferInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  txDate?: string;
  lines: Array<{ prId: string; prItemNo: number; qty: string }>;
}
interface OrderReceiveInput {
  warehouseId: string;
  txDate?: string;
  lines: Array<{ itemNo: number; qty: string; unitPrice: string }>;
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
    private readonly inventoryTxService: InventoryTxService,
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
      requests = requests.filter((request) =>
        [DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(request.status as DocStatus)
        && [ProcStatus.ORDERED, ProcStatus.SHIPPING, ProcStatus.PARTIAL_RECEIVED]
          .includes(request.procStatus as ProcStatus));
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
  ): Promise<PurchaseRequestResponse[]> {
    const activePlantId = await resolveActivePlantId(
      this.dataSource, companyId, operator, requestedPlantId, AppModule.POR,
    );
    const orders = await this.dataSource.getRepository(PurchaseOrder).find({
      where: { companyId, deleteYn: 'N' },
      order: { id: 'DESC' },
    });
    const allocationRepository = this.dataSource.getRepository(Allocation);
    const result: PurchaseRequestResponse[] = [];
    for (const order of orders) {
      const seedAllocation = await allocationRepository.findOne({
        where: { companyId, allocationType: 'PO', docId: order.id },
        order: { prId: 'ASC', prItemNo: 'ASC' },
      });
      const requestId = order.purchaseRequestId ?? seedAllocation?.prId;
      if (!requestId) continue;
      const request = await this.dataSource.getRepository(PurchaseRequest).findOne({
        where: { companyId, id: requestId, deleteYn: 'N' },
      });
      if (!request || ![DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(request.status as DocStatus)) continue;
      if (activePlantId && request.plantId !== activePlantId) continue;
      if (receivableOnly && ![ProcStatus.ORDERED, ProcStatus.SHIPPING, ProcStatus.PARTIAL_RECEIVED]
        .includes(order.procStatus as ProcStatus)) continue;
      const response = this.toResponse(request);
      response.id = order.id;
      response.purchaseRequestId = order.purchaseRequestId ?? undefined;
      response.purchaseOrderId = order.id;
      response.warehouseId = order.warehouseId ?? '';
      response.orderDate = order.orderDate;
      response.etaDate = order.etaDate;
      response.shipStartDate = order.shipStartDate;
      response.procStatus = order.procStatus;
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
      if (requests.some((request) => ![DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(request.status as DocStatus))) {
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
        procStatus: ProcStatus.ORDERED,
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
          receivedQty: '0',
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
      response.procStatus = order.procStatus;
      return response;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
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
        receivedQty: item.receivedQty,
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

  async getPurchaseOrderDetail(
    companyId: string,
    id: string,
    operator?: string,
    requestedPlantId?: string | null,
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
    const requestId = order?.purchaseRequestId ?? seedAllocation?.prId ?? id;
    const detail = await this.getRequestDetail(companyId, requestId, operator, requestedPlantId);
    if (![DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED]
      .includes(detail.header.status as DocStatus)) {
      throw new NotFoundException('구매관리 대상 문서를 찾을 수 없습니다.');
    }
    if (order) {
      detail.header.id = order.id;
      detail.header.purchaseRequestId = order.purchaseRequestId ?? undefined;
      detail.header.purchaseOrderId = order.id;
      detail.header.orderDate = order.orderDate;
      detail.header.etaDate = order.etaDate;
      detail.header.shipStartDate = order.shipStartDate;
      detail.header.procStatus = order.procStatus;
      if (!order.purchaseRequestId) {
        const orderItems = await this.dataSource.getRepository(PurchaseOrderItem).find({
          where: { companyId, orderId: order.id },
          order: { itemNo: 'ASC' },
        });
        detail.items = orderItems.map((item) => ({
          itemNo: item.itemNo,
          inventoryId: item.inventoryId,
          qty: item.orderedQty,
          unit: item.unit,
          receivedQty: item.receivedQty,
        }));
      }
    }
    return detail;
  }

  async getReceivableRequest(companyId: string, id: string, operator: string): Promise<RequestDetail> {
    const request = await this.mustGetConfirmed(companyId, id);
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, null, AppModule.PUR);
    if (activePlantId && request.plantId !== activePlantId) {
      throw new ForbiddenException('현재 선택한 플랜트 범위의 구매요청만 조회할 수 있습니다.');
    }
    if (![ProcStatus.ORDERED, ProcStatus.SHIPPING, ProcStatus.PARTIAL_RECEIVED]
      .includes(request.procStatus as ProcStatus)) {
      throw new BadRequestException('발주·배송중·부분입고 상태의 구매요청만 입고할 수 있습니다.');
    }
    return this.getRequestDetail(companyId, id, operator);
  }

  async getReceivableRequests(companyId: string, operator: string): Promise<ReceivableRequestResponse[]> {
    const activePlantId = await resolveActivePlantId(this.dataSource, companyId, operator, null, AppModule.PUR);
    const requests = (await this.procurementRepository.findAll(companyId, activePlantId ?? undefined))
      .filter((request) =>
        [DocStatus.CONFIRMED, DocStatus.SELF_CONFIRMED].includes(request.status as DocStatus)
        && [ProcStatus.ORDERED, ProcStatus.SHIPPING, ProcStatus.PARTIAL_RECEIVED]
          .includes(request.procStatus as ProcStatus));
    const result: ReceivableRequestResponse[] = [];
    for (const request of requests) {
      const items = await this.procurementRepository.findItems(companyId, request.id);
      const requestedQty = items.reduce(
        (sum, item) => sum.add(item.qty), new Decimal(0),
      );
      const remainingQty = items.reduce(
        (sum, item) => sum.add(Decimal.max(new Decimal(item.qty).sub(item.receivedQty), 0)),
        new Decimal(0),
      );
      if (remainingQty.lte(0)) continue;
      result.push({
        ...this.toResponse(request),
        requestedQty: requestedQty.toFixed(4),
        remainingQty: remainingQty.toFixed(4),
      });
    }
    return result;
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
          procStatus: null,
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
            receivedQty: '0',
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

  async confirm(
    companyId: string, requestId: string, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetActive(companyId, requestId);
    if (entity.status !== DocStatus.TEMP) {
      throw new BadRequestException('저장 상태(T)에서만 확정할 수 있습니다.');
    }
    const count = await this.dataSource.getRepository(PurchaseRequestItem).count({
      where: { companyId, requestId },
    });
    if (!count) throw new BadRequestException('자재 라인이 없는 구매요청은 확정할 수 없습니다.');
    // 관리용 호환 경로. 일반 FE에서는 직접확정을 제거했지만 기존 관리 호출이
    // status='S'를 저장할 수 있도록 이 상태 전이와 후속 수량 처리를 유지한다.
    entity.status = DocStatus.SELF_CONFIRMED;
    entity.updatedBy = operator;
    return this.toResponse(await this.dataSource.getRepository(PurchaseRequest).save(entity));
  }

  async placeOrder(
    companyId: string, req: OrderRequest, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetConfirmed(companyId, await this.resolveRequestId(companyId, req.requestId));
    if (!entity.purchaseManager) {
      const manager = await this.dataSource.getRepository(User).findOne({
        select: { id: true, phone: true },
        where: { companyId, id: operator, deleteYn: 'N' },
      });
      if (!manager) throw new BadRequestException('구매담당자 정보를 찾을 수 없습니다.');
      entity.purchaseManager = manager.id;
      entity.purchaseManagerContact = manager.phone;
    }
    Object.assign(entity, {
      orderDate: dateOnly(req.orderDate) || today(),
      etaDate: dateOnly(req.etaDate),
      procStatus: ProcStatus.ORDERED,
      updatedBy: operator,
    });
    const saved = await this.dataSource.getRepository(PurchaseRequest).save(entity);
    const orderRepository = this.dataSource.getRepository(PurchaseOrder);
    const existingOrder = await orderRepository.findOne({
      where: { companyId, purchaseRequestId: entity.id },
    });
    if (!existingOrder) {
      const orderId = await this.sequenceService.generateNextNo(companyId, AppModule.POR, entity.departmentId);
      const order = orderRepository.create({
        companyId,
        id: orderId,
        purchaseRequestId: entity.id,
        plantId: entity.plantId,
        warehouseId: entity.warehouseId,
        requesterId: entity.requesterId,
        departmentId: entity.departmentId,
        orderDate: entity.orderDate!,
        etaDate: entity.etaDate,
        shipStartDate: entity.shipStartDate,
        procStatus: ProcStatus.ORDERED,
        closedAt: null,
        closeReason: null,
        createdBy: operator,
        updatedBy: operator,
        deleteYn: 'N',
      });
      await orderRepository.save(order);
      const requestItems = await this.procurementRepository.findItems(companyId, entity.id);
      await this.dataSource.getRepository(PurchaseOrderItem).save(requestItems.map((item) => ({
        companyId,
        orderId,
        itemNo: item.itemNo,
        purchaseRequestId: item.requestId,
        purchaseRequestItemNo: item.itemNo,
        inventoryId: item.inventoryId,
        orderedQty: item.qty,
        receivedQty: '0',
        unit: item.unit,
      })));
      await this.dataSource.getRepository(Allocation).save(requestItems.map((item) => ({
        companyId,
        allocationType: 'PO' as const,
        docId: orderId,
        docItemNo: item.itemNo,
        prId: item.requestId,
        prItemNo: item.itemNo,
        inventoryId: item.inventoryId,
        allocationQty: item.qty,
      })));
    } else {
      existingOrder.orderDate = entity.orderDate!;
      existingOrder.etaDate = entity.etaDate;
      existingOrder.procStatus = ProcStatus.ORDERED;
      existingOrder.updatedBy = operator;
      await orderRepository.save(existingOrder);
    }
    return this.toResponse(saved);
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
      if (order.procStatus !== ProcStatus.ORDERED) {
        throw new BadRequestException('발주 상태에서만 배부를 변경할 수 있습니다.');
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

  async transferOrder(
    companyId: string,
    orderId: string,
    input: TransferOrderInput,
    operator: string,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    if (!input.lines.length) throw new BadRequestException('이송 라인이 비어 있습니다.');
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('READ COMMITTED');
    try {
      const order = await runner.manager.getRepository(PurchaseOrder)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.companyId = :companyId', { companyId })
        .andWhere('order.id = :orderId', { orderId })
        .andWhere('order.deleteYn = :deleteYn', { deleteYn: 'N' })
        .getOne();
      if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
      if (input.sourceWarehouseId === input.targetWarehouseId) {
        throw new BadRequestException('출발창고와 도착창고는 달라야 합니다.');
      }
      if (order.warehouseId && input.targetWarehouseId !== order.warehouseId) {
        throw new BadRequestException('요청창고로만 이송할 수 있습니다.');
      }
      const inputLineKeys = new Set<number>();
      for (const line of input.lines) {
        if (inputLineKeys.has(line.docItemNo)) {
          throw new BadRequestException(`중복된 PO item 이송 라인입니다: ${line.docItemNo}`);
        }
        inputLineKeys.add(line.docItemNo);
      }
      const warehouses = await runner.manager.getRepository(Warehouse).find({
        where: [
          { companyId, id: input.sourceWarehouseId, deleteYn: 'N' },
          { companyId, id: input.targetWarehouseId, deleteYn: 'N' },
        ],
      });
      const source = warehouses.find((warehouse) => warehouse.id === input.sourceWarehouseId);
      const target = warehouses.find((warehouse) => warehouse.id === input.targetWarehouseId);
      if (!source || !target) throw new BadRequestException('유효한 이송 창고가 아닙니다.');
      if (source.plantId !== null || target.plantId === null) {
        throw new BadRequestException('공통 중앙창고에서 사업장 요청창고로만 이송할 수 있습니다.');
      }
      const transferDocNo = await this.sequenceService.generateNextNo(companyId, AppModule.STK, null);
      const orderItems = await runner.manager.getRepository(PurchaseOrderItem).find({
        where: { companyId, orderId },
      });
      const itemByLine = new Map(orderItems.map((item) => [item.itemNo, item]));
      const allocationRepository = runner.manager.getRepository(Allocation);
      const allocations = await allocationRepository.find({
        where: { companyId, allocationType: 'PO', docId: orderId },
        order: { docItemNo: 'ASC', prItemNo: 'ASC' },
      });
      if (!allocations.length) {
        throw new BadRequestException('PO allocation이 없어 이송할 수 없습니다.');
      }
      const requestIds = [...new Set(allocations.map((allocation) => allocation.prId))];
      const requests = await runner.manager.getRepository(PurchaseRequest).find({
        where: requestIds.map((requestId) => ({ companyId, id: requestId, deleteYn: 'N' })),
      });
      const requestById = new Map(requests.map((request) => [request.id, request]));
      const transferDocuments = await runner.manager.getRepository(InventoryDocument).find({
        where: { companyId, refModule: AppModule.POR, refNo: orderId, deleteYn: 'N' },
      });
      const movedAllocations = transferDocuments.length
        ? await allocationRepository.find({
          where: { companyId, allocationType: 'MOVE', docId: In(transferDocuments.map((doc) => doc.id)) },
        })
        : [];
      const movedByKey = new Map<string, Decimal>();
      for (const allocation of movedAllocations) {
        const key = `${allocation.prId}:${allocation.prItemNo}`;
        movedByKey.set(key, (movedByKey.get(key) ?? new Decimal(0)).add(allocation.allocationQty));
      }
      const allocationByLine = new Map<number, Allocation[]>();
      for (const allocation of allocations) {
        const list = allocationByLine.get(allocation.docItemNo) ?? [];
        list.push(allocation);
        allocationByLine.set(allocation.docItemNo, list);
      }
      const txItems: TxItem[] = [];
      const moveAllocations: Partial<Allocation>[] = [];
      const movedNowByKey = new Map<string, Decimal>();
      for (const line of input.lines) {
        const orderItem = itemByLine.get(line.docItemNo);
        if (!orderItem) throw new BadRequestException(`PO item ${line.docItemNo}을 찾을 수 없습니다.`);
        const lineAllocations = allocationByLine.get(line.docItemNo) ?? [];
        if (!lineAllocations.length) {
          throw new BadRequestException(`PO item ${line.docItemNo}의 allocation이 없습니다.`);
        }
        for (const allocation of lineAllocations) {
          const request = requestById.get(allocation.prId);
          if (!request || request.warehouseId !== input.targetWarehouseId) {
            throw new BadRequestException(
              `PO item ${line.docItemNo}은 선택한 요청창고로 이송할 수 없습니다. PR 요청창고별로 나누어 이송하세요.`,
            );
          }
        }
        const qty = new Decimal(line.qty);
        if (!qty.isFinite() || qty.lte(0)) throw new BadRequestException('이송수량은 0보다 커야 합니다.');
        let remaining = qty;
        for (const allocation of lineAllocations) {
          const moved = movedByKey.get(`${allocation.prId}:${allocation.prItemNo}`) ?? new Decimal(0);
          const available = new Decimal(allocation.allocationQty).sub(moved);
          if (available.lte(0)) continue;
          const applied = Decimal.min(available, remaining);
          moveAllocations.push({
            companyId,
            allocationType: 'MOVE',
            docId: transferDocNo,
            docItemNo: input.lines.indexOf(line) * 2 + 2,
            prId: allocation.prId,
            prItemNo: allocation.prItemNo,
            inventoryId: allocation.inventoryId,
            allocationQty: applied.toFixed(4),
          });
          const allocationKey = `${allocation.prId}:${allocation.prItemNo}`;
          movedNowByKey.set(
            allocationKey,
            (movedNowByKey.get(allocationKey) ?? new Decimal(0)).add(applied),
          );
          remaining = remaining.sub(applied);
          if (remaining.lte(0)) break;
        }
        if (remaining.gt(0)) throw new BadRequestException(`PO item ${line.docItemNo}의 미이송 수량을 초과했습니다.`);
        txItems.push({
          txTypeCode: TxType.MOVE,
          txReasonCode: TxReason.PLANT_TRANSFER,
          warehouseId: input.sourceWarehouseId,
          targetWarehouseId: input.targetWarehouseId,
          inventoryId: orderItem.inventoryId,
          qty: qty.toString(),
          txDate: input.txDate ? new Date(input.txDate) : new Date(),
          docNo: transferDocNo,
          refNo: order.id,
          refModule: AppModule.POR,
          refLineNo: String(line.docItemNo),
        });
      }
      await this.inventoryTxService.processTransactions(
        { items: txItems },
        { runner, companyId, userId: operator },
      );
      await allocationRepository.save(moveAllocations);
      const requestItemRepository = runner.manager.getRepository(PurchaseRequestItem);
      for (const requestId of requestIds) {
        const request = requestById.get(requestId);
        if (!request) continue;
        const requestItems = await requestItemRepository
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where('item.companyId = :companyId', { companyId })
          .andWhere('item.requestId = :requestId', { requestId })
          .orderBy('item.itemNo', 'ASC')
          .getMany();
        for (const item of requestItems) {
          const moved = movedNowByKey.get(`${requestId}:${item.itemNo}`);
          if (moved) {
            item.receivedQty = new Decimal(item.receivedQty).add(moved).toFixed(4);
          }
        }
        await requestItemRepository.save(requestItems);
        const allReceived = requestItems.length > 0 && requestItems.every((item) =>
          new Decimal(item.receivedQty).gte(item.qty),
        );
        request.procStatus = allReceived ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
        request.updatedBy = operator;
        await runner.manager.getRepository(PurchaseRequest).save(request);
      }
      await runner.commitTransaction();
      return this.getOrderAllocations(companyId, order.id);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async transferPurchaseRequests(
    companyId: string,
    input: PrTransferInput,
    operator: string,
  ): Promise<void> {
    if (!input.lines.length) throw new BadRequestException('이송 라인이 비어 있습니다.');
    if (input.sourceWarehouseId === input.targetWarehouseId) {
      throw new BadRequestException('출발창고와 도착창고는 달라야 합니다.');
    }
    const keys = new Set<string>();
    for (const line of input.lines) {
      const key = `${line.prId}:${line.prItemNo}`;
      if (keys.has(key)) throw new BadRequestException(`중복된 PR 이송 라인입니다: ${key}`);
      keys.add(key);
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('READ COMMITTED');
    try {
      const warehouses = await runner.manager.getRepository(Warehouse).find({
        where: [
          { companyId, id: input.sourceWarehouseId, deleteYn: 'N' },
          { companyId, id: input.targetWarehouseId, deleteYn: 'N' },
        ],
      });
      if (warehouses.length !== 2) throw new BadRequestException('유효한 이송 창고가 아닙니다.');
      const sourceWarehouse = warehouses.find((warehouse) => warehouse.id === input.sourceWarehouseId);
      const targetWarehouse = warehouses.find((warehouse) => warehouse.id === input.targetWarehouseId);
      if (!sourceWarehouse || !targetWarehouse || sourceWarehouse.plantId !== null || targetWarehouse.plantId === null) {
        throw new BadRequestException('PR 연계 이송은 공통 중앙창고에서 사업장 요청창고로만 처리할 수 있습니다.');
      }
      const requests = await runner.manager.getRepository(PurchaseRequest).find({
        where: [...new Set(input.lines.map((line) => line.prId))]
          .map((id) => ({ companyId, id, deleteYn: 'N' })),
      });
      if (requests.length !== new Set(input.lines.map((line) => line.prId)).size) {
        throw new NotFoundException('일부 구매요청을 찾을 수 없습니다.');
      }
      const requestById = new Map(requests.map((request) => [request.id, request]));
      const items = await runner.manager.getRepository(PurchaseRequestItem)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.companyId = :companyId', { companyId })
        .andWhere('item.requestId IN (:...requestIds)', {
          requestIds: [...requestById.keys()],
        })
        .getMany();
      const itemByKey = new Map(items.map((item) => [`${item.requestId}:${item.itemNo}`, item]));
      const existingMoves = await runner.manager.getRepository(Allocation).find({
        where: {
          companyId,
          allocationType: 'MOVE',
          prId: In([...requestById.keys()]),
        },
      });
      const movedByKey = new Map<string, Decimal>();
      for (const allocation of existingMoves) {
        const key = `${allocation.prId}:${allocation.prItemNo}`;
        movedByKey.set(key, (movedByKey.get(key) ?? new Decimal(0)).add(allocation.allocationQty));
      }
      const docNo = await this.sequenceService.generateNextNo(companyId, AppModule.STK, null);
      const txItems: TxItem[] = [];
      const moveAllocations: Partial<Allocation>[] = [];
      for (const line of input.lines) {
        const request = requestById.get(line.prId);
        const item = itemByKey.get(`${line.prId}:${line.prItemNo}`);
        if (!request || !item) throw new NotFoundException(`PR item을 찾을 수 없습니다: ${line.prId}:${line.prItemNo}`);
        if (request.warehouseId !== input.targetWarehouseId) {
          throw new BadRequestException('PR 요청창고와 이송 도착창고가 일치하지 않습니다.');
        }
        const qty = new Decimal(line.qty);
        const moved = movedByKey.get(`${line.prId}:${line.prItemNo}`) ?? new Decimal(0);
        const consumed = Decimal.max(new Decimal(item.receivedQty), moved);
        const available = new Decimal(item.qty).sub(consumed);
        if (qty.gt(available)) throw new BadRequestException(`PR item ${line.prId}:${line.prItemNo}의 이송 가능수량을 초과했습니다.`);
        moveAllocations.push({
          companyId,
          allocationType: 'MOVE',
          docId: docNo,
          docItemNo: input.lines.indexOf(line) * 2 + 2,
          prId: line.prId,
          prItemNo: line.prItemNo,
          inventoryId: item.inventoryId,
          allocationQty: qty.toFixed(4),
        });
        txItems.push({
          txTypeCode: TxType.MOVE,
          txReasonCode: TxReason.PLANT_TRANSFER,
          warehouseId: input.sourceWarehouseId,
          targetWarehouseId: input.targetWarehouseId,
          inventoryId: item.inventoryId,
          qty: qty.toString(),
          txDate: input.txDate ? new Date(input.txDate) : new Date(),
          docNo,
          refNo: line.prId,
          refModule: AppModule.PUR,
          refLineNo: String(line.prItemNo),
        });
        item.receivedQty = new Decimal(item.receivedQty).add(qty).toFixed(4);
        movedByKey.set(`${line.prId}:${line.prItemNo}`, moved.add(qty));
      }
      await this.inventoryTxService.processTransactions(
        { items: txItems },
        { runner, companyId, userId: operator },
      );
      await runner.manager.getRepository(Allocation).save(moveAllocations);
      await runner.manager.getRepository(PurchaseRequestItem).save(items);
      for (const request of requestById.values()) {
        const requestItems = items.filter((item) => item.requestId === request.id);
        const complete = requestItems.length > 0 && requestItems.every((item) =>
          new Decimal(item.receivedQty).gte(item.qty),
        );
        request.procStatus = complete ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
        request.updatedBy = operator;
      }
      await runner.manager.getRepository(PurchaseRequest).save([...requestById.values()]);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async startShipping(
    companyId: string, req: ShipRequest, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetConfirmed(companyId, await this.resolveRequestId(companyId, req.requestId));
    entity.shipStartDate = dateOnly(req.shipStartDate) || today();
    entity.procStatus = ProcStatus.SHIPPING;
    entity.updatedBy = operator;
    const saved = await this.dataSource.getRepository(PurchaseRequest).save(entity);
    const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { companyId, purchaseRequestId: entity.id, deleteYn: 'N' },
    });
    if (order) {
      order.shipStartDate = entity.shipStartDate;
      order.procStatus = ProcStatus.SHIPPING;
      order.updatedBy = operator;
      await this.dataSource.getRepository(PurchaseOrder).save(order);
    }
    return this.toResponse(saved);
  }

  async close(
    companyId: string, requestId: string, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetConfirmed(companyId, await this.resolveRequestId(companyId, requestId));
    if (entity.procStatus === ProcStatus.CLOSED) {
      throw new BadRequestException('이미 종료된 요청입니다.');
    }
    entity.procStatus = ProcStatus.CLOSED;
    entity.updatedBy = operator;
    const saved = await this.dataSource.getRepository(PurchaseRequest).save(entity);
    const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { companyId, purchaseRequestId: entity.id, deleteYn: 'N' },
    });
    if (order) {
      order.procStatus = ProcStatus.CLOSED;
      order.closedAt = new Date();
      order.updatedBy = operator;
      await this.dataSource.getRepository(PurchaseOrder).save(order);
    }
    return this.toResponse(saved);
  }

  async receive(
    companyId: string, req: ReceiveRequest, operator: string,
  ): Promise<PurchaseRequestResponse> {
    if (!req.lines?.length) throw new BadRequestException('입고 라인이 비어 있습니다.');
    if (!req.warehouseId) throw new BadRequestException('입고 창고를 선택하세요.');
    const requestId = await this.resolveRequestId(companyId, req.requestId);
    const user = await this.dataSource.getRepository(User).findOne({
      where: { companyId, id: operator, deleteYn: 'N' },
    });
    const docNo = await this.sequenceService.generateNextNo(
      companyId, AppModule.STK, user?.departmentId ?? null,
    );
    const txDate = dateOnly(req.txDate) || today();
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('READ COMMITTED');
    try {
      const request = await runner.manager.getRepository(PurchaseRequest)
        .createQueryBuilder('request')
        .setLock('pessimistic_write')
        .where('request.companyId = :companyId', { companyId })
        .andWhere('request.id = :requestId', { requestId })
        .andWhere('request.deleteYn = :deleteYn', { deleteYn: 'N' })
        .getOne();
      if (!request) throw new NotFoundException('구매요청을 찾을 수 없습니다.');
      if (![DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED].includes(request.status as DocStatus)) {
        throw new BadRequestException('결재완료(C) 또는 직접확정(S) 상태가 아닙니다.');
      }
      if (![ProcStatus.ORDERED, ProcStatus.SHIPPING, ProcStatus.PARTIAL_RECEIVED]
        .includes(request.procStatus as ProcStatus)) {
        throw new BadRequestException(
          `입고는 발주·배송중·부분입고 상태에서만 가능합니다. 현재: ${request.procStatus ?? 'null'}`,
        );
      }
      const warehouse = await runner.manager.getRepository(Warehouse).findOne({
        where: { companyId, id: req.warehouseId, deleteYn: 'N' },
      });
      if (!warehouse) throw new BadRequestException('유효한 입고 창고를 찾을 수 없습니다.');
      const directRequestReceipt = req.warehouseId === request.warehouseId;
      const itemRepository = runner.manager.getRepository(PurchaseRequestItem);
      const items = await itemRepository.createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.companyId = :companyId', { companyId })
        .andWhere('item.requestId = :requestId', { requestId: request.id })
        .orderBy('item.itemNo', 'ASC')
        .getMany();
      const order = await runner.manager.getRepository(PurchaseOrder).findOne({
        where: { companyId, purchaseRequestId: request.id, deleteYn: 'N' },
      });
      const orderItems = order
        ? await runner.manager.getRepository(PurchaseOrderItem)
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where('item.companyId = :companyId', { companyId })
          .andWhere('item.orderId = :orderId', { orderId: order.id })
        .orderBy('item.itemNo', 'ASC')
          .getMany()
        : [];
      const changed = new Map<number, string>();
      const txItems = req.lines.map((line) => {
        const orderItem = orderItems.find((candidate) => candidate.itemNo === line.itemNo);
        const item = items.find((candidate) =>
          candidate.itemNo === (orderItem?.purchaseRequestItemNo ?? line.itemNo));
        if (!item) throw new BadRequestException(`PR item ${line.itemNo}을 찾을 수 없습니다.`);
        const input = new Decimal(line.qty);
        if (!input.isFinite() || input.lte(0)) {
          throw new BadRequestException(`item ${line.itemNo}의 입고수량은 0보다 커야 합니다.`);
        }
        const received = new Decimal(orderItem?.receivedQty ?? (directRequestReceipt ? item.receivedQty : '0'));
        const ordered = new Decimal(orderItem?.orderedQty ?? item.qty);
        const next = received.add(input);
        if (next.gt(ordered)) {
          throw new BadRequestException(
            `입고 수량을 초과합니다. item ${line.itemNo}: 요청=${ordered.toFixed(4)}, `
            + `기입고=${received.toFixed(4)}, 입고=${input.toFixed(4)}, `
            + `잔여=${ordered.sub(received).toFixed(4)}`,
          );
        }
        changed.set(item.itemNo, next.toFixed(4));
        return {
          txTypeCode: TxType.IN,
          txReasonCode: TxReason.PURCHASE,
          warehouseId: req.warehouseId,
          inventoryId: orderItem?.inventoryId ?? item.inventoryId,
          qty: input.toString(),
          unitPrice: new Decimal(line.unitPrice ?? 0).toString(),
          txDate: new Date(txDate),
          docNo,
          refNo: request.id,
          refModule: AppModule.PUR,
          refLineNo: String(item.itemNo),
        };
      });
      await this.inventoryTxService.processTransactions(
        { items: txItems },
        { runner, companyId, userId: operator },
      );
      if (directRequestReceipt) {
        await itemRepository.save(items
          .filter((item) => changed.has(item.itemNo))
          .map((item) => {
            item.receivedQty = changed.get(item.itemNo)!;
            return item;
          }));
        const allReceived = items.every((item) =>
          new Decimal(changed.get(item.itemNo) ?? item.receivedQty).gte(item.qty));
        request.procStatus = req.close
          ? ProcStatus.CLOSED
          : allReceived ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
        request.updatedBy = operator;
      }
      const saved = directRequestReceipt
        ? await runner.manager.getRepository(PurchaseRequest).save(request)
        : request;
      if (order) {
        for (const orderItem of orderItems) {
          const received = orderItem.purchaseRequestItemNo == null
            ? undefined
            : changed.get(orderItem.purchaseRequestItemNo);
          if (received !== undefined) orderItem.receivedQty = received;
        }
        await runner.manager.getRepository(PurchaseOrderItem).save(orderItems);
        const orderComplete = orderItems.length > 0 && orderItems.every((item) =>
          new Decimal(item.receivedQty).gte(item.orderedQty));
        order.procStatus = orderComplete ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
        if (directRequestReceipt && request.procStatus === ProcStatus.CLOSED) order.closedAt = new Date();
        order.updatedBy = operator;
        await runner.manager.getRepository(PurchaseOrder).save(order);
      }
      await runner.commitTransaction();
      return this.toResponse(saved);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async receiveOrder(
    companyId: string,
    orderId: string,
    input: OrderReceiveInput,
    operator: string,
  ): Promise<void> {
    if (!input.lines.length) throw new BadRequestException('입고 라인이 비어 있습니다.');
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('READ COMMITTED');
    try {
      const order = await runner.manager.getRepository(PurchaseOrder)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.companyId = :companyId', { companyId })
        .andWhere('order.id = :orderId', { orderId })
        .andWhere('order.deleteYn = :deleteYn', { deleteYn: 'N' })
        .getOne();
      if (!order) throw new NotFoundException('구매오더를 찾을 수 없습니다.');
      const warehouse = await runner.manager.getRepository(Warehouse).findOne({
        where: { companyId, id: input.warehouseId, deleteYn: 'N' },
      });
      if (!warehouse) throw new BadRequestException('유효한 입고 창고를 찾을 수 없습니다.');
      const orderItems = await runner.manager.getRepository(PurchaseOrderItem)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.companyId = :companyId', { companyId })
        .andWhere('item.orderId = :orderId', { orderId })
        .orderBy('item.itemNo', 'ASC')
        .getMany();
      const itemByNo = new Map(orderItems.map((item) => [item.itemNo, item]));
      const allocations = await runner.manager.getRepository(Allocation).find({
        where: { companyId, allocationType: 'PO', docId: orderId },
      });
      const requestIds = [...new Set(allocations.map((allocation) => allocation.prId))];
      const requests = requestIds.length
        ? await runner.manager.getRepository(PurchaseRequest).find({
          where: requestIds.map((id) => ({ companyId, id, deleteYn: 'N' })),
        })
        : [];
      const requestById = new Map(requests.map((request) => [request.id, request]));
      const requestItems = requestIds.length
        ? await runner.manager.getRepository(PurchaseRequestItem).find({
          where: requestIds.map((requestId) => ({ companyId, requestId })),
        })
        : [];
      const requestItemByKey = new Map(requestItems.map((item) => [`${item.requestId}:${item.itemNo}`, item]));
      const duplicateLines = new Set<number>();
      const txItems: TxItem[] = [];
      const directCredit = new Map<string, Decimal>();
      for (const line of input.lines) {
        if (duplicateLines.has(line.itemNo)) throw new BadRequestException(`중복된 PO item입니다: ${line.itemNo}`);
        duplicateLines.add(line.itemNo);
        const orderItem = itemByNo.get(line.itemNo);
        if (!orderItem) throw new NotFoundException(`PO item을 찾을 수 없습니다: ${line.itemNo}`);
        const qty = new Decimal(line.qty);
        const received = new Decimal(orderItem.receivedQty);
        const remaining = new Decimal(orderItem.orderedQty).sub(received);
        if (!qty.isFinite() || qty.lte(0) || qty.gt(remaining)) {
          throw new BadRequestException(`PO item ${line.itemNo}의 잔여 입고수량을 초과했습니다.`);
        }
        const lineAllocations = allocations.filter((allocation) => allocation.docItemNo === line.itemNo);
        const targetWarehouses = [...new Set(lineAllocations.map((allocation) =>
          requestById.get(allocation.prId)?.warehouseId).filter((id): id is string => Boolean(id)))];
        const isCentralReceipt = warehouse.plantId === null;
        if (!isCentralReceipt && (targetWarehouses.length !== 1 || targetWarehouses[0] !== input.warehouseId)) {
          throw new BadRequestException('통합 PO의 요청창고 직접입고는 같은 요청창고 라인만 처리할 수 있습니다.');
        }
        txItems.push({
          txTypeCode: TxType.IN,
          txReasonCode: TxReason.PURCHASE,
          warehouseId: input.warehouseId,
          inventoryId: orderItem.inventoryId,
          qty: qty.toString(),
          unitPrice: new Decimal(line.unitPrice).toString(),
          txDate: input.txDate ? new Date(input.txDate) : new Date(),
          refNo: order.id,
          refModule: AppModule.POR,
          refLineNo: String(line.itemNo),
        });
        orderItem.receivedQty = received.add(qty).toFixed(4);
        if (!isCentralReceipt) {
          let remainingToCredit = qty;
          for (const allocation of lineAllocations) {
            const requestItem = requestItemByKey.get(`${allocation.prId}:${allocation.prItemNo}`);
            if (!requestItem) continue;
            const creditable = Decimal.max(new Decimal(requestItem.qty).sub(requestItem.receivedQty), 0);
            const credited = Decimal.min(creditable, remainingToCredit, allocation.allocationQty);
            if (credited.gt(0)) {
              requestItem.receivedQty = new Decimal(requestItem.receivedQty).add(credited).toFixed(4);
              directCredit.set(allocation.prId, (directCredit.get(allocation.prId) ?? new Decimal(0)).add(credited));
              remainingToCredit = remainingToCredit.sub(credited);
            }
            if (remainingToCredit.lte(0)) break;
          }
          if (remainingToCredit.gt(0)) throw new BadRequestException(`PO item ${line.itemNo}의 PR 배부수량을 확인할 수 없습니다.`);
        }
      }
      await this.inventoryTxService.processTransactions(
        { items: txItems },
        { runner, companyId, userId: operator },
      );
      await runner.manager.getRepository(PurchaseOrderItem).save(orderItems);
      if (directCredit.size) {
        await runner.manager.getRepository(PurchaseRequestItem).save(requestItems);
        for (const requestId of directCredit.keys()) {
          const request = requestById.get(requestId);
          const related = requestItems.filter((item) => item.requestId === requestId);
          if (request && related.every((item) => new Decimal(item.receivedQty).gte(item.qty))) {
            request.procStatus = ProcStatus.RECEIVED;
            request.updatedBy = operator;
          } else if (request) {
            request.procStatus = ProcStatus.PARTIAL_RECEIVED;
            request.updatedBy = operator;
          }
        }
        await runner.manager.getRepository(PurchaseRequest).save([...requestById.values()]);
      }
      order.procStatus = orderItems.every((item) => new Decimal(item.receivedQty).gte(item.orderedQty))
        ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
      order.updatedBy = operator;
      await runner.manager.getRepository(PurchaseOrder).save(order);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async cancelSlip(
    companyId: string, docNo: string, _operator: string,
  ): Promise<void> {
    const historyRepository = this.dataSource.getRepository(InventoryHistory);
    const histories = await historyRepository.find({
      where: { companyId, docNo },
      order: { historyNo: 'ASC' },
    });
    if (!histories.length) {
      throw new BadRequestException(`전표를 찾을 수 없습니다: ${docNo}`);
    }
    const firstType = histories[0].txTypeCode;
    if (firstType !== TxType.IN && firstType !== TxType.OUT) {
      throw new BadRequestException(`IN/OUT 전표만 취소 가능합니다 (현재: ${firstType}).`);
    }
    let requestId: string | null = null;
    for (const history of histories) {
      if (history.txTypeCode !== firstType) {
        throw new BadRequestException('동일 전표 내 거래 타입이 일관되지 않습니다.');
      }
      if (!requestId && history.refModule === AppModule.PUR) requestId = history.refNo;
      const subsequent = await historyRepository.exists({
        where: {
          companyId,
          warehouseId: history.warehouseId,
          inventoryId: history.inventoryId,
          historyNo: MoreThan(history.historyNo),
        },
      });
      if (subsequent) {
        throw new BadRequestException(
          `후속 거래가 있어 취소할 수 없습니다 (품목 ${history.inventoryId}).`,
        );
      }
    }
    const reverseType = firstType === TxType.IN ? TxType.OUT : TxType.IN;
    await this.inventoryTxService.processTransactions({
      items: histories.map((history) => ({
        warehouseId: history.warehouseId,
        inventoryId: history.inventoryId,
        txTypeCode: reverseType,
        txReasonCode: TxReason.GENERAL,
        qty: new Decimal(history.qty).abs().toString(),
        ...(firstType === TxType.OUT
          ? { unitPrice: new Decimal(history.unitPrice).toString() } : {}),
        txDate: new Date(),
        refNo: docNo,
        refModule: AppModule.STK,
        refLineNo: history.refLineNo ?? undefined,
      })),
    });
    if (firstType === TxType.IN && requestId) {
      const items = await this.procurementRepository.findItems(companyId, requestId);
      for (const history of histories) {
        const item = items.find(
          (candidate) => String(candidate.itemNo) === history.refLineNo,
        );
        if (!item) continue;
        item.receivedQty = Decimal.max(
          new Decimal(item.receivedQty).sub(history.qty), 0,
        ).toFixed(4);
      }
      await this.dataSource.getRepository(PurchaseRequestItem).save(items);
      const order = await this.dataSource.getRepository(PurchaseOrder).findOne({
        where: { companyId, purchaseRequestId: requestId, deleteYn: 'N' },
      });
      if (order) {
        const orderItems = await this.dataSource.getRepository(PurchaseOrderItem).find({
          where: { companyId, orderId: order.id },
        });
        for (const orderItem of orderItems) {
          const requestItem = items.find((item) => item.itemNo === orderItem.purchaseRequestItemNo);
          if (requestItem) orderItem.receivedQty = requestItem.receivedQty;
        }
        await this.dataSource.getRepository(PurchaseOrderItem).save(orderItems);
        const allReceived = orderItems.length > 0 && orderItems.every((item) =>
          new Decimal(item.receivedQty).gte(item.orderedQty));
        order.procStatus = allReceived ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
        order.updatedBy = _operator;
        await this.dataSource.getRepository(PurchaseOrder).save(order);
      }
    }
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
    if (![DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED].includes(entity.status as DocStatus)) {
      throw new BadRequestException('결재완료(C) 또는 직접확정(S) 상태가 아닙니다.');
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
      procStatus: entity.procStatus,
      remarks: entity.remarks,
      createdAt: entity.createdAt.toISOString(),
      createdBy: entity.createdBy,
    };
  }

}
