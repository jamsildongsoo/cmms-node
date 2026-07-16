import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAuthStore } from './store/useAuthStore'

// 새로고침/탭 복원 시 sessionStorage에서 복원된 토큰으로 axios 헤더·세션 타이머 재설정
useAuthStore.getState().init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
