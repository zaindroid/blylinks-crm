-- The "/24" in the pay formula was hardcoded, but a real calendar month can have 22, 23, 28, 30 or
-- 31 working days, so Admin needs to set it per pay period rather than always dividing by 24.
-- Stored per row (not just as a generation-time input) so a past payroll's figures stay auditable
-- even if the default changes later.
ALTER TABLE payroll
  ADD COLUMN pay_cycle_days INTEGER NOT NULL DEFAULT 24 CHECK (pay_cycle_days > 0);
