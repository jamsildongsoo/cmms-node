CREATE TABLE IF NOT EXISTS power_generation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar(50) NOT NULL,
  generator_id varchar(20) NOT NULL,
  generator_name varchar(100),
  trading_day date NOT NULL,
  hour_no smallint NOT NULL CHECK (hour_no BETWEEN 1 AND 24),
  interval_end_at timestamptz,
  measurement_type varchar(20) NOT NULL DEFAULT '10',
  raw_value_wh numeric(20,3) NOT NULL,
  generation_mwh numeric(16,6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(50) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(50) NOT NULL,
  CONSTRAINT uq_power_generation_company_generator_day_hour_type
    UNIQUE (company_id, generator_id, trading_day, hour_no, measurement_type)
);

CREATE INDEX IF NOT EXISTS ix_power_generation_company_day
  ON power_generation (company_id, trading_day);
