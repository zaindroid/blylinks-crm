-- DNC lists become a properly de-duplicated "master list" per campaign: every upload merges into it, every
-- column of the uploaded sheet is kept, and the same number can only ever be one row.

-- 1. Keep the rest of the sheet. `fields` holds the other columns as they were (header -> value); a number
--    that arrived with a name, a city or a reference number keeps them, so the list is readable on its own
--    rather than being a wall of bare numbers.
ALTER TABLE dnc_numbers
  ADD COLUMN fields      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN search_text TEXT  NOT NULL DEFAULT '';

-- 2. 'One row per number, per campaign' is the entire point of a Do-Not-Call list: a number listed twice is
--    a duplicate nobody notices, and a number that lost its row is a compliance breach. It is already
--    enforced by the UNIQUE (campaign_id, phone_key) constraint from 013, and every write path normalises
--    through phoneKey() in server/utils/phone.js -- which reduces any format to the last 10 digits.
--
--    What was missing is anything stopping a row being stored with an *un-normalised* key. A 15-digit E.164
--    string written straight into phone_key would sit next to the same number's 10-digit key as a second,
--    separate row: two rows, one number, and the UNIQUE constraint would not see a conflict. This makes that
--    impossible at the storage layer, so no future code path can reintroduce duplicates by forgetting to
--    normalise. Rows that predate this are unreachable anyway -- phoneKey() can never return a key of this
--    shape, so a check could never match them -- and are cleared out rather than allowed to block the
--    constraint.
DELETE FROM dnc_numbers WHERE phone_key !~ '^[0-9]{7,10}$';

ALTER TABLE dnc_numbers
  ADD CONSTRAINT dnc_numbers_phone_key_format CHECK (phone_key ~ '^[0-9]{7,10}$');

-- 3. Belt and braces: collapse any duplicate pair that predates the constraint, keeping the oldest row --
--    the one agents have been working against the longest. Ties on created_at are broken by id so the
--    statement is deterministic and always leaves exactly one row per (campaign, number).
DELETE FROM dnc_numbers a USING dnc_numbers b
 WHERE a.campaign_id = b.campaign_id
   AND a.phone_key    = b.phone_key
   AND (a.created_at, a.id) > (b.created_at, b.id);

-- 4. search_text is derived data (the lowercased blob a list search matches against), so it is derived by
--    the database rather than by whichever route happens to be writing. A manual insert, an edit that
--    changes the number, and a re-upload that enriches an existing row all stay consistent without each
--    one having to remember -- the single most likely way for this to drift.
CREATE OR REPLACE FUNCTION dnc_numbers_set_search_text() RETURNS trigger AS $$
BEGIN
  NEW.search_text := lower(
    coalesce(NEW.phone_display, '') || ' ' ||
    NEW.phone_key || ' ' ||
    coalesce(NEW.note, '') || ' ' ||
    coalesce((SELECT string_agg(entry.value, ' ') FROM jsonb_each_text(NEW.fields) AS entry(key, value)), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dnc_numbers_search_text ON dnc_numbers;
CREATE TRIGGER dnc_numbers_search_text
  BEFORE INSERT OR UPDATE ON dnc_numbers
  FOR EACH ROW EXECUTE FUNCTION dnc_numbers_set_search_text();

-- Backfill: re-saving each row fires the trigger above. This is a no-op change on purpose -- it exists only
-- to run the trigger, and it is safe to re-run.
UPDATE dnc_numbers SET search_text = search_text;
