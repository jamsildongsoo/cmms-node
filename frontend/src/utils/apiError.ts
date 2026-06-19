import axios from 'axios';

const EXPOSED_STATUS = new Set([400, 403, 404, 409]);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  if (!error.response) {
    return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }

  const status = error.response.status;
  const message = error.response.data?.message;
  if (EXPOSED_STATUS.has(status) && typeof message === 'string' && message.trim()) {
    return message;
  }

  return fallback;
}
