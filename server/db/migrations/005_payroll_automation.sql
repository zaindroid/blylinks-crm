ALTER TABLE users ADD COLUMN base_salary_pkr NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll ADD CONSTRAINT payroll_agent_month_unique UNIQUE (agent_id, month);
