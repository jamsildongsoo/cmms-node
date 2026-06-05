import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axiosInstance from '../api/axios';

interface User {
  companyId: string;
  companyName: string;          // PrintHeader 표시용
  id: string;
  name: string;
  roleId: string;
  departmentId: string | null;
  position: string | null;
  title: string | null;
  lastLoginPlantId: string | null;  // 지정 플랜트(관리자 지정 또는 로그인 자동매핑)
  multiPlant: 'Y' | 'N';            // 역할에서 resolve, 셀렉터 표시 여부
  mustChangePassword?: boolean;
  passwordExpired?: boolean;
}

const SESSION_MS = 1800 * 1000; // 30분 (서버 JWT 만료와 동일)

interface AuthState {
  user: User | null;
  token: string | null;
  expiresAt: number | null; // 절대 만료시각(ms). 새로고침 후 남은시간 재계산 기준
  timeRemaining: number;
  timerId: any | null;
  error: string | null;
  activePlantId: string | null;  // 멀티 사용자가 선택한 활성 플랜트(null=전체)
  login: (companyId: string, id: string, password: string) => Promise<boolean>;
  logout: () => void;
  signUp: (data: any) => Promise<void>;
  extendSession: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  setActivePlantId: (plantId: string | null) => void;
  decrementTimer: () => void;
  setError: (msg: string | null) => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      expiresAt: null,
      timeRemaining: 0,
      timerId: null,
      error: null,
      activePlantId: null,

      login: async (companyId, id, password) => {
        try {
          set({ error: null });
          const response = await axiosInstance.post('/auth/login', { companyId, id, password });
          const data = response.data;

          const user: User = {
            companyId: data.companyId,
            companyName: data.companyName || data.companyId,
            id: data.id,
            name: data.name,
            roleId: data.roleId,
            departmentId: data.departmentId,
            position: data.position,
            title: data.title,
            lastLoginPlantId: data.lastLoginPlantId,
            multiPlant: data.multiPlant === 'Y' ? 'Y' : 'N',
            mustChangePassword: data.mustChangePassword,
            passwordExpired: data.passwordExpired,
          };

          const token = data.accessToken;

          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          if (get().timerId) {
            clearInterval(get().timerId);
          }

          const timerId = setInterval(() => {
            get().decrementTimer();
          }, 1000);

          set({
            user,
            token,
            expiresAt: Date.now() + SESSION_MS,
            timeRemaining: 1800,
            timerId,
            activePlantId: data.lastLoginPlantId, // 로그인 시 lastLoginPlantId로 초기화
          });

          return true;
        } catch (err: any) {
          const errMsg = err.response?.data?.message || '로그인에 실패했습니다. 입력 정보를 확인하세요.';
          set({ error: errMsg });
          return false;
        }
      },

      logout: () => {
        if (get().timerId) {
          clearInterval(get().timerId);
        }
        delete axiosInstance.defaults.headers.common['Authorization'];
        set({
          user: null,
          token: null,
          expiresAt: null,
          timeRemaining: 0,
          timerId: null,
          error: null,
          activePlantId: null,
        });
      },

      signUp: async (signUpData) => {
        try {
          set({ error: null });
          await axiosInstance.post('/auth/signup', signUpData);
        } catch (err: any) {
          const errMsg = err.response?.data?.message || '회원가입에 실패했습니다.';
          set({ error: errMsg });
          throw new Error(errMsg);
        }
      },

      extendSession: async () => {
        const { token } = get();
        if (!token) return;

        try {
          set({ error: null });
          const response = await axiosInstance.post('/auth/refresh', {}, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const newToken = response.data;

          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

          set({
            token: newToken,
            expiresAt: Date.now() + SESSION_MS,
            timeRemaining: 1800,
          });
        } catch (err: any) {
          console.error('Session extension failed', err);
          get().logout();
        }
      },

      updateUser: (updatedData) => {
        const { user } = get();
        if (!user) return;
        set({
          user: {
            ...user,
            ...updatedData
          }
        });
      },

      setActivePlantId: (plantId) => {
        // 멀티 사용자만 활성 플랜트 변경 가능
        const { user } = get();
        if (!user || user.multiPlant !== 'Y') return;
        set({ activePlantId: plantId });
      },

      decrementTimer: () => {
        const { expiresAt } = get();
        const remaining = expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : 0;
        if (remaining <= 0) {
          get().logout();
          alert('세션이 만료되어 로그아웃되었습니다.');
        } else {
          set({ timeRemaining: remaining });
        }
      },

      setError: (msg) => set({ error: msg }),

      // 새로고침/탭 복원 시 1회 호출: 유효 토큰이면 axios 헤더 재적용 + 타이머 재시작, 만료/없음이면 정리
      init: () => {
        const { token, expiresAt } = get();
        if (!token || !expiresAt || expiresAt <= Date.now()) {
          if (token) get().logout(); // 만료된 잔존 토큰 정리
          return;
        }
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        if (get().timerId) clearInterval(get().timerId);
        const timerId = setInterval(() => get().decrementTimer(), 1000);
        set({ timeRemaining: Math.floor((expiresAt - Date.now()) / 1000), timerId });
      },
    }),
    {
      name: 'cmms-auth',
      storage: createJSONStorage(() => sessionStorage),
      // 토큰/사용자/만료시각만 저장(초당 변하는 timeRemaining·timerId·error 제외)
      partialize: (state) => ({ token: state.token, user: state.user, expiresAt: state.expiresAt }),
    }
  )
);

// 서버가 토큰을 거부(401)하면 자동 로그아웃. 로그인 등 미인증 요청의 401은 제외.
axiosInstance.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);
