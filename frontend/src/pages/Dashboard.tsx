import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PasswordChangeNotice from '../components/PasswordChangeNotice';
import MyPage from './MyPage';
import MdmLayout from './MdmLayout';
import Equipment from './Equipment';
import Inventory from './Inventory';
import PmRecord from './PmRecord';
import WorkOrder from './WorkOrder';
import WorkPermit from './WorkPermit';
import InventoryTransaction from './InventoryTransaction';
import Procurement from './Procurement';
import PurchaseReceipt from './PurchaseReceipt';
import Approval from './Approval';
import Board from './Board';
import SystemAdmin from './SystemAdmin';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('board');
  const user = useAuthStore((s) => s.user);
  // 비밀번호 변경 안내 모달 — 로그인 시 플래그면 표시, 세션 내 닫으면 재표시 안 함
  const [showPwNotice, setShowPwNotice] = useState(!!user?.mustChangePassword);

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
        return <InventoryTransaction />;
      case 'procurement-request':
        return <Procurement mode="request" />;
      case 'procurement-management':
        return <Procurement mode="management" />;
      case 'purchase-receipt':
        return <PurchaseReceipt />;
      case 'approval':
        return <Approval />;
      case 'board':
        return <Board />;
      case 'system':
        return <SystemAdmin />;
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
          {renderContent()}
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
