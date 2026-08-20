import {
  Wrench, Package, ClipboardList, FileSignature,
  Layers, Bell, User, LayoutDashboard, ShoppingCart, Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarSection {
  category?: string;
  items: SidebarItem[];
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems: SidebarSection[] = [
    {
      category: '설비관리',
      items: [
        { id: 'equipment', label: '설비 마스터', icon: Wrench },
        { id: 'pm', label: '예방점검', icon: ClipboardList },
        { id: 'wo', label: '작업지시서', icon: ClipboardList },
        { id: 'wp', label: '작업허가서', icon: FileSignature },
      ]
    },
    {
      category: '자재관리',
      items: [
        { id: 'inventory', label: '자재 마스터', icon: Package },
        { id: 'procurement-request', label: '구매요청', icon: ShoppingCart },
        { id: 'procurement-management', label: '구매오더', icon: ShoppingCart },
        { id: 'stock-overview', label: '재고조회', icon: Layers },
        { id: 'stock-process', label: '자재 수불처리', icon: Layers }
      ]
    },
    {
      category: '기준정보',
      items: [
        { id: 'mdm', label: '기준정보 설정', icon: LayoutDashboard }
      ]
    },
    {
      category: '에너지관리',
      items: [
        { id: 'power-generation', label: '발전량 조회', icon: Zap },
      ]
    },
    {
      category: '공통',
      items: [
        { id: 'approval', label: '결재함', icon: FileSignature },
        { id: 'board', label: '게시판', icon: Bell },
        { id: 'mypage', label: '내 정보 수정', icon: User },
      ]
    }
  ];

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 print:hidden">
      <nav className="flex-1 overflow-y-auto p-3 space-y-5 pt-4">
        {menuItems.map((item) => (
              <div key={item.category ?? item.items[0].id} className="space-y-0.5">
                {item.category && (
                  <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    {item.category}
                  </span>
                )}
                {item.items.map((subItem) => {
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
        ))}
      </nav>
    </aside>
  );
}
