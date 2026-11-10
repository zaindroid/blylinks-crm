-- A payroll row's actual pay period, as real dates -- so far it only ever existed implicitly, as
-- "the whole calendar month named in the `month` column". Needed to support generating payroll for
-- an arbitrary date range (e.g. a new hire who joined mid-month), not just a whole month.
-- `month` stays as the row's display/identity label: a real 'YYYY-MM' for a whole-month generation,
-- or a 'YYYY-MM-DD_to_YYYY-MM-DD' label for a custom range -- either way, still unique per agent
-- (payroll_agent_month_unique, from 005, is untouched) and still what every existing UI/route uses
-- to identify "this payroll record".
ALTER TABLE payroll
  ADD COLUMN period_start DATE,
  ADD COLUMN period_end   DATE;

-- Backfill: every existing row's period is exactly the whole month its `month` label already names.
UPDATE payroll SET
  period_start = (month || '-01')::date,
  period_end   = ((month || '-01')::date + interval '1 month' - interval '1 day')::date
WHERE period_start IS NULL;

ALTER TABLE payroll
  ALTER COLUMN period_start SET NOT NULL,
  ALTER COLUMN period_end   SET NOT NULL,
  ADD CONSTRAINT payroll_period_valid CHECK (period_end >= period_start);
