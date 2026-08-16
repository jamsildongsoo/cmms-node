import { lazy, Suspense, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PasswordChangeNotice from '../components/PasswordChangeNotice';

const Board = lazy(() => import('./Board'));
const MyPage = lazy(() => import('./MyPage'));
const MdmLayout = lazy(() => import('./MdmLayout'));
const Equipment = lazy(() => import('./Equipment'));
const Inventory = lazy(() => import('./Inventory'));
const PmRecord = lazy(() => import('./PmRecord'));
const WorkOrder = lazy(() => import('./WorkOrder'));
const WorkPermit = lazy(() => import('./WorkPermit'));
const InventoryOverview = lazy(() => import('./InventoryOverview'));
const InventoryProcessing = lazy(() => import('./InventoryProcessing'));
const ProcurementRequest = lazy(() => import('./ProcurementRequest'));
const ProcurementManagement = lazy(() => import('./ProcurementManagement'));
const Approval = lazy(() => import('./Approval'));
const SystemAdmin = lazy(() => import('./SystemAdmin'));
const PowerGeneration = lazy(() => import('./PowerGeneration'));

function PageLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center text-sm text-slate-400">
      화면을 불러오는 중입니다.
    </div>
  );
}

export default function AppShell() {
  const [activeTab, setActiveTab] = useState('board');
  const [receiptRequestId, setReceiptRequestId] = useState<string | null>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  // 비밀번호 변경 안내 모달 — 로그인 시 플래그면 표시, 세션 내 닫으면 재표시 안 함
  const [showPwNotice, setShowPwNotice] = useState(!!user?.mustChangePassword);

  const openReceiptRequest = (requestId: string) => {
    setReceiptRequestId(requestId);
    setReceiptOrderId(null);
    setActiveTab('stock-process');
  };

  const openReceiptOrder = (orderId: string) => {
    setReceiptOrderId(orderId);
    setReceiptRequestId(null);
    setActiveTab('stock-process');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'mypage':
        return <MyPage />;
      case 'mdm':
        return <MdmLayout />;
      case 'equipment':
        return <Equipment />;
      case 'inventory':
        return <Inventory />;
      case 'pm':
        return <PmRecord />;
      case 'wo':
        return <WorkOrder />;
      case 'wp':
        return <WorkPermit />;
      case 'stock':
      case 'stock-overview':
        return <InventoryOverview />;
      case 'stock-process':
        return <InventoryProcessing initialRequestId={receiptRequestId} initialOrderId={receiptOrderId} />;
      case 'procurement-request':
        return <ProcurementRequest onOpenReceiptRequest={openReceiptRequest} />;
      case 'procurement-management':
        return <ProcurementManagement onOpenReceiptRequest={openReceiptRequest} onOpenReceiptOrder={openReceiptOrder} />;
      case 'approval':
        return <Approval />;
      case 'board':
        return <Board />;
      case 'system':
        return <SystemAdmin />;
      case 'power-generation':
        return <PowerGeneration />;
      default:
        return <Board />;
    }
  };

  return (
    <div className="flex flex-col bg-slate-950 h-screen text-slate-100 font-sans overflow-hidden">
      {/* 상단 헤더: 전체 너비 */}
      <Header />

      {/* 헤더 아래: 사이드바 + 콘텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Suspense fallback={<PageLoading />}>
            {renderContent()}
          </Suspense>
        </main>
      </div>

      {showPwNotice && (
        <PasswordChangeNotice
          expired={!!user?.passwordExpired}
          onGoChange={() => { setActiveTab('mypage'); setShowPwNotice(false); }}
          onClose={() => setShowPwNotice(false)}
        />
      )}
    </div>
  );
}
