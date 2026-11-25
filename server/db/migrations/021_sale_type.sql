-- Agent picks exactly one of Electric / Gas / Electric and Gas on the order form. This is now the
-- one source of truth for "how many sales does this submission count as" (2 for Electric and Gas,
-- 1 otherwise) across the leaderboard, dashboard and campaign goal progress -- replacing the old
-- guess based on which account-number fields happened to be filled in.
ALTER TABLE sales ADD COLUMN sale_type TEXT;
