import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import Decimal from 'decimal.js';
import { SequenceService, AppModule } from '../../common/sequence/sequence.service';
import { InventoryTxService } from '../inventory-tx/inventory-tx.service';
import {
  DocStatus,
  ProcStatus,
  TxReason,
  TxType,
} from '../../common/constants/status.constants';
import { resolveActivePlantId } from '../../common/utils/plant.util';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';
import { User } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { Vendor } from '../../entities/vendor.entity';
import { ProcurementRepository } from './procurement.repository';
import { PermissionPolicyService } from '../../common/permissions/permission-policy.service';
import { FileStorageService } from '../file/file-storage.service';

export interface ItemLine {
  lineNo: number;
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
    vendorId?: string | null;
    remarks?: string | null;
    status?: string;
  };
  items?: ItemLine[];
}
export interface RequestDetail { header: PurchaseRequestResponse; items: ItemLine[] }
export interface OrderRequest {
  requestId: string; vendorId: string; purchaseManager: string;
  purchaseManagerContact?: string | null; purchaseManagerRemarks?: string | null;
  orderDate?: string | Date; etaDate?: string | Date;
}
export interface ShipRequest { requestId: string; shipStartDate?: string | Date }
export interface ReceiveLine { lineNo: number; qty: string; unitPrice: string }
export interface ReceiveRequest {
  requestId: string; warehouseId: string; txDate?: string | Date;
  lines?: ReceiveLine[]; close?: boolean;
}
export interface PurchaseRequestResponse {
  companyId: string; id: string; plantId: string; warehouseId: string;
  requesterId: string; departmentId: string | null; requestDate: string; requestType: string | null;
  fileGroupId: number | null;
  title: string; approvalId: string | null;
  vendorId: string | null; purchaseManager: string | null; purchaseManagerContact: string | null;
  purchaseManagerRemarks: string | null;
  orderDate: string | null; etaDate: string | null;
  shipStartDate: string | null; status: string; procStatus: string | null;
  remarks: string | null; createdAt: string; createdBy: string;
}
export interface ReceivableRequestResponse extends PurchaseRequestResponse {
  requestedQty: string;
  remainingQty: string;
}
export interface VendorRequest {
  id?: string;
  name?: string;
  bizNo?: string | null;
  contact?: string | null;
  manager?: string | null;
  remarks?: string | null;
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

  async getRequests(
    companyId: string,
    operator: string,
    requestedPlantId?: string | null,
  ): Promise<PurchaseRequestResponse[]> {
    return (await this.procurementRepository.findByRequester(
      companyId, operator,
    )).map((entity) => this.toResponse(entity));
  }

  async getManagementRequests(companyId: string): Promise<PurchaseRequestResponse[]> {
    return (await this.procurementRepository.findAll(companyId))
      .map((entity) => this.toResponse(entity));
  }

  getVendors(companyId: string): Promise<Vendor[]> {
    return this.dataSource.getRepository(Vendor).find({
      where: { companyId, deleteYn: 'N' },
      order: { name: 'ASC' },
    });
  }

  async createVendor(
    companyId: string,
    input: VendorRequest,
    operator: string,
  ): Promise<Vendor> {
    const id = input.id?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!id || !name) throw new BadRequestException('공급업체 코드와 이름은 필수입니다.');
    const repository = this.dataSource.getRepository(Vendor);
    const existing = await repository.findOne({ where: { companyId, id } });
    if (existing?.deleteYn === 'N') throw new BadRequestException('이미 존재하는 공급업체 코드입니다.');
    const vendor = existing ?? repository.create({
      companyId,
      id,
      createdBy: operator,
    });
    Object.assign(vendor, {
      name,
      bizNo: input.bizNo?.trim() || null,
      contact: input.contact?.trim() || null,
      manager: input.manager?.trim() || null,
      remarks: input.remarks?.trim() || null,
      deleteYn: 'N',
      updatedBy: operator,
    });
    return repository.save(vendor);
  }

  async updateVendor(
    companyId: string,
    id: string,
    input: VendorRequest,
    operator: string,
  ): Promise<Vendor> {
    const repository = this.dataSource.getRepository(Vendor);
    const vendor = await repository.findOne({
      where: { companyId, id: id.trim().toUpperCase(), deleteYn: 'N' },
    });
    if (!vendor) throw new NotFoundException('공급업체를 찾을 수 없습니다.');
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('공급업체 이름은 필수입니다.');
    Object.assign(vendor, {
      name,
      bizNo: input.bizNo?.trim() || null,
      contact: input.contact?.trim() || null,
      manager: input.manager?.trim() || null,
      remarks: input.remarks?.trim() || null,
      updatedBy: operator,
    });
    return repository.save(vendor);
  }

  async deleteVendor(companyId: string, id: string, operator: string): Promise<void> {
    const repository = this.dataSource.getRepository(Vendor);
    const vendor = await repository.findOne({
      where: { companyId, id: id.trim().toUpperCase(), deleteYn: 'N' },
    });
    if (!vendor) throw new NotFoundException('공급업체를 찾을 수 없습니다.');
    vendor.deleteYn = 'Y';
    vendor.updatedBy = operator;
    await repository.save(vendor);
  }

  async getRequestDetail(companyId: string, id: string): Promise<RequestDetail> {
    const request = await this.mustGetActive(companyId, id);
    const items = await this.procurementRepository.findItems(companyId, id);
    return {
      header: this.toResponse(request),
      items: items.map((item) => ({
        lineNo: item.lineNo,
        inventoryId: item.inventoryId,
        qty: item.qty,
        unit: item.unit,
        receivedQty: item.receivedQty,
        remarks: item.remarks,
      })),
    };
  }

  async getReceivableRequest(companyId: string, id: string): Promise<RequestDetail> {
    const request = await this.mustGetConfirmed(companyId, id);
    if (![ProcStatus.ORDERED, ProcStatus.SHIPPING, ProcStatus.PARTIAL_RECEIVED]
      .includes(request.procStatus as ProcStatus)) {
      throw new BadRequestException('발주·배송중·부분입고 상태의 구매요청만 입고할 수 있습니다.');
    }
    return this.getRequestDetail(companyId, id);
  }

  async getReceivableRequests(companyId: string): Promise<ReceivableRequestResponse[]> {
    const requests = (await this.procurementRepository.findAll(companyId))
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
    const multiPlant = await this.isMultiPlant(companyId, user.roleId);
    const plantId = multiPlant ? header.plantId : user.lastLoginPlantId;
    if (!plantId) {
      throw new BadRequestException('지정 플랜트가 없어 구매요청을 생성할 수 없습니다.');
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
          plantId,
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
        await this.permissionPolicyService.assertCanUpdateOwnTempOrPermission({
          companyId,
          roleId: roleId ?? '',
          module: AppModule.PUR,
          status: entity.status,
          ownerId: entity.requesterId,
          operatorId: operator,
          resourceLabel: '구매',
        });
        if (![DocStatus.TEMP, DocStatus.REJECTED].includes(entity.status as DocStatus)) {
          throw new BadRequestException('저장(T) 또는 반려(R) 상태에서만 수정할 수 있습니다.');
        }
        if (entity.status === DocStatus.REJECTED) {
          entity.approvalId = null;
          entity.status = DocStatus.TEMP;
        }
      }
      Object.assign(entity, {
        fileGroupId: header.fileGroupId ?? null,
        title: header.title?.trim() || '',
        warehouseId: header.warehouseId,
        vendorId: header.vendorId ?? null,
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
            lineNo: index + 1,
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
    entity.status = DocStatus.SELF_CONFIRMED;
    entity.updatedBy = operator;
    return this.toResponse(await this.dataSource.getRepository(PurchaseRequest).save(entity));
  }

  async placeOrder(
    companyId: string, req: OrderRequest, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const vendorId = req.vendorId?.trim();
    const purchaseManager = req.purchaseManager?.trim();
    if (!vendorId) throw new BadRequestException('벤더를 입력하세요.');
    if (!purchaseManager) throw new BadRequestException('구매담당자를 입력하세요.');
    const entity = await this.mustGetConfirmed(companyId, req.requestId);
    Object.assign(entity, {
      vendorId,
      purchaseManager,
      purchaseManagerContact: req.purchaseManagerContact?.trim() || null,
      purchaseManagerRemarks: req.purchaseManagerRemarks?.trim() || null,
      orderDate: dateOnly(req.orderDate) || today(),
      etaDate: dateOnly(req.etaDate),
      procStatus: ProcStatus.ORDERED,
      updatedBy: operator,
    });
    return this.toResponse(await this.dataSource.getRepository(PurchaseRequest).save(entity));
  }

  async startShipping(
    companyId: string, req: ShipRequest, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetConfirmed(companyId, req.requestId);
    entity.shipStartDate = dateOnly(req.shipStartDate) || today();
    entity.procStatus = ProcStatus.SHIPPING;
    entity.updatedBy = operator;
    return this.toResponse(await this.dataSource.getRepository(PurchaseRequest).save(entity));
  }

  async close(
    companyId: string, requestId: string, operator: string,
  ): Promise<PurchaseRequestResponse> {
    const entity = await this.mustGetConfirmed(companyId, requestId);
    if (entity.procStatus === ProcStatus.CLOSED) {
      throw new BadRequestException('이미 종료된 요청입니다.');
    }
    entity.procStatus = ProcStatus.CLOSED;
    entity.updatedBy = operator;
    return this.toResponse(await this.dataSource.getRepository(PurchaseRequest).save(entity));
  }

  async receive(
    companyId: string, req: ReceiveRequest, operator: string,
  ): Promise<PurchaseRequestResponse> {
    if (!req.lines?.length) throw new BadRequestException('입고 라인이 비어 있습니다.');
    if (!req.warehouseId) throw new BadRequestException('입고 창고를 선택하세요.');
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
        .andWhere('request.id = :requestId', { requestId: req.requestId })
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
      const itemRepository = runner.manager.getRepository(PurchaseRequestItem);
      const items = await itemRepository.createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.companyId = :companyId', { companyId })
        .andWhere('item.requestId = :requestId', { requestId: request.id })
        .orderBy('item.lineNo', 'ASC')
        .getMany();
      const changed = new Map<number, string>();
      const txItems = req.lines.map((line) => {
        const item = items.find((candidate) => candidate.lineNo === line.lineNo);
        if (!item) throw new BadRequestException(`PR 라인 ${line.lineNo}을 찾을 수 없습니다.`);
        const input = new Decimal(line.qty);
        if (!input.isFinite() || input.lte(0)) {
          throw new BadRequestException(`라인 ${line.lineNo}의 입고수량은 0보다 커야 합니다.`);
        }
        const received = new Decimal(item.receivedQty);
        const ordered = new Decimal(item.qty);
        const next = received.add(input);
        if (next.gt(ordered)) {
          throw new BadRequestException(
            `입고 수량을 초과합니다. 라인 ${line.lineNo}: 요청=${ordered.toFixed(4)}, `
            + `기입고=${received.toFixed(4)}, 입고=${input.toFixed(4)}, `
            + `잔여=${ordered.sub(received).toFixed(4)}`,
          );
        }
        changed.set(line.lineNo, next.toFixed(4));
        return {
          txTypeCode: TxType.IN,
          txReasonCode: TxReason.PURCHASE,
          warehouseId: req.warehouseId,
          inventoryId: item.inventoryId,
          qty: input.toString(),
          unitPrice: new Decimal(line.unitPrice ?? 0).toString(),
          txDate: new Date(txDate),
          docNo,
          refNo: request.id,
          refModule: AppModule.PUR,
          refLineNo: String(line.lineNo),
        };
      });
      await this.inventoryTxService.processTransactions(
        { items: txItems },
        { runner, companyId, userId: operator },
      );
      await itemRepository.save(items
        .filter((item) => changed.has(item.lineNo))
        .map((item) => {
          item.receivedQty = changed.get(item.lineNo)!;
          return item;
        }));
      const allReceived = items.every((item) =>
        new Decimal(changed.get(item.lineNo) ?? item.receivedQty).gte(item.qty));
      request.procStatus = req.close
        ? ProcStatus.CLOSED
        : allReceived ? ProcStatus.RECEIVED : ProcStatus.PARTIAL_RECEIVED;
      request.updatedBy = operator;
      const saved = await runner.manager.getRepository(PurchaseRequest).save(request);
      await runner.commitTransaction();
      return this.toResponse(saved);
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
        docNo,
        refNo: history.refNo ?? undefined,
        refModule: history.refModule ?? undefined,
      })),
    });
    if (firstType === TxType.IN && requestId) {
      const items = await this.procurementRepository.findItems(companyId, requestId);
      for (const history of histories) {
        const item = items.find(
          (candidate) => String(candidate.lineNo) === history.refLineNo,
        );
        if (!item) continue;
        item.receivedQty = Decimal.max(
          new Decimal(item.receivedQty).sub(history.qty), 0,
        ).toFixed(4);
      }
      await this.dataSource.getRepository(PurchaseRequestItem).save(items);
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

  private async mustGetConfirmed(
    companyId: string, requestId: string,
  ): Promise<PurchaseRequest> {
    const entity = await this.mustGetActive(companyId, requestId);
    if (![DocStatus.SELF_CONFIRMED, DocStatus.CONFIRMED].includes(entity.status as DocStatus)) {
      throw new BadRequestException('결재완료(C) 또는 직접확정(S) 상태가 아닙니다.');
    }
    return entity;
  }

  private async isMultiPlant(companyId: string, roleId: string | null): Promise<boolean> {
    if (!roleId) return false;
    const role = await this.dataSource.getRepository(Role).findOne({
      where: { companyId, id: roleId, deleteYn: 'N' },
    });
    return role?.multiPlant === 'Y';
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
      vendorId: entity.vendorId,
      purchaseManager: entity.purchaseManager,
      purchaseManagerContact: entity.purchaseManagerContact,
      purchaseManagerRemarks: entity.purchaseManagerRemarks,
      orderDate: entity.orderDate,
      etaDate: entity.etaDate,
      shipStartDate: entity.shipStartDate,
      status: entity.status,
      procStatus: entity.procStatus,
      remarks: entity.remarks,
      createdAt: entity.createdAt.toISOString(),
      createdBy: entity.createdBy,
    };
  }

}
