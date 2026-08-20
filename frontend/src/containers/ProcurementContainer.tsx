import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import ProcurementRequestPrint from '../components/ProcurementRequestPrint';
import PurchaseOrderPrint from '../components/PurchaseOrderPrint';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleAction, hasModuleCreate, hasModuleRead, hasModuleUpdate } from '../utils/moduleAccess';
import { ShoppingCart, Plus, Printer, FileText, Link2 } from 'lucide-react';
import {
  getCommonStatusLabel,
} from '../constants/status';
import { APP_MODULE } from '../constants/module';
import { formatDateOnly, formatDateTimeSeconds, todayLocal } from '../utils/datetime';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import ApprovalDraftModal from '../features/approval/components/ApprovalDraftModal';
import { loadApprovalSignatureSteps } from '../features/approval/approval-signature';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import { openListPrint } from '../utils/listPrint';
import { createProcurementApprovalContent } from '../utils/procurementApprovalContent';
import { toastApiError } from '../utils/apiError';
import type { CodeItem, Department, Plant, Warehouse } from '../features/mdm/mdm.types';
import type { InventoryReference as InventoryRef } from '../features/master/master-reference.types';
import type {
  PurchaseOrderAllocation,
  PurchaseOrderLink,
  PurchaseRequest,
  PurchaseRequestItem,
} from '../features/procurement/procurement.types';
import { procurementApi } from '../features/procurement/procurement.api';
import { mdmLookupApi } from '../features/mdm/reference.api';
import { masterLookupApi } from '../features/master/master-reference.api';
import type { ReferenceUser } from '../features/mdm/mdm.types';
import PurchaseRequestFormModal from '../features/procurement/components/PurchaseRequestFormModal';
import PurchaseOrderFormModal from '../features/procurement/components/PurchaseOrderFormModal';


function resolveDepartmentName(depts: Department[], departmentId?: string | null) {
  return depts.find((dept) => dept.id === departmentId)?.name || departmentId || '-';
}

export default function ProcurementContainer({
  view,
}: {
  view: 'request' | 'order';
}) {
  const mode = view === 'order' ? 'management' : 'request';
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const canRequestRead = hasModuleRead(user?.moduleAccess, APP_MODULE.PUR);
  const canManageRead = hasModuleRead(user?.moduleAccess, APP_MODULE.POR);
  const canConfirmOrder = hasModuleAction(user?.moduleAccess, APP_MODULE.POR, 'A');
  const canRead = mode === 'management' ? canManageRead : canRequestRead;

  // ============ 공통 데이터 ============
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [prTypes, setPrTypes] = useState<CodeItem[]>([]);
  const [inventories, setInventories] = useState<InventoryRef[]>([]);
  const [usersList, setUsersList] = useState<ReferenceUser[]>([]);

  const loadRefs = useCallback(async () => {
    try {
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 구매요청/구매관리 R 권한을 대체하지 않는다.
      const [warehouseItems, plantItems, deptItems, typeItems, inventoryItems, userItems] =
        await Promise.all([
          mdmLookupApi.getWarehouseOptions(),
          mdmLookupApi.getPlantOptions(),
          mdmLookupApi.getDepartmentOptions(),
          mdmLookupApi.getProcurementTypeOptions(),
          masterLookupApi.getInventories(),
          mdmLookupApi.getUserOptions(),
        ]);
      setWarehouses(warehouseItems);
      setPlants(plantItems);
      setDepts(deptItems);
      setPrTypes(typeItems);
      setInventories(inventoryItems);
      setUsersList(userItems);
    } catch (error: unknown) {
      console.error('구매 기준정보 조회 실패', error);
      toastApiError(error, '구매 기준정보를 불러오지 못했습니다.');
    }
  }, []);
  useEffect(() => {
    const run = async () => {
      await loadRefs();
    };
    void run();
  }, [loadRefs]);

  // ============ 구매요청 ============
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orderLinks, setOrderLinks] = useState<{ requestId: string; links: PurchaseOrderLink[] } | null>(null);
  const [inventoryDocuments, setInventoryDocuments] = useState<Array<{ id: string; txDate: string; createdBy: string; createdAt: string; reverseDocumentId: string | null }> | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [tempOnly, setTempOnly] = useState(false);
  const filteredRequests = useMemo(() => {
    if (tempOnly) return requests;
    const keyword = searchValue.trim().toLowerCase();
    return requests.filter((request) => {
      if (!keyword) return true;
      if (searchType === 'id') return request.id.toLowerCase().includes(keyword);
      if (searchType === 'title') {
        return (request.title || '').toLowerCase().includes(keyword);
      }
      const requester = usersList.find((candidate) => candidate.id === request.requesterId);
      return `${request.requesterId} ${requester?.name || ''}`.toLowerCase().includes(keyword);
    });
  }, [requests, searchType, searchValue, tempOnly, usersList]);
  const loadRequests = useCallback(async () => {
    if (!canRead) return;
    try {
      const response = mode === 'management'
        ? await procurementApi.getOrders(false, activePlantId, tempOnly)
        : await procurementApi.getRequests(false, activePlantId, tempOnly);
      setRequests(response.map((request) => ({
        ...request,
        requestDate: formatDateOnly(request.requestDate),
        orderDate: formatDateOnly(request.orderDate) || null,
        etaDate: formatDateOnly(request.etaDate) || null,
        shipStartDate: formatDateOnly(request.shipStartDate) || null,
      })));
    } catch (e) { console.error(e); }
  }, [activePlantId, canRead, mode, tempOnly]);
  useEffect(() => {
    const run = async () => {
      await loadRequests();
    };
    void run();
  }, [loadRequests]);

  const createIntegratedOrder = async () => {
    if (selectedRequestIds.length < 1) {
      toast.error('통합 발주할 구매요청을 선택하세요.');
      return;
    }
    try {
      const details = await Promise.all(selectedRequestIds.map((id) => procurementApi.getRequest(id, activePlantId)));
      const lines = details.flatMap((detail) => detail.items.map((item) => ({
        prId: detail.header.id,
        prItemNo: item.itemNo!,
        qty: Number(item.qty),
      })));
      const created = await procurementApi.createIntegratedOrder({ lines });
      toast.success(`통합 PO ${created.id}가 생성되었습니다.`);
      setSelectedRequestIds([]);
      await loadRequests();
    } catch (error: unknown) {
      toastApiError(error, '통합 발주 생성에 실패했습니다.');
    }
  };

  const openOrderLinks = async (requestId: string) => {
    try {
      const links = await procurementApi.getPurchaseOrderLinks(requestId);
      setOrderLinks({ requestId, links });
    } catch (error: unknown) {
      toastApiError(error, '발주정보를 불러오지 못했습니다.');
    }
  };

  const openInventoryDocuments = async (orderId: string) => {
    try {
      setInventoryDocuments(await procurementApi.getOrderInventoryDocuments(orderId));
    } catch (error: unknown) {
      toastApiError(error, '재고전표 이력을 불러오지 못했습니다.');
    }
  };

  // 신규/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [formHeader, setFormHeader] = useState<Partial<PurchaseRequest>>({ requestDate: todayLocal() });
  const [formItems, setFormItems] = useState<PurchaseRequestItem[]>([{ itemNo: 1, inventoryId: '', qty: 0, unit: '' }]);
  const [allocations, setAllocations] = useState<PurchaseOrderAllocation[]>([]);
  const [approvalRef, setApprovalRef] = useState<PurchaseRequest | null>(null);
  const [detailMode, setDetailMode] = useState<'create' | 'create-order' | 'request' | 'management'>('request');

  const openNewForm = () => {
    setDetailMode('create');
    setFormHeader({
      requestDate: todayLocal(),
      plantId: activePlantId || user?.homePlantId || '',
      departmentId: user?.departmentId || '',
      fileGroupId: null,
    });
    setFormItems([{ itemNo: 1, inventoryId: '', qty: 0, unit: '' }]);
    setFormOpen(true);
  };

  const openNewOrderForm = () => {
    setDetailMode('create-order');
    setFormHeader({
      plantId: activePlantId || user?.homePlantId || '',
      warehouseId: '',
      etaDate: null,
      fileGroupId: null,
    });
    setFormItems([{ itemNo: 1, inventoryId: '', qty: 0, unit: '' }]);
    setAllocations([]);
    setFormOpen(true);
  };

  const openDetailForm = async (request: PurchaseRequest) => {
    try {
      const response = mode === 'management'
        ? await procurementApi.getOrder(request.id, activePlantId)
        : await procurementApi.getRequest(request.id, activePlantId);
      setDetailMode(mode === 'management' ? 'management' : 'request');
      const isRejected = mode === 'request' && response.header.status === 'R';
      setFormHeader({
        ...response.header,
        ...(isRejected ? {
          id: undefined,
          status: 'T',
          requesterId: user?.id,
          createdAt: undefined,
          approvalId: undefined,
        } : {}),
        requestDate: formatDateOnly(response.header.requestDate),
        orderDate: formatDateOnly(response.header.orderDate) || null,
        etaDate: formatDateOnly(response.header.etaDate) || null,
        shipStartDate: formatDateOnly(response.header.shipStartDate) || null,
      });
      setFormItems(response.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
      })));
      if (mode === 'management' && response.header.purchaseOrderId) {
        setAllocations(await procurementApi.getOrderAllocations(response.header.purchaseOrderId));
      } else {
        setAllocations([]);
      }
      setFormOpen(true);
    } catch (error: unknown) {
      toastApiError(error, '구매요청을 불러오지 못했습니다.');
    }
  };

  const saveAllocations = async () => {
    if (!formHeader.id || !allocations.length) return;
    const totals = allocations.reduce<Record<number, number>>((result, line) => {
      result[line.docItemNo] = (result[line.docItemNo] || 0) + Number(line.allocatedQty);
      return result;
    }, {});
    const invalid = allocations.some((line) => !Number.isFinite(Number(line.allocatedQty)) || Number(line.allocatedQty) <= 0);
    if (invalid) { toast.error('배부수량은 0보다 커야 합니다.'); return; }
    const orderLines = new Map(formItems.map((item, index) => [index + 1, Number(item.qty)]));
    if (Object.entries(totals).some(([lineNo, total]) => Math.abs(total - (orderLines.get(Number(lineNo)) || 0)) > 0.0001)) {
      toast.error('배부 합계가 발주수량과 일치해야 합니다.');
      return;
    }
    try {
      const saved = await procurementApi.saveOrderAllocations(formHeader.id, allocations.map((line) => ({
        docItemNo: line.docItemNo,
        prId: line.prId,
        prItemNo: line.prItemNo,
        allocatedQty: Number(line.allocatedQty),
      })));
      setAllocations(saved);
      toast.success('배부 정보가 저장되었습니다.');
    } catch (error: unknown) { toastApiError(error, '배부 정보 저장에 실패했습니다.'); }
  };

  const submitForm = async (action: 'T' | 'P' | 'S') => {
    const isOrderForm = detailMode === 'create-order' || detailMode === 'management';
    if (!isOrderForm && !formHeader.title?.trim()) { toast.error('제목을 입력하세요.'); return; }
    if (!isOrderForm && !formHeader.warehouseId) { toast.error('예정 창고를 선택하세요.'); return; }
    if (!formHeader.plantId) { toast.error('플랜트를 선택하세요.'); return; }
    if (formItems.length === 0 || !formItems[0].inventoryId) { toast.error('자재 라인을 1개 이상 입력하세요.'); return; }
    try {
      const saveItems = formItems.map((item, index) => ({ ...item, itemNo: index + 1 }));
      if (detailMode === 'create-order') {
        const saved = await procurementApi.createStandaloneOrder({
          plantId: formHeader.plantId,
          warehouseId: formHeader.warehouseId || null,
          orderDate: formHeader.orderDate || todayLocal(),
          etaDate: formHeader.etaDate || undefined,
          items: saveItems,
        });
        setFormHeader(saved);
        if (action === 'S') {
          await procurementApi.confirmOrder(saved.id);
          toast.success('구매오더가 확정되었습니다.');
        } else {
          toast.success('구매오더가 임시저장되었습니다.');
        }
        setFormOpen(false);
        await loadRequests();
        return;
      }
      if (detailMode === 'management' && formHeader.id) {
        const detail = await procurementApi.updateOrder(formHeader.id, {
          plantId: formHeader.plantId,
          warehouseId: formHeader.warehouseId || null,
          orderDate: formHeader.orderDate || todayLocal(),
          etaDate: formHeader.etaDate || undefined,
          items: allocations.length > 0 || formHeader.purchaseRequestId ? undefined : saveItems,
        });
        setFormHeader(detail.header);
        setFormItems(detail.items.map((item) => ({ ...item, qty: Number(item.qty) })));
        toast.success('구매오더 임시저장이 수정되었습니다.');
        setFormOpen(false);
        await loadRequests();
        return;
      }
      const header = { ...formHeader, status: 'T' };
      const saved = formHeader.id
        ? await procurementApi.update(formHeader.id, header, saveItems)
        : await procurementApi.create(header, saveItems);
      setFormHeader(saved);
      if (action === 'P') {
        setApprovalRef(saved);
        return;
      }
      toast.success('구매요청이 임시저장되었습니다.');
      setFormOpen(false);
      await loadRequests();
    } catch (error: unknown) {
      toastApiError(error, detailMode === 'create-order'
        ? '구매오더 처리에 실패했습니다.'
        : '구매요청 처리에 실패했습니다.');
    }
  };

  const confirmPurchaseOrder = async () => {
    if (!formHeader.id) return;
    try {
      await procurementApi.confirmOrder(formHeader.id);
      toast.success('POR가 확정되었습니다.');
      await openDetailForm({ ...formHeader, id: formHeader.id, status: 'S' } as PurchaseRequest);
      await loadRequests();
    } catch (error: unknown) { toastApiError(error, 'POR 확정에 실패했습니다.'); }
  };

  const closeRequest = async (id: string) => {
    const message = mode === 'management'
      ? '총괄 관리자 권한으로 요청부서·창고담당자를 대신해 구매요청을 종료합니다.\n미입고 잔여 수량은 더 이상 입고할 수 없습니다.\n정말 종료하시겠습니까?'
      : '이 요청을 종료(E)하시겠습니까? (미입고 잔여는 닫힙니다)';
    if (!(await requestConfirmation(message, '종료 처리'))) return;
    try {
      await procurementApi.closeRequest(id);
      if (formHeader.id === id) {
        setFormOpen(false);
      }
      await loadRequests();
    }
    catch (error: unknown) { toastApiError(error, '종료 실패'); }
  };

  const deleteRequest = async (id: string) => {
    if (!(await requestConfirmation('이 저장중인 요청을 삭제하시겠습니까?'))) return;
    try {
      await procurementApi.deleteRequest(id);
      if (formHeader.id === id) {
        setFormOpen(false);
      }
      await loadRequests();
    }
    catch (error: unknown) { toastApiError(error, '삭제 실패'); }
  };

  // 목록 인쇄
  // 목록 인쇄
  const handlePrint = () => {
    const stamp = formatDateTimeSeconds(new Date());
    const common = {
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
    };
    const opened = openListPrint({
      ...common,
      title: mode === 'management' ? '구매오더 목록' : '구매요청 목록',
      rows: filteredRequests,
      getRowKey: (request) => request.id,
      columns: [
        { header: '문서번호', render: (request) => request.id, className: 'font-mono' },
        { header: '작성일자', render: (request) => request.requestDate || '-' },
        { header: '플랜트/창고', render: (request) => `${request.plantId || '-'} / ${request.warehouseId || '-'}` },
        { header: '유형', render: (request) => prTypes.find((type) => type.id === request.requestType)?.name || request.requestType || '-' },
        { header: '상태', render: (request) => getCommonStatusLabel(request.status) },
        { header: '결재번호', render: (request) => request.approvalId || '-' },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  // 인쇄(구매요청: 구매요청서 / 구매오더: 발주서)
  const openPrint = async (id: string) => {
    const printTarget = openPrintWindow({
      title: mode === 'management' ? '발주서 출력' : '구매요청서 출력',
      rootId: mode === 'management' ? 'purchase-order-print-root' : 'procurement-request-print-root',
    });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    try {
      const detail = mode === 'management'
        ? await procurementApi.getOrder(id, activePlantId)
        : await procurementApi.getRequest(id, activePlantId);
      const header = detail.header;
      const requester = usersList.find((candidate) => candidate.id === header.requesterId);
      createRoot(container).render(
        <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-[180mm]">
          {mode === 'management' ? (() => {
            const plant = plants.find((candidate) => candidate.id === header.plantId);
            const warehouse = warehouses.find((candidate) => candidate.id === header.warehouseId);
            return (
              <PurchaseOrderPrint
                id={header.id}
                title={header.title}
                orderDate={formatDateOnly(header.orderDate)}
                etaDate={formatDateOnly(header.etaDate)}
                shipStartDate={formatDateOnly(header.shipStartDate)}
                plantName={plant ? `${plant.id} / ${plant.name}` : header.plantId}
                warehouseName={warehouse ? `${warehouse.id} / ${warehouse.name}` : header.warehouseId}
                purchaseManager={usersList.find(
                  (candidate) => candidate.id === header.purchaseManager,
                )?.name || header.purchaseManager || '-'}
                purchaseManagerContact={header.purchaseManagerContact}
                purchaseManagerRemarks={header.purchaseManagerRemarks}
                remarks={header.remarks}
                items={detail.items.map((item) => ({
                  ...item,
                  inventoryName: inventories.find((candidate) => candidate.id === item.inventoryId)?.name,
                }))}
              />
            );
          })() : (
            <ProcurementRequestPrint
              id={header.id}
              requestDate={formatDateOnly(header.requestDate)}
              requesterId={header.requesterId}
              requestType={prTypes.find((type) => type.id === header.requestType)?.name || header.requestType}
              plantId={header.plantId}
              warehouseId={header.warehouseId}
              title={header.title}
              remarks={header.remarks}
              departmentName={resolveDepartmentName(depts, header.departmentId || requester?.departmentId)}
              authorName={requester?.name || header.requesterId}
              approvalId={header.approvalId}
              approvalSteps={await loadApprovalSignatureSteps(header.approvalId, usersList)}
              items={detail.items}
            />
          )}
        </PrintWindowLayout>,
      );
      printWindow.focus();
    } catch (error: unknown) {
      printWindow.close();
      toastApiError(error, '인쇄 실패');
    }
  };

  const filteredWarehouses = useMemo(() => {
    if (!formHeader.plantId) return warehouses;
    return warehouses.filter(w => w.plantId === formHeader.plantId);
  }, [warehouses, formHeader.plantId]);
  const currentUserRef = usersList.find((candidate) => candidate.id === user?.id);
  const approvalContent = useMemo(() => {
    if (!approvalRef) return undefined;
    const requester = usersList.find((candidate) => candidate.id === approvalRef.requesterId)
      || currentUserRef;
    const plant = plants.find((candidate) => candidate.id === approvalRef.plantId);
    const warehouse = warehouses.find((candidate) => candidate.id === approvalRef.warehouseId);
    const requestType = prTypes.find((candidate) => candidate.id === approvalRef.requestType);

    return createProcurementApprovalContent({
      requestNo: approvalRef.id,
      createdAt: approvalRef.createdAt,
      departmentName: resolveDepartmentName(depts, approvalRef.departmentId || requester?.departmentId),
      authorName: `${approvalRef.requesterId || user?.id || '-'} / ${requester?.name || user?.name || '-'}`,
      requestDate: formatDateOnly(approvalRef.requestDate),
      requestTypeName: requestType
        ? `${requestType.id} / ${requestType.name}`
        : approvalRef.requestType || '-',
      plantName: plant ? `${plant.id} / ${plant.name}` : approvalRef.plantId || '-',
      warehouseName: warehouse
        ? `${warehouse.id} / ${warehouse.name}`
        : approvalRef.warehouseId || '-',
      remarks: approvalRef.remarks,
      items: formItems.map((item) => {
        const inventory = inventories.find((candidate) => candidate.id === item.inventoryId);
        return {
          inventoryId: item.inventoryId,
          inventoryName: inventory?.name || '-',
          qty: item.qty,
          unit: item.unit,
          remarks: item.remarks,
        };
      }),
    });
  }, [
    approvalRef,
    currentUserRef,
    depts,
    formItems,
    inventories,
    plants,
    prTypes,
    user,
    usersList,
    warehouses,
  ]);
  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.PUR);
  const canUpdate = canRequestRead;
  const canDelete = canRequestRead;
  const canCreateOrder = hasModuleCreate(user?.moduleAccess, APP_MODULE.POR);
  const canUpdateOrder = hasModuleUpdate(user?.moduleAccess, APP_MODULE.POR);
  const isRequestDraftLike = !formHeader.id || ['T', 'R'].includes(formHeader.status || '');
  const isOwnTempRequest = formHeader.status === 'T' && formHeader.requesterId === user?.id;
  const canEditRequest = !formHeader.id ? canCreate : canUpdate || isOwnTempRequest;
  const canEditOrder = detailMode === 'management'
    && formHeader.status === 'T'
    && formHeader.createdBy === user?.id
    && canUpdateOrder;
  const formEditable = detailMode === 'create-order'
    ? canCreateOrder
    : detailMode === 'management'
      ? canEditOrder
      : isRequestDraftLike && canEditRequest;
  const canSaveOrder = detailMode === 'create-order' ? canCreateOrder : canEditOrder;
  const canSaveRequest = detailMode === 'create-order' ? canCreateOrder : canEditRequest;
  const isConfirmedRequest = ['C', 'S'].includes(formHeader.status || '');
  const canManageFlow = detailMode === 'management' && isConfirmedRequest && canUpdateOrder;
  const canCloseRequest = detailMode === 'management'
    && isConfirmedRequest
    && !formHeader.closedAt
    && canUpdateOrder;
  const detailTitle = !formHeader.id
    ? detailMode === 'create-order' ? '신규 구매오더 입력' : '신규 구매요청 입력'
    : detailMode === 'management'
      ? `구매관리 상세 [${formHeader.id}]`
      : formEditable
        ? `구매요청 상세/수정 [${formHeader.id}]`
        : `구매요청 상세 [${formHeader.id}]`;

  if (!canRead) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
        이 구매 화면을 조회할 권한이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart size={24} className="text-blue-500" />
            {mode === 'management' ? '구매오더' : '구매요청'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'management'
              ? '구매요청에서 생성된 구매오더와 입고·종료 상태를 관리합니다.'
              : '필요한 자재를 요청하고 결재상태와 구매 진행현황을 확인합니다.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Printer size={14} /> 목록 인쇄
          </button>
          {canCreate && mode === 'request' && (
            <button onClick={openNewForm} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0">
              <Plus size={14} /> 입력
            </button>
          )}
          {canCreateOrder && mode === 'management' && (
            <button onClick={openNewOrderForm} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0">
              <Plus size={14} /> 입력
            </button>
          )}
          {mode === 'request' && canCreateOrder && selectedRequestIds.length > 0 && (
            <button onClick={() => void createIntegratedOrder()} className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600">
              선택 {selectedRequestIds.length}건 통합 발주
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-200 mb-4 print:hidden">
          {mode === 'management' ? '구매오더 목록' : '구매요청 목록'}
        </h2>
        <div className="mb-4 flex gap-2 print:hidden">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="owner">담당자</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어를 입력하세요" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
          {(
            <button
              type="button"
              onClick={() => setTempOnly((current) => !current)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${tempOnly ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-800 bg-slate-950 text-slate-400'}`}
            >
              임시저장 {tempOnly ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
              <th className="p-3 font-semibold">{mode === 'request' && canCreateOrder ? '선택' : ''}</th>
              <th className="p-3 font-semibold">문서번호</th>
              <th className="p-3 font-semibold">작성일자</th>
              <th className="p-3 font-semibold">제목</th>
              <th className="p-3 font-semibold">플랜트/창고</th>
              <th className="p-3 font-semibold">유형</th>
              {mode === 'management' && <th className="p-3 font-semibold">예정입고일</th>}
              <th className="p-3 font-semibold">상태</th>
              {mode === 'management' && <th className="p-3 font-semibold">종료여부</th>}
              <th className="p-3 font-semibold text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 && (
              <tr><td colSpan={mode === 'management' ? 10 : 8} className="p-8 text-center text-slate-600">{mode === 'management' ? '구매오더가 없습니다.' : '구매요청이 없습니다.'}</td></tr>
            )}
            {filteredRequests.map(pr => (
              <tr key={pr.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                <td className="p-3">
                  {mode === 'request' && canCreateOrder && ['C', 'S'].includes(pr.status) && (
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(pr.id)}
                      onChange={(event) => setSelectedRequestIds(event.target.checked
                        ? [...selectedRequestIds, pr.id]
                        : selectedRequestIds.filter((id) => id !== pr.id))}
                    />
                  )}
                </td>
                <td className="p-3 font-mono">
                  <button
                    type="button"
                    onClick={() => openPrint(pr.id)}
                    className="bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer"
                    title={`${pr.id} 구매요청서 출력`}
                  >
                    {pr.id}
                  </button>
                </td>
                <td className="p-3 text-slate-300">{pr.requestDate}</td>
                <td className="p-3 text-slate-200">{pr.title || '-'}</td>
                <td className="p-3 text-slate-300">{pr.plantId} / {pr.warehouseId}</td>
                <td className="p-3 text-slate-300">
                  {prTypes.find((type) => type.id === pr.requestType)?.name || pr.requestType || '-'}
                </td>
                {mode === 'management' && (
                  <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                    {formatDateOnly(pr.etaDate) || '-'}
                  </td>
                )}
                <td className="p-3">
                  <ListBadge>
                    {getCommonStatusLabel(pr.status)} ({pr.status})
                  </ListBadge>
                </td>
                {mode === 'management' && (
                  <td className="p-3">
                    <ListBadge>{pr.closedAt ? '종료' : '진행중'}</ListBadge>
                  </td>
                )}
                <td className="p-3 text-right space-x-1">
                  <ListIconButton
                    onClick={() => openDetailForm(pr)}
                    label="상세"
                    icon={FileText}
                    tone="accent"
                  />
                  {mode === 'request' && (
                    <ListIconButton
                      onClick={() => void openOrderLinks(pr.id)}
                      label="이력조회"
                      icon={Link2}
                      tone="neutral"
                    />
                  )}
                  {mode === 'management' && (
                    <ListIconButton
                      onClick={() => void openInventoryDocuments(pr.id)}
                      label="재고전표 이력조회"
                      icon={Link2}
                      tone="neutral"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {orderLinks && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 print:hidden">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">발주 이력 · {orderLinks.requestId}</span>
              <button type="button" onClick={() => setOrderLinks(null)} className="border-0 bg-transparent text-slate-500 hover:text-slate-200 cursor-pointer">닫기</button>
            </div>
            {orderLinks.links.length === 0 ? (
              <span className="text-xs text-slate-500">발주준비</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {orderLinks.links.map((link) => (
                  <ListBadge key={link.orderId}>
                    {link.orderId} · {link.status === 'T' ? '준비중' : '확정'} ({link.status})
                  </ListBadge>
                ))}
              </div>
            )}
          </div>
        )}
        {inventoryDocuments && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 print:hidden">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-300">재고전표 이력</span><button type="button" onClick={() => setInventoryDocuments(null)} className="border-0 bg-transparent text-slate-500 hover:text-slate-200 cursor-pointer">닫기</button></div>
            {inventoryDocuments.length === 0 ? <span className="text-xs text-slate-500">연결된 재고전표가 없습니다.</span> : <div className="space-y-2">{inventoryDocuments.map((document) => <div key={document.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300"><span className="font-mono text-blue-400">{document.id}</span><span>{formatDateOnly(document.txDate) || '-'}</span><span>{document.createdBy}</span>{document.reverseDocumentId && <span className="text-amber-400">반전: {document.reverseDocumentId}</span>}</div>)}</div>}
          </div>
        )}
      </div>

      {/* 신규/수정 요청 모달 */}
      {formOpen && (mode === 'management' ? (
        <PurchaseOrderFormModal
          title={detailTitle}
          onClose={() => setFormOpen(false)}
          formHeader={formHeader}
          formItems={formItems}
          setFormHeader={setFormHeader}
          setFormItems={setFormItems}
          plants={plants}
          filteredWarehouses={filteredWarehouses}
          depts={depts}
          usersList={usersList}
          user={user}
          formEditable={formEditable}
          allocations={allocations}
          setAllocations={setAllocations}
          canUpdateOrder={canUpdateOrder}
          canConfirmOrder={canConfirmOrder}
          canCloseRequest={canCloseRequest}
          canSaveOrder={canSaveOrder}
          confirmPurchaseOrder={() => void confirmPurchaseOrder()}
          createAndConfirmPurchaseOrder={() => void submitForm('S')}
          closeRequest={(id) => void closeRequest(id)}
          saveAllocations={() => void saveAllocations()}
          submitForm={(action) => void submitForm(action)}
        />
      ) : (
        <PurchaseRequestFormModal
          title={detailTitle}
          onClose={() => setFormOpen(false)}
          formHeader={formHeader}
          formItems={formItems}
          setFormHeader={setFormHeader}
          setFormItems={setFormItems}
          plants={plants}
          filteredWarehouses={filteredWarehouses}
          prTypes={prTypes}
          depts={depts}
          usersList={usersList}
          user={user}
          formEditable={formEditable}
          canManageFlow={canManageFlow}
          detailMode={detailMode === 'request' ? 'request' : 'create'}
          canDelete={canDelete}
          isOwnTempRequest={isOwnTempRequest}
          canCloseRequest={canCloseRequest}
          canSaveRequest={canSaveRequest}
          deleteRequest={(id) => void deleteRequest(id)}
          closeRequest={(id) => void closeRequest(id)}
          submitForm={(action) => void submitForm(action)}
        />
      ))}

      <ApprovalDraftModal
        open={!!approvalRef}
        mode="linked"
        refModule={APP_MODULE.PUR}
        refNo={approvalRef?.id || ''}
        defaultTitle={approvalRef ? `[구매요청] ${approvalRef.title || approvalRef.id}` : ''}
        defaultContent={approvalContent}
        users={usersList}
        currentUserId={user?.id}
        approvalId={approvalRef?.approvalId}
        onClose={() => setApprovalRef(null)}
        onSubmitted={() => {
          setApprovalRef(null);
          setFormOpen(false);
          toast.success('구매요청 결재 문서가 상신되었습니다.');
          loadRequests();
        }}
      />

    </div>
  );
}
