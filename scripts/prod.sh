#!/usr/bin/env bash
# Lightsail 운영 기동 보조 스크립트.
# - 대화형 기동: ./scripts/prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
CMD="${1:-menu}"

require_env_file() {
  if [ ! -f .env ]; then
    echo "ERROR: 루트 .env 파일이 없습니다. 운영 .env를 먼저 준비하세요." >&2
    exit 1
  fi
}

pull_application_images() {
  echo "▶ API/Web 최신 이미지 pull"
  docker compose -f "$COMPOSE_FILE" pull api web
}

start_services() {
  echo "▶ 로컬 이미지로 운영 서비스 기동"
  if ! docker compose -f "$COMPOSE_FILE" up -d --pull never db api web; then
    echo "ERROR: 필요한 로컬 이미지가 없습니다." >&2
    echo "PostgreSQL 등 인프라 이미지는 인프라 담당자가 수동으로 준비해야 합니다." >&2
    exit 1
  fi
}

select_start_mode() {
  local choice="1"

  if [ -t 0 ]; then
    cat <<'MENU'
운영 기동 방식을 선택하세요.
  1. 현재 저장된 이미지로 기동 (기본값)
  2. 새 API/Web 이미지를 다운로드한 후 기동
  3. 최초 SYSTEM 관리자 계정 생성 후 기동

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
      pull_application_images
      start_services
      ;;
    3)
      seed_system
      start_services
      ;;
    *)
      echo "ERROR: 1, 2 또는 3을 선택하세요." >&2
      exit 1
      ;;
  esac
}

seed_system() {
  local password=""
  local password_confirm=""

  cat <<'NOTICE'
최초 SYSTEM 관리자 계정을 생성합니다.
  회사코드: SYSTEM
  아이디: system

⚠️  운영 DB는 자동으로 테이블을 생성하지 않습니다(DB_SYNCHRONIZE=false).
    반드시 운영 DDL을 먼저 적용하여 DB 스키마를 준비한 후 진행하세요.
    DDL이 적용되지 않은 빈 DB에서는 SYSTEM 계정을 생성할 수 없습니다.

운영 DB 스키마가 준비된 후 최초 한 번만 실행하세요.
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

  docker compose -f "$COMPOSE_FILE" run --rm api \
    node scripts/seed-system.js "$password"

  echo "✅ SYSTEM 관리자 계정 생성 완료 — 운영 서비스를 이어서 기동합니다."
  echo "   회사코드: SYSTEM"
  echo "   아이디: system"
}

case "$CMD" in
  menu)
    require_env_file
    select_start_mode
    ;;
  *)
    cat >&2 <<'USAGE'
사용법:
  ./scripts/prod.sh
      30초 대화형 메뉴에서 기동, API/Web 업데이트 또는 SYSTEM 계정 생성

PostgreSQL 등 인프라 이미지는 이 스크립트가 다운로드하지 않습니다.
DB 백업은 인프라 담당자가 별도로 수행합니다.
USAGE
    exit 1
    ;;
esac
