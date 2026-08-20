-- 구매·재고 책임 분리
ALTER TABLE purchase_order_item
  DROP COLUMN IF EXISTS received_qty;

ALTER TABLE purchase_request_item
  DROP COLUMN IF EXISTS received_qty;

ALTER TABLE inventory_document_item
  ADD COLUMN IF NOT EXISTS ref_line_no varchar(20);

ALTER TABLE inventory_document
  ADD COLUMN IF NOT EXISTS reverse_document_id varchar(50);
