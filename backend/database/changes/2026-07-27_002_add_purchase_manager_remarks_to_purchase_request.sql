-- 목적
-- purchase_request에 purchase_manager_remarks를 추가해 발주 등록 시 구매담당자 메모를 저장한다.
--
-- 적용 전 확인사항
-- 1. 대상 스키마가 public이 맞는지 확인한다.
-- 2. purchase_request 테이블이 존재하는지 확인한다.
-- 3. 운영 적용 전 백업 또는 복구 지점을 확보한다.
--
-- 실행 SQL
BEGIN;

ALTER TABLE public.purchase_request
  ADD COLUMN IF NOT EXISTS purchase_manager_remarks text;

COMMIT;

-- 검증 SQL
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'purchase_request'
--   AND column_name = 'purchase_manager_remarks';
--
-- 가능한 경우 롤백 SQL
-- BEGIN;
-- ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS purchase_manager_remarks;
-- COMMIT;
