-- Do-Not-Call lists, one per campaign. `phone_key` is the normalised form used for matching (the last 10
-- digits, so formatting and country-code prefixes don't matter); `phone_display` is what was entered.
CREATE TABLE dnc_numbers (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phone_key     TEXT NOT NULL,
  phone_display TEXT NOT NULL,
  note          TEXT,
  added_by      TEXT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, phone_key)
);
CREATE INDEX idx_dnc_campaign ON dnc_numbers(campaign_id);
