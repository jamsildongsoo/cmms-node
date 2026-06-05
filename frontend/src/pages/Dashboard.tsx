import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PasswordChangeNotice from '../components/PasswordChangeNotice';
import MyPage from './MyPage';
import MdmLayout from './MdmLayout';
import Equipment from './Equipment';
import Inventory from './Inventory';
import PreventiveMaintenance from './PreventiveMaintenance';
import WorkOrder from './WorkOrder';
import WorkPermit from './WorkPermit';
import InventoryTransaction from './InventoryTransaction';
import Procurement from './Procurement';
import Approval from './Approval';
import Board from './Board';
import SystemAdmin from './SystemAdmin';
import { LayoutDashboard, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const user = useAuthStore((s) => s.user);
  // 비밀번호 변경 안내 모달 — 로그인 시 플래그면 표시, 세션 내 닫으면 재표시 안 함
  const [showPwNotice, setShowPwNotice] = useState(!!user?.mustChangePassword);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <LayoutDashboard size={20} className="text-blue-500" />
                설비관리시스템 대시보드
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                한국플랜트서비스 설비관리시스템(CMMS) 포털에 오신 것을 환영합니다.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">설비 가동 현황</span>
                <span className="text-3xl font-extrabold text-emerald-400">98.4%</span>
                <p className="text-[10px] text-slate-500 mt-2">정상 운영 중인 설비 비율</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">대기 중인 결재</span>
                <span className="text-3xl font-extrabold text-yellow-400">3건</span>
                <p className="text-[10px] text-slate-500 mt-2">승인 대기 중인 트랜잭션 문서</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">금주 예방점검 대상</span>
                <span className="text-3xl font-extrabold text-blue-400">12건</span>
                <p className="text-[10px] text-slate-500 mt-2">주간 다음 점검일 도래 대상 건수</p>
              </div>
            </div>
          </div>
        );
      case 'mypage':
        return <MyPage />;
      case 'mdm':
        return <MdmLayout />;
      case 'equipment':
        return <Equipment />;
      case 'inventory':
        return <Inventory />;
      case 'pm':
        return <PreventiveMaintenance />;
      case 'wo':
        return <WorkOrder />;
      case 'wp':
        return <WorkPermit />;
      case 'stock':
        return <InventoryTransaction />;
      case 'procurement':
        return <Procurement />;
      case 'approval':
        return <Approval />;
      case 'board':
        return <Board />;
      case 'system':
        return <SystemAdmin />;
      default:
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center max-w-2xl mx-auto mt-12">
            <AlertTriangle size={48} className="text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-200">구현 예정 페이지</h2>
            <p className="text-slate-500 text-sm mt-2">
              선택하신 <span className="text-blue-400 font-semibold uppercase font-mono">[{activeTab}]</span> 메뉴는 현재 개발 마일스톤 계획에 따라 순차적으로 구현될 예정입니다.
            </p>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer border-0"
            >
              대시보드로 돌아가기
            </button>
          </div>
        );
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
