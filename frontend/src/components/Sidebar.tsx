import {
  Wrench, Package, ClipboardList, FileSignature,
  Layers, Bell, User, LayoutDashboard, ShieldCheck, ShoppingCart
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const user = useAuthStore((s) => s.user);

  const menuItems: any[] = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { 
      category: '기준 정보 (MDM)', 
      items: [
        { id: 'equipment', label: '설비 마스터', icon: Wrench },
        { id: 'inventory', label: '재고 마스터', icon: Package },
        { id: 'mdm', label: '기준정보 설정', icon: LayoutDashboard }
      ] 
    },
    { 
      category: '업무 트랜잭션', 
      items: [
        { id: 'pm', label: '예방점검 기록', icon: ClipboardList },
        { id: 'wo', label: '작업지시서', icon: ClipboardList },
        { id: 'wp', label: '작업허가서 (Permit)', icon: FileSignature },
        { id: 'procurement', label: '구매 (Procurement)', icon: ShoppingCart },
        { id: 'stock', label: '재고 입출고/이동', icon: Layers }
      ]
    },
    { 
      category: '결재 & 게시판', 
      items: [
        { id: 'approval', label: '결재함', icon: FileSignature },
        { id: 'board', label: '게시판', icon: Bell }
      ] 
    },
    { 
      category: '개인 관리', 
      items: [
        { id: 'mypage', label: '내 정보 수정', icon: User }
      ] 
    }
  ];

  if (user?.roleId?.toUpperCase() === 'SYSTEM') {
    menuItems.push({
      category: '시스템',
      items: [{ id: 'system', label: '시스템 관리', icon: ShieldCheck }]
    });
  }

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 print:hidden">
      <nav className="flex-1 overflow-y-auto p-3 space-y-5 pt-4">
        {menuItems.map((item, idx) => {
          if ('category' in item) {
            return (
              <div key={idx} className="space-y-0.5">
                <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                  {item.category}
                </span>
                {item.items?.map((subItem: any) => {
                  const Icon = subItem.icon;
                  const isActive = activeTab === subItem.id;
                  return (
                    <button
                      key={subItem.id}
                      onClick={() => setActiveTab(subItem.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer outline-none border-0 ${
                        isActive 
                          ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500 pl-2.5' 
                          : 'hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon size={15} />
                      {subItem.label}
                    </button>
                  );
                })}
              </div>
            );
          } else {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer outline-none border-0 ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500 pl-2.5' 
                    : 'hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          }
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 text-center text-[9px] text-slate-600">
        © 2026 한국플랜트서비스. All rights reserved.
      </div>
    </aside>
  );
}
