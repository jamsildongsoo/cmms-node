ALTER TABLE purchase_request
  ADD COLUMN IF NOT EXISTS purchase_manager varchar(100),
  ADD COLUMN IF NOT EXISTS purchase_manager_contact varchar(100);
