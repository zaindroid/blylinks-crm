-- A campaign's monthly goal is now a number of sales rather than a PKR amount, and
-- commission rate is no longer set when creating a campaign. The old columns
-- (monthly_target_pkr, commission_rate) are kept untouched so existing campaigns,
-- payroll history and the per-agent target tables keep working.
ALTER TABLE campaigns ADD COLUMN monthly_sales_goal INTEGER NOT NULL DEFAULT 0;
