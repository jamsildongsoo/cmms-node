-- 목적: 월마감 상태 헤더와 상세 기초재고를 추가한다.
-- 적용 전: inventory_monthly_closing 테이블과 백업을 확인한다.

BEGIN;

ALTER TABLE inventory_monthly_closing
  ADD COLUMN IF NOT EXISTS opening_qty numeric(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_amount numeric(19, 4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS inventory_closing (
  company_id varchar(50) NOT NULL,
  closing_ym char(6) NOT NULL,
  status varchar(10) NOT NULL,
  closed_at timestamptz NOT NULL,
  closed_by varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(50) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(50) NOT NULL,
  delete_yn varchar(1) NOT NULL DEFAULT 'N',
  CONSTRAINT pk_inventory_closing PRIMARY KEY (company_id, closing_ym),
  CONSTRAINT ck_inventory_closing_status CHECK (status IN ('CLOSED')),
  CONSTRAINT ck_inventory_closing_ym CHECK (closing_ym ~ '^[0-9]{6}$')
);

COMMIT;

-- 검증
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'inventory_monthly_closing'
--    AND column_name IN ('opening_qty', 'opening_amount');
-- SELECT to_regclass('inventory_closing');

-- 롤백(마감 데이터가 필요 없는 경우에만 별도 검토 후 실행)
-- DROP TABLE inventory_closing;
-- ALTER TABLE inventory_monthly_closing DROP COLUMN opening_amount, DROP COLUMN opening_qty;
