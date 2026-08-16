#!/usr/bin/env bash
# WSL 개발 기동 보조 스크립트. 운영 scripts/prod.sh와 같은 30초 메뉴를 제공한다.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.dev.yml"
export NODE_ENV="${NODE_ENV:-development}"

require_env_file() {
  if [ ! -f .env ]; then
    echo "ERROR: 루트 .env 파일이 없습니다. .env.template을 참고해 먼저 준비하세요." >&2
    exit 1
  fi
}

ensure_node_dependencies() {
  [ -d backend/node_modules ] || (
    echo "▶ backend 패키지 설치"
    cd backend && npm install
  )
  [ -d frontend/node_modules ] || (
    echo "▶ frontend 패키지 설치"
    cd frontend && npm install
  )
}

start_services() {
  ensure_node_dependencies

  echo "▶ PostgreSQL·MinIO·nginx 개발 인프라 기동"
  # 로컬에 없는 인프라 이미지만 Docker Compose가 자동으로 다운로드한다.
  docker compose -f "$COMPOSE_FILE" up -d

  echo "▶ 백엔드 NestJS start:dev"
  setsid bash -c 'cd backend && npm run start:dev' & BE_PID=$!
  echo "▶ 프론트 Vite dev (--host)"
  setsid bash -c 'cd frontend && npm run dev -- --host' & FE_PID=$!

  cleanup() {
    trap - INT TERM EXIT
    echo
    echo "▶ 전체 종료 중…"
    kill -- -"$BE_PID" 2>/dev/null || true
    kill -- -"$FE_PID" 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
  }
  trap cleanup INT TERM EXIT

  echo
  echo "  ✅ http://localhost   (nginx:80 → FE:5173 / BE:8080)"
  echo "  (Ctrl-C로 BE·FE·nginx를 일괄 종료합니다.)"
  echo
  wait
}

seed_system() {
  local password=""
  local password_confirm=""
  local bootstrap_pid=""

  cat <<'NOTICE'
개발 DB에 최초 SYSTEM 관리자 계정을 생성합니다.
  회사코드: SYSTEM
  아이디: system

이미 SYSTEM/system 계정이 있으면 계정과 비밀번호를 변경하지 않습니다.
기존 계정의 비밀번호를 바꾸려면 3번(비밀번호 초기화)을 선택하세요.
입력한 비밀번호는 화면에 표시되지 않습니다.
NOTICE

  if ! read -r -s -p "초기 비밀번호: " password; then
    echo
    echo "ERROR: 비밀번호 입력을 취소했습니다." >&2
    exit 1
  fi
  echo
  if ! read -r -s -p "초기 비밀번호 확인: " password_confirm; then
    echo
    echo "ERROR: 비밀번호 확인을 취소했습니다." >&2
    exit 1
  fi
  echo

  if [ -z "$password" ]; then
    echo "ERROR: 비밀번호를 입력하세요." >&2
    exit 1
  fi
  if [ "${#password}" -lt 8 ]; then
    echo "ERROR: 비밀번호는 8자 이상이어야 합니다." >&2
    exit 1
  fi
  if [ "$password" != "$password_confirm" ]; then
    echo "ERROR: 입력한 비밀번호가 일치하지 않습니다." >&2
    exit 1
  fi

  ensure_node_dependencies
  echo "▶ PostgreSQL 기동"
  docker compose -f "$COMPOSE_FILE" up -d db

  # 빈 DB에서는 users 테이블이 아직 없으므로, 백엔드를 먼저 기동해
  # TypeORM synchronize가 스키마를 만든 뒤 SYSTEM 계정을 시드한다.
  echo "▶ DB 스키마 생성용 백엔드 임시 기동"
  setsid bash -c 'cd backend && npm run build && node dist/main' &
  bootstrap_pid=$!

  echo "▶ DB 스키마 준비 대기 (최대 30초)"
  local ready="N"
  local seed_output=""
  for _ in $(seq 1 30); do
    if seed_output=$(cd backend && node scripts/seed-system.js "$password" 2>&1); then
      ready="Y"
      echo "$seed_output"
      break
    fi
    sleep 1
  done

  if [ -n "$bootstrap_pid" ]; then
    kill -- -"$bootstrap_pid" 2>/dev/null || true
    wait "$bootstrap_pid" 2>/dev/null || true
  fi
  if [ "$ready" != "Y" ]; then
    echo "ERROR: 30초 안에 DB 스키마를 준비하거나 SYSTEM 계정을 생성하지 못했습니다." >&2
    echo "       개발 환경에서는 DB_SYNCHRONIZE=true인지 확인하세요." >&2
    exit 1
  fi

}

reset_system_password() {
  local password=""
  local password_confirm=""

  cat <<'NOTICE'
SYSTEM/system 계정의 비밀번호를 초기화합니다.
  회사코드: SYSTEM
  아이디: system

입력한 비밀번호는 화면에 표시되지 않습니다.
NOTICE

  if ! read -r -s -p "새 비밀번호: " password; then
    echo
    echo "ERROR: 비밀번호 입력을 취소했습니다." >&2
    exit 1
  fi
  echo
  if ! read -r -s -p "새 비밀번호 확인: " password_confirm; then
    echo
    echo "ERROR: 비밀번호 확인을 취소했습니다." >&2
    exit 1
  fi
  echo

  if [ -z "$password" ]; then
    echo "ERROR: 비밀번호를 입력하세요." >&2
    exit 1
  fi
  if [ "${#password}" -lt 8 ]; then
    echo "ERROR: 비밀번호는 8자 이상이어야 합니다." >&2
    exit 1
  fi
  if [ "$password" != "$password_confirm" ]; then
    echo "ERROR: 입력한 비밀번호가 일치하지 않습니다." >&2
    exit 1
  fi

  ensure_node_dependencies
  echo "▶ PostgreSQL 기동"
  docker compose -f "$COMPOSE_FILE" up -d db

  echo "▶ PostgreSQL 준비 대기 (최대 30초)"
  local ready="N"
  for _ in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready >/dev/null 2>&1; then
      ready="Y"
      break
    fi
    sleep 1
  done

  if [ "$ready" != "Y" ]; then
    echo "ERROR: 30초 안에 PostgreSQL이 연결 준비되지 않았습니다." >&2
    exit 1
  fi

  if ! (cd backend && node scripts/seed-system.js --reset "$password"); then
    echo "ERROR: SYSTEM/system 계정 초기화에 실패했습니다." >&2
    echo "       users 테이블과 SYSTEM/system 계정이 준비되어 있는지 확인하세요." >&2
    exit 1
  fi
}

select_start_mode() {
  local choice="1"

  if [ -t 0 ]; then
    cat <<'MENU'
개발 실행 방식을 선택하세요.
  1. 현재 환경으로 그냥 기동 (기본값)
  2. 최초 SYSTEM 관리자 계정 생성 후 기동
  3. SYSTEM 관리자 비밀번호 초기화 후 기동

30초 안에 선택하지 않으면 1번으로 실행합니다.
MENU
    if ! read -r -t 30 -p "선택 [1/2/3]: " choice; then
      echo
      choice="1"
    fi
    choice="${choice:-1}"
  fi

  case "$choice" in
    1)
      start_services
      ;;
    2)
      seed_system
      start_services
      ;;
    3)
      reset_system_password
      start_services
      ;;
    *)
      echo "ERROR: 1, 2 또는 3을 선택하세요." >&2
      exit 1
      ;;
  esac
}

require_env_file
select_start_mode
