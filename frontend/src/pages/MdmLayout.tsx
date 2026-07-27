import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { APP_MODULE } from '../constants/module';
import CodeManager from '../features/mdm/components/CodeManager';
import DeptManager from '../features/mdm/components/DeptManager';
import PlantManager from '../features/mdm/components/PlantManager';
import RoleManager from '../features/mdm/components/RoleManager';
import UserManager from '../features/mdm/components/UserManager';
import WarehouseManager from '../features/mdm/components/WarehouseManager';
import { getMdmCapabilities } from '../features/mdm/mdm.utils';
import { useAuthStore } from '../store/useAuthStore';

type MdmTab = 'plant' | 'dept' | 'role' | 'user' | 'warehouse' | 'code';

const MDM_TABS: ReadonlyArray<{ id: MdmTab; label: string }> = [
  { id: 'plant', label: '플랜트' },
  { id: 'dept', label: '부서' },
  { id: 'user', label: '사용자' },
  { id: 'role', label: '권한 매트릭스' },
  { id: 'warehouse', label: '창고' },
  { id: 'code', label: '공통코드' },
];

export default function MdmLayout() {
  const user = useAuthStore((state) => state.user);
  const capabilities = getMdmCapabilities(user?.permissions?.[APP_MODULE.MDM]);
  const [subTab, setSubTab] = useState<MdmTab>('plant');
  const notify = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
            <Building2 size={24} className="text-blue-500" />
            기준 정보 설정
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            시스템 운영의 뼈대가 되는 조직, 공통코드, 권한 등을 설정합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1.5">
          {MDM_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-xs font-semibold transition-all outline-none ${
                subTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        {subTab === 'plant' && <PlantManager notify={notify} {...capabilities} />}
        {subTab === 'dept' && <DeptManager notify={notify} {...capabilities} />}
        {subTab === 'user' && (
          <UserManager
            notify={notify}
            currentUserId={user?.id}
            {...capabilities}
          />
        )}
        {subTab === 'role' && <RoleManager notify={notify} {...capabilities} />}
        {subTab === 'warehouse' && <WarehouseManager notify={notify} {...capabilities} />}
        {subTab === 'code' && <CodeManager notify={notify} {...capabilities} />}
      </div>
    </div>
  );
}
