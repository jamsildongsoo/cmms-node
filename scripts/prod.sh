#!/usr/bin/env bash
# 운영 배포 보조 스크립트.
# - 일반 배포: ./scripts/prod.sh deploy
# - 최초 SYSTEM seed: ./scripts/prod.sh seed '강한-임시-비밀번호'
# - 최초 구축 보조: ./scripts/prod.sh bootstrap '강한-임시-비밀번호'
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
CMD="${1:-deploy}"

require_env_file() {
  if [ ! -f .env ]; then
    echo "ERROR: 루트 .env 파일이 없습니다. 운영 .env를 먼저 준비하세요." >&2
    exit 1
  fi
}

pull_images() {
  echo "▶ 운영 이미지 pull"
  docker compose -f "$COMPOSE_FILE" pull
}

start_services() {
  echo "▶ 운영 서비스 기동"
  docker compose -f "$COMPOSE_FILE" up -d
}

seed_system() {
  local password="${1:-}"
  if [ -z "$password" ]; then
    echo "ERROR: SYSTEM seed 비밀번호를 인자로 지정하세요." >&2
    echo "예: ./scripts/prod.sh seed '강한-임시-비밀번호'" >&2
    exit 1
  fi

  echo "▶ SYSTEM seed one-off 실행"
  docker compose -f "$COMPOSE_FILE" run --rm api \
    node scripts/seed-system.js "$password"
}

case "$CMD" in
  deploy)
    require_env_file
    pull_images
    start_services
    ;;
  seed)
    require_env_file
    shift
    seed_system "${1:-}"
    ;;
  bootstrap)
    require_env_file
    shift
    pull_images
    echo "▶ 운영 DB 스키마 적용은 별도 절차로 먼저 완료되어 있어야 합니다."
    seed_system "${1:-}"
    start_services
    ;;
  *)
    cat >&2 <<'USAGE'
사용법:
  ./scripts/prod.sh deploy
      일반 운영 배포: 이미지 pull 후 서비스 기동

  ./scripts/prod.sh seed '강한-임시-비밀번호'
      최초 운영 DB 구축 시 SYSTEM 계정 1회 seed

  ./scripts/prod.sh bootstrap '강한-임시-비밀번호'
      최초 구축 보조: pull, seed, up -d
      단, 운영 DB 스키마 적용은 별도 절차로 먼저 완료해야 함
USAGE
    exit 1
    ;;
esac
