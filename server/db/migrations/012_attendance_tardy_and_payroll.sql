-- 1. A persistent "was tardy" flag on each attendance log. `status` cannot carry this: clocking out
--    overwrites it with 'Clocked Out', which would erase the Tardy mark and make any weekly tardy
--    count read zero.
ALTER TABLE attendance_logs ADD COLUMN tardy BOOLEAN NOT NULL DEFAULT false;
UPDATE attendance_logs SET tardy = true WHERE status IN ('Tardy', 'Late');

-- 2. Payroll: base salary / 24 = per-day rate, times days worked; a half day is deducted for each
--    week with 3+ tardies; outstanding salary advances are deducted automatically. Commission is
--    entered by the Admin rather than derived from sale amounts.
ALTER TABLE payroll
  ADD COLUMN working_days          INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN per_day_pkr           NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN tardy_weeks           INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN tardy_deduction_pkr   NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN advance_deduction_pkr NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 3. Salary advances an Admin records against an agent.
CREATE TABLE salary_advances (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES users(id),
  amount     NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  given_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salary_advances_agent ON salary_advances(agent_id);

-- How much of an advance has actually been recovered, and from which payroll. A row exists only
-- while that payroll is marked Paid, so reverting a payment restores the outstanding balance.
CREATE TABLE salary_advance_recoveries (
  advance_id TEXT NOT NULL REFERENCES salary_advances(id),
  payroll_id TEXT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  amount     NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (advance_id, payroll_id)
);
