-- An Admin or Supervisor can set an individual monthly *number of sales* target per agent.
-- Stored beside the existing PKR target columns, which are left untouched.
ALTER TABLE targets ADD COLUMN monthly_sales_target INTEGER NOT NULL DEFAULT 0;
