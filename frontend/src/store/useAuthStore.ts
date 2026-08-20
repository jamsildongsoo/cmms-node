import { create } from 'zustand';
import { toast } from 'sonner';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosInstance from '../api/axios';
import { getApiErrorMessage } from '../utils/apiError';
import type { ModuleAccessMap } from '../utils/moduleAccess';

interface User {
  companyId: string;
  companyName: string;
  id: string;
  name: string;
  avatarKey: string;
  roleId: string;
  scope: 'COMPANY' | 'PLANT';
  departmentId: string | null;
  position: string | null;
  title: string | null;
  homePlantId: string | null;
  moduleAccess: ModuleAccessMap;
  mustChangePassword?: boolean;
  passwordExpired?: boolean;
}

interface SignUpData {
  companyId: string;
  id: string;
  name: string;
  password: string;
  departmentId?: string;
  email?: string;
  phone?: string;
  position?: string;
  title?: string;
}

interface AuthResponse {
  accessToken: string;
  companyId: string;
  companyName: string;
  id: string;
  name: string;
  avatarKey: string;
  roleId: string;
  scope: 'COMPANY' | 'PLANT';
  departmentId: string | null;
  position: string | null;
  title: string | null;
  homePlantId: string | null;
  moduleAccess: ModuleAccessMap;
  mustChangePassword?: boolean;
  passwordExpired?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isInitialized: boolean;
  error: string | null;
  activePlantId: string | null;
  login: (companyId: string, id: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateUser: (data: Partial<User>) => void;
  setActivePlantId: (plantId: string | null) => void;
  setError: (msg: string | null) => void;
  init: () => Promise<void>;
  applyAuth: (data: AuthResponse) => void;
  clearAuth: () => void;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<boolean> | null = null;
let authInterceptorsInstalled = false;
let reloginNoticeShown = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isInitialized: false,
  error: null,
  activePlantId: null,

  login: async (companyId, id, password) => {
    try {
      set({ error: null });
      const response = await axiosInstance.post('/auth/login', { companyId, id, password });
      get().applyAuth(response.data);
      reloginNoticeShown = false;
      return true;
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err, '로그인에 실패했습니다. 입력 정보를 확인하세요.');
      set({ error: errMsg });
      return false;
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post('/auth/logout');
    } catch {
      // 서버 정리 실패와 무관하게 클라이언트 세션은 종료한다.
    } finally {
      get().clearAuth();
    }
  },

  signUp: async (signUpData) => {
    try {
      set({ error: null });
      await axiosInstance.post('/auth/signup', signUpData);
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err, '회원가입에 실패했습니다.');
      set({ error: errMsg });
      throw new Error(errMsg, { cause: err });
    }
  },

  refreshSession: async () => {
    try {
      const response = await axiosInstance.post('/auth/refresh');
      get().applyAuth(response.data);
      return true;
    } catch {
      get().clearAuth();
      return false;
    }
  },

  updateUser: (updatedData) => {
    const { user } = get();
    if (!user) return;
    set({
      user: {
        ...user,
        ...updatedData,
      },
    });
  },

  setActivePlantId: (plantId) => {
    if (plantId) {
      axiosInstance.defaults.headers.common['X-Active-Plant-Id'] = plantId;
    } else {
      delete axiosInstance.defaults.headers.common['X-Active-Plant-Id'];
    }
    set({ activePlantId: plantId });
  },

  setError: (msg) => set({ error: msg }),

  init: async () => {
    await get().refreshSession();
    set({ isInitialized: true });
  },

  applyAuth: (data) => {
    const user: User = {
      companyId: data.companyId,
      companyName: data.companyName || data.companyId,
      id: data.id,
      name: data.name,
      avatarKey: data.avatarKey || 'user-blue',
      roleId: data.roleId,
      scope: data.scope,
      departmentId: data.departmentId,
      position: data.position,
      title: data.title,
      homePlantId: data.homePlantId,
      moduleAccess: data.moduleAccess || {},
      mustChangePassword: data.mustChangePassword,
      passwordExpired: data.passwordExpired,
    };

    axiosInstance.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;

    set({
      user,
      token: data.accessToken,
      error: null,
      activePlantId: data.homePlantId,
    });
    if (data.homePlantId) {
      axiosInstance.defaults.headers.common['X-Active-Plant-Id'] = data.homePlantId;
    } else {
      delete axiosInstance.defaults.headers.common['X-Active-Plant-Id'];
    }
  },

  clearAuth: () => {
    delete axiosInstance.defaults.headers.common.Authorization;
    delete axiosInstance.defaults.headers.common['X-Active-Plant-Id'];
    set({
      user: null,
      token: null,
      error: null,
      activePlantId: null,
    });
  },
}));

export function installAuthInterceptors(): void {
  if (authInterceptorsInstalled) return;
  authInterceptorsInstalled = true;

  axiosInstance.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      const status = err.response?.status;
      const originalConfig = err.config as RetryableConfig | undefined;

      if (
        status !== 401
        || !originalConfig
        || originalConfig._retry
        || originalConfig.url?.includes('/auth/login')
        || originalConfig.url?.includes('/auth/refresh')
        || originalConfig.url?.includes('/auth/logout')
      ) {
        return Promise.reject(err);
      }

      if (!refreshPromise) {
        refreshPromise = useAuthStore.getState().refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;

      if (!refreshed) {
        useAuthStore.getState().setError('세션이 종료되었습니다. 다시 로그인해 주세요.');
        if (!reloginNoticeShown) {
          reloginNoticeShown = true;
          toast.error('세션이 종료되었습니다. 다시 로그인해 주세요.');
        }
        return Promise.reject(err);
      }

      reloginNoticeShown = false;
      originalConfig._retry = true;
      originalConfig.headers = originalConfig.headers ?? {};
      const token = useAuthStore.getState().token;
      if (token) {
        originalConfig.headers.Authorization = `Bearer ${token}`;
      }
      return axiosInstance(originalConfig);
    },
  );
}
