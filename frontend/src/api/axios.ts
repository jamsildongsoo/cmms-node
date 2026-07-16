import axios from 'axios';

// 기본은 상대경로 '/api'(nginx/Vite 프록시). 필요 시 VITE_API_BASE_URL로 오버라이드.
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default instance;
