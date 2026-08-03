import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import ProcurementRequestPrint from '../components/ProcurementRequestPrint';
import PurchaseOrderPrint from '../components/PurchaseOrderPrint';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, Plus, X, Printer, PackagePlus, FileText } from 'lucide-react';
import {
  getCommonStatusLabel,
  getProcStatusLabel,
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
  PurchaseRequest,
  PurchaseRequestItem,
} from '../features/procurement/procurement.types';
import { procurementApi } from '../features/procurement/procurement.api';
import { referenceApi } from '../features/mdm/reference.api';
import { masterReferenceApi } from '../features/master/master-reference.api';
import type { ReferenceUser } from '../features/mdm/mdm.types';
import {
  ProcurementField as Field,
  ProcurementModal as Modal,
} from '../features/procurement/components/ProcurementModal';


function resolveDepartmentName(depts: Department[], departmentId?: string | null) {
  return depts.find((dept) => dept.id === departmentId)?.name || departmentId || '-';
}

export default function Procurement({
  mode = 'request',
  onOpenReceiptRequest,
}: {
  mode?: 'request' | 'management';
  onOpenReceiptRequest?: (requestId: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const requestPermission = user?.permissions?.[APP_MODULE.PUR];
  const orderPermission = user?.permissions?.[APP_MODULE.POR];
  const canRequestRead = requestPermission?.R === 'Y';
  const canManageRead = orderPermission?.R === 'Y';
  const canRead = mode === 'management' ? canManageRead : canRequestRead;

  // ============ 공통 데이터 ============
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [prTypes, setPrTypes] = useState<CodeItem[]>([]);
  const [inventories, setInventories] = useState<InventoryRef[]>([]);
  const [usersList, setUsersList] = useState<ReferenceUser[]>([]);

  const loadRefs = async () => {
    try {
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 구매요청/구매관리 R 권한을 대체하지 않는다.
      const [warehouseItems, plantItems, deptItems, typeItems, inventoryItems, userItems] =
        await Promise.all([
          referenceApi.getWarehouseOptions(),
          referenceApi.getPlantOptions(),
          referenceApi.getDepartmentOptions(),
          referenceApi.getProcurementTypeOptions(),
          masterReferenceApi.getInventories(),
          referenceApi.getUserOptions(),
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
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRefs(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // ============ 구매요청 ============
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
  const filteredRequests = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return requests;
    return requests.filter((request) => {
      if (searchType === 'id') return request.id.toLowerCase().includes(keyword);
      if (searchType === 'title') {
        return (request.title || '').toLowerCase().includes(keyword);
      }
      const requester = usersList.find((candidate) => candidate.id === request.requesterId);
      return `${request.requesterId} ${requester?.name || ''}`.toLowerCase().includes(keyword);
    });
  }, [requests, searchType, searchValue, usersList]);
  const loadRequests = useCallback(async () => {
    if (!canRead) return;
    try {
      const response = mode === 'management'
        ? await procurementApi.getOrders(false, activePlantId)
        : await procurementApi.getRequests(false, activePlantId);
      setRequests(response.map((request) => ({
        ...request,
        requestDate: formatDateOnly(request.requestDate),
        orderDate: formatDateOnly(request.orderDate) || null,
        etaDate: formatDateOnly(request.etaDate) || null,
        shipStartDate: formatDateOnly(request.shipStartDate) || null,
      })));
    } catch (e) { console.error(e); }
  }, [activePlantId, canRead, mode]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  // 신규/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [formHeader, setFormHeader] = useState<Partial<PurchaseRequest>>({ requestDate: todayLocal() });
  const [formItems, setFormItems] = useState<PurchaseRequestItem[]>([{ inventoryId: '', qty: 0, unit: '' }]);
  const [approvalRef, setApprovalRef] = useState<PurchaseRequest | null>(null);
  const [detailMode, setDetailMode] = useState<'create' | 'request' | 'management'>('request');

  const openNewForm = () => {
    setDetailMode('create');
    setFormHeader({
      requestDate: todayLocal(),
      plantId: activePlantId || user?.lastLoginPlantId || '',
      departmentId: user?.departmentId || '',
    });
    setFormItems([{ inventoryId: '', qty: 0, unit: '' }]);
    setFormOpen(true);
  };

  const openDetailForm = async (request: PurchaseRequest) => {
    try {
      const response = mode === 'management'
        ? await procurementApi.getOrder(request.id, activePlantId)
        : await procurementApi.getRequest(request.id, activePlantId);
      setDetailMode(mode === 'management' ? 'management' : 'request');
      setFormHeader({
        ...response.header,
        requestDate: formatDateOnly(response.header.requestDate),
        orderDate: formatDateOnly(response.header.orderDate) || null,
        etaDate: formatDateOnly(response.header.etaDate) || null,
        shipStartDate: formatDateOnly(response.header.shipStartDate) || null,
      });
      setFormItems(response.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
      })));
      setFormOpen(true);
    } catch (error: unknown) {
      toastApiError(error, '구매요청을 불러오지 못했습니다.');
    }
  };

  const submitForm = async (action: 'T' | 'P' | 'S') => {
    if (!formHeader.title?.trim()) { toast.error('제목을 입력하세요.'); return; }
    if (!formHeader.warehouseId) { toast.error('예정 창고를 선택하세요.'); return; }
    if (formItems.length === 0 || !formItems[0].inventoryId) { toast.error('자재 라인을 1개 이상 입력하세요.'); return; }
    if (action === 'S' && !(await requestConfirmation('이 구매요청을 직접확정하시겠습니까?'))) return;
    try {
      const header = { ...formHeader, status: 'T' };
      const saved = formHeader.id
        ? await procurementApi.update(formHeader.id, header, formItems)
        : await procurementApi.create(header, formItems);
      setFormHeader(saved);
      if (action === 'P') {
        setApprovalRef(saved);
        return;
      }
      if (action === 'S') {
        await procurementApi.confirm(saved.id);
        toast.success('구매요청이 직접확정되었습니다.');
      } else {
        toast.success('구매요청이 임시저장되었습니다.');
      }
      setFormOpen(false);
      await loadRequests();
    } catch (error: unknown) {
      toastApiError(error, '구매요청 처리에 실패했습니다.');
    }
  };

  const submitOrder = async () => {
    if (!formHeader.id) return;
    try {
      await procurementApi.placeOrder({
        requestId: formHeader.id,
        orderDate: formHeader.orderDate || todayLocal(),
        etaDate: formHeader.etaDate || null,
      });
      toast.success('발주 정보가 저장되었습니다.');
      await openDetailForm({ ...formHeader, id: formHeader.id } as PurchaseRequest);
      await loadRequests();
    } catch (error: unknown) { toastApiError(error, '발주 정보 저장에 실패했습니다.'); }
  };

  const submitShip = async () => {
    if (!formHeader.id) return;
    try {
      await procurementApi.startShipping(formHeader.id, formHeader.shipStartDate || todayLocal());
      toast.success('배송 상태가 업데이트되었습니다.');
      await openDetailForm({ ...formHeader, id: formHeader.id } as PurchaseRequest);
      await loadRequests();
    } catch (error: unknown) { toastApiError(error, '배송 상태 업데이트에 실패했습니다.'); }
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
      title: mode === 'management' ? '구매재고관리 현황' : '구매요청 현황',
      rows: filteredRequests,
      getRowKey: (request) => request.id,
      columns: [
        { header: '요청번호', render: (request) => request.id, className: 'font-mono' },
        { header: '요청일', render: (request) => request.requestDate || '-' },
        { header: '플랜트/창고', render: (request) => `${request.plantId || '-'} / ${request.warehouseId || '-'}` },
        { header: '유형', render: (request) => prTypes.find((type) => type.id === request.requestType)?.name || request.requestType || '-' },
        { header: '문서상태', render: (request) => getCommonStatusLabel(request.status) },
        {
          header: '구매진행상태',
          render: (request) => request.procStatus
            ? getProcStatusLabel(request.procStatus)
            : '발주대기',
        },
        { header: '결재번호', render: (request) => request.approvalId || '-' },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  // 인쇄(구매요청: 구매요청서 / 구매재고관리: 발주서)
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
  const canCreate = requestPermission?.C === 'Y';
  const canUpdate = requestPermission?.U === 'Y';
  const canDelete = requestPermission?.D === 'Y';
  const canDirectConfirm = requestPermission?.A === 'Y';
  const canManageOrder = orderPermission?.U === 'Y';
  const canReceive = user?.permissions?.STK?.C === 'Y';
  const isRequestDraftLike = !formHeader.id || ['T', 'R'].includes(formHeader.status || '');
  const isOwnTempRequest = formHeader.status === 'T' && formHeader.requesterId === user?.id;
  const canEditRequest = !formHeader.id ? canCreate : canUpdate || isOwnTempRequest;
  const formEditable = detailMode !== 'management' && isRequestDraftLike && canEditRequest;
  const canSaveRequest = canEditRequest;
  const isConfirmedRequest = ['S', 'C'].includes(formHeader.status || '');
  const canManageFlow = detailMode === 'management' && isConfirmedRequest && canManageOrder;
  const canCloseRequest = detailMode === 'management'
    && isConfirmedRequest
    && formHeader.procStatus
    && formHeader.procStatus !== 'E'
    && canManageOrder;
  const detailTitle = !formHeader.id
    ? '신규 구매요청 입력'
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
            {mode === 'management' ? '구매재고관리' : '구매요청'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'management'
              ? '확정된 구매요청의 발주·배송·종료 상태를 관리합니다.'
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
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-200 mb-4 print:hidden">
          {mode === 'management' ? '구매재고관리 목록' : '구매요청 목록'}
        </h2>
        <div className="mb-4 flex gap-2 print:hidden">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="owner">담당자</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어를 입력하세요" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
              <th className="p-3 font-semibold">요청번호</th>
              <th className="p-3 font-semibold">요청일</th>
              <th className="p-3 font-semibold">제목</th>
              <th className="p-3 font-semibold">플랜트/창고</th>
              <th className="p-3 font-semibold">유형</th>
              <th className="p-3 font-semibold">결재상태</th>
              <th className="p-3 font-semibold">구매상태</th>
              <th className="p-3 font-semibold">발주일 / 배송일</th>
              <th className="p-3 font-semibold text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-slate-600">구매요청이 없습니다.</td></tr>
            )}
            {filteredRequests.map(pr => (
              <tr key={pr.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
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
                <td className="p-3">
                  <ListBadge>
                    {getCommonStatusLabel(pr.status)} ({pr.status})
                  </ListBadge>
                </td>
                <td className="p-3">
                  <ListBadge>
                    {pr.procStatus ? `${getProcStatusLabel(pr.procStatus)} (${pr.procStatus})` : '발주대기'}
                  </ListBadge>
                </td>
                <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                  <span className="block">발주 {formatDateOnly(pr.orderDate) || '-'}</span>
                  <span className="block">배송 {formatDateOnly(pr.shipStartDate) || '-'}</span>
                </td>
                <td className="p-3 text-right space-x-1">
                  <ListIconButton
                    onClick={() => openDetailForm(pr)}
                    label="상세"
                    icon={FileText}
                    tone="accent"
                  />
                  {canReceive && ['S', 'C'].includes(pr.status) && pr.procStatus !== 'E' && (
                    <ListIconButton
                      onClick={() => onOpenReceiptRequest?.(pr.id)}
                      label="입고"
                      icon={PackagePlus}
                      tone="accent"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* 신규/수정 요청 모달 */}
      {formOpen && (
        <Modal title={detailTitle} onClose={() => setFormOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-6">
            <div><span className="text-slate-500 block mb-0.5">문서번호</span><span className="font-mono font-semibold text-slate-300">{formHeader.id || '(저장 시 자동발행)'}</span></div>
            <div><span className="text-slate-500 block mb-0.5">작성일</span><span className="font-mono text-slate-300">{formatDateOnly(formHeader.createdAt) || (formHeader.id ? '-' : '저장 시 기록')}</span></div>
            <div><span className="text-slate-500 block mb-0.5">부서</span><span className="text-slate-300">{formHeader.departmentId || '-'} / {resolveDepartmentName(depts, formHeader.departmentId)}</span></div>
            <div><span className="text-slate-500 block mb-0.5">작성자</span><span className="text-slate-300">{formHeader.requesterId || user?.id || '-'} / {usersList.find((candidate) => candidate.id === formHeader.requesterId)?.name || user?.name || '-'}</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <Field label="제목" className="sm:col-span-2 lg:col-span-4"><input value={formHeader.title || ''} onChange={e => setFormHeader({ ...formHeader, title: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></Field>
            <Field label="요청일"><input type="date" value={formHeader.requestDate || ''} onChange={e => setFormHeader({ ...formHeader, requestDate: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></Field>
            <Field label="요청유형"><select value={formHeader.requestType || ''} onChange={e => setFormHeader({ ...formHeader, requestType: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable}>
              <option value="">선택</option>
              {prTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></Field>
            <Field label="플랜트"><select value={formHeader.plantId || ''} onChange={e => setFormHeader({ ...formHeader, plantId: e.target.value, warehouseId: '' })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable || user?.multiPlant !== 'Y'}>
              <option value="">선택</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select></Field>
            <Field label="예정 창고"><select value={formHeader.warehouseId || ''} onChange={e => setFormHeader({ ...formHeader, warehouseId: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable}>
              <option value="">선택</option>
              {filteredWarehouses.map(w => <option key={w.id} value={w.id}>{w.id} — {w.name}{!w.plantId ? ' (공통)' : ''}</option>)}
            </select></Field>
            <Field label="비고" className="sm:col-span-2 lg:col-span-4"><input value={formHeader.remarks || ''} onChange={e => setFormHeader({ ...formHeader, remarks: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></Field>
            {formHeader.id && (
              <>
                <Field label="구매진행상태"><input value={formHeader.procStatus ? `${getProcStatusLabel(formHeader.procStatus)} (${formHeader.procStatus})` : '발주대기'} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400 outline-none" disabled /></Field>
                <Field label="발주일"><input type="date" value={formHeader.orderDate || ''} onChange={e => setFormHeader({ ...formHeader, orderDate: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!canManageFlow} /></Field>
                <Field label="예정도착일"><input type="date" value={formHeader.etaDate || ''} onChange={e => setFormHeader({ ...formHeader, etaDate: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!canManageFlow} /></Field>
                <Field label="배송시작일"><input type="date" value={formHeader.shipStartDate || ''} onChange={e => setFormHeader({ ...formHeader, shipStartDate: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!canManageFlow} /></Field>
              </>
            )}
          </div>
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-slate-400 font-bold">자재 라인</span>
              {formEditable && <button onClick={() => setFormItems([...formItems, { inventoryId: '', qty: 0, unit: '' }])} className="text-blue-400 text-xs font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1">
                <Plus size={12} /> 라인 추가
              </button>}
            </div>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-900 text-slate-400 border-b border-slate-800"><th className="text-left p-3 font-semibold">자재</th><th className="text-right p-3 w-28 font-semibold">수량</th><th className="text-left p-3 w-24 font-semibold">단위</th><th className="w-12"></th></tr></thead>
              <tbody>
                {formItems.map((it, i) => (
                  <tr key={i}>
                    <td className="p-1"><select value={it.inventoryId} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, inventoryId: e.target.value, unit: inventories.find(inv => inv.id === e.target.value)?.unit || x.unit } : x))} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable}>
                      <option value="">선택</option>
                      {inventories.map(inv => <option key={inv.id} value={inv.id}>{inv.id} — {inv.name}</option>)}
                    </select></td>
                    <td className="p-1"><input type="number" value={it.qty || ''} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-right text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></td>
                    <td className="p-1"><input value={it.unit || ''} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></td>
                    <td className="p-1 text-center">{formEditable && <button onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} className="text-rose-400 bg-transparent border-0 cursor-pointer"><X size={12} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-slate-800">
            <button onClick={() => setFormOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">닫기</button>
            {formHeader.id && detailMode === 'request' && formHeader.status === 'T' && (canDelete || isOwnTempRequest) && (
              <button
                onClick={() => void deleteRequest(formHeader.id!)}
                className="bg-rose-900/70 hover:bg-rose-800 text-rose-100 rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer"
              >
                삭제
              </button>
            )}
            {formHeader.id && canManageFlow && (
              <>
                <button onClick={() => void submitOrder()} className="bg-amber-700 hover:bg-amber-600 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">발주 저장</button>
                <button onClick={() => void submitShip()} className="bg-orange-700 hover:bg-orange-600 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">배송 시작</button>
              </>
            )}
            {formHeader.id && canCloseRequest && (
              <button onClick={() => void closeRequest(formHeader.id!)} className="bg-rose-700 hover:bg-rose-600 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">종료</button>
            )}
            {formEditable && canSaveRequest && <button onClick={() => submitForm('T')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer">임시 저장</button>}
            {formEditable && canSaveRequest && <button onClick={() => submitForm('P')} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">결재 상신</button>}
            {formEditable && canSaveRequest && canDirectConfirm && (
              <button onClick={() => submitForm('S')} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 px-5 text-xs font-semibold transition-colors border-0 cursor-pointer">직접 확정</button>
            )}
          </div>
        </Modal>
      )}

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
