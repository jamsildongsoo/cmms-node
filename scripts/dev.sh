#!/usr/bin/env bash
# 개발 전체 기동(BE+FE+nginx)을 한 번에. 위치/구조는 운영(scripts/prod.sh)과 대칭.
#   - 백엔드(NestJS/Node.js, host, profile=dev/development)  +  프론트(Vite, host, HMR)  +  nginx 프록시(컨테이너)
#   - Ctrl-C 한 번으로 셋 다 종료.  접속: http://localhost:8082
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) .env 로드 (npm/vite은 .env 자동 로드 안 함; DB_URL의 '&' 안전 위해 source 대신 line-read)
if [ -f .env ]; then
  set -a
  while IFS='=' read -r key val; do
    case "$key" in ''|\#*) continue ;; esac
    export "$key=$val"
  done < .env
  set +a
fi
export NODE_ENV="${NODE_ENV:-development}"

# 2) 백엔드 의존성 보장
[ -d backend/node_modules ] || ( echo "▶ npm install (backend)"; cd backend && npm install )

# 3) 프론트 의존성 보장
[ -d frontend/node_modules ] || ( echo "▶ npm install (frontend)"; cd frontend && npm install )

# 4) nginx 프록시(컨테이너) 기동
echo "▶ nginx 프록시 (docker compose dev)"
docker compose -f docker-compose.dev.yml up -d

# 5) BE/FE를 각자 프로세스그룹으로 백그라운드 기동 (그룹 단위로 깔끔히 종료하기 위함)
echo "▶ 백엔드 NestJS start:dev"
setsid bash -c 'cd backend && npm run start:dev' & BE_PID=$!
echo "▶ 프론트 Vite dev (--host)"
setsid bash -c 'cd frontend && npm run dev -- --host' & FE_PID=$!

cleanup() {
  trap - INT TERM EXIT
  echo; echo "▶ 전체 종료 중…"
  kill -- -"$BE_PID" 2>/dev/null || true   # 프로세스그룹 종료(BE + node)
  kill -- -"$FE_PID" 2>/dev/null || true   # 프로세스그룹 종료(FE + vite)
  docker compose -f docker-compose.dev.yml down 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo
echo "  ✅ http://localhost:8082   (nginx:8082 → FE:5173 / BE:8080)"
echo "  (Ctrl-C 로 BE·FE·nginx 일괄 종료)"
echo
wait
