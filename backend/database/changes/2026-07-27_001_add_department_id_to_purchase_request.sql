-- 목적
-- purchase_request에 department_id를 추가해 구매요청 작성 시점의 소속 부서를 문서에 고정 저장한다.
-- 기존 데이터는 requester_id 기준 현재 users.department_id로 1회 백필한다.
--
-- 적용 전 확인사항
-- 1. 대상 스키마가 public이 맞는지 확인한다.
-- 2. purchase_request, users 테이블에 company_id / requester_id / id 컬럼이 존재하는지 확인한다.
-- 3. 운영 적용 전 백업 또는 복구 지점을 확보한다.
--
-- 실행 SQL
BEGIN;

ALTER TABLE public.purchase_request
  ADD COLUMN IF NOT EXISTS department_id varchar(50);

UPDATE public.purchase_request pr
SET department_id = u.department_id
FROM public.users u
WHERE pr.company_id = u.company_id
  AND pr.requester_id = u.id
  AND pr.department_id IS NULL;

COMMIT;

-- 검증 SQL
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'purchase_request'
--   AND column_name = 'department_id';
--
-- SELECT id, requester_id, department_id
-- FROM public.purchase_request
-- ORDER BY created_at DESC
-- LIMIT 20;
--
-- 가능한 경우 롤백 SQL
-- BEGIN;
-- ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS department_id;
-- COMMIT;
