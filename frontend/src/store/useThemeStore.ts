import { create } from 'zustand';

/** light/dark 테마 단일 소스. html.light 클래스 토글 + localStorage 영속. */
function applyTheme(light: boolean) {
  document.documentElement.classList.toggle('light', light);
  localStorage.setItem('theme', light ? 'light' : 'dark');
}

interface ThemeState {
  isLight: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isLight: localStorage.getItem('theme') === 'light',
  toggle: () => {
    const next = !get().isLight;
    applyTheme(next);
    set({ isLight: next });
  },
}));

// 모듈 로드 시 저장된 테마를 즉시 DOM에 반영(로그인 화면 포함 어디서든 일관).
applyTheme(useThemeStore.getState().isLight);
