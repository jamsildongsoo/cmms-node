ALTER TABLE pm_record
  ADD COLUMN IF NOT EXISTS file_group_id BIGINT NULL;

ALTER TABLE purchase_request
  ADD COLUMN IF NOT EXISTS file_group_id BIGINT NULL;
