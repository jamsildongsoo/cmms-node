-- 목적: 구매요청에 구매 담당자와 연락처 컬럼 추가
-- 대상: 운영 DB 수동 적용
-- 적용 전: 대상 스키마와 테이블을 확인하고 복구 지점을 확보한다.
-- 롤백:
--   ALTER TABLE purchase_request
--     DROP COLUMN IF EXISTS purchase_manager,
--     DROP COLUMN IF EXISTS purchase_manager_contact;

ALTER TABLE purchase_request
  ADD COLUMN IF NOT EXISTS purchase_manager varchar(100),
  ADD COLUMN IF NOT EXISTS purchase_manager_contact varchar(100);
