// Pulls phone numbers out of an uploaded DNC file (.csv / .tsv / .txt). Files come from all sorts of places:
// one number per line, a CSV with a name column and a phone column, numbers separated by commas or
// semicolons. Every cell is looked at on its own; only cells that look like a phone number are kept.

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB of text is comfortably 100k+ numbers
export const MAX_NUMBERS_PER_UPLOAD = 20000; // keep in step with the server's limit

const PHONE_CELL = /^[+()\d][\d\s().+-]*$/; // digits plus the usual punctuation, nothing alphabetic

// A "date added" column is common in exports. Only unambiguous dates (a 4-digit year, in year-first or year-last
// order) are recognised, so a genuine number written with hyphens is never mistaken for one and dropped.
const DATE_CELL = /^(?:(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;

export function extractPhoneNumbers(text) {
  const numbers = [];
  let skipped = 0;

  for (const rawCell of String(text || '').split(/[\r\n,;\t|]+/)) {
    const cell = rawCell.trim().replace(/^["']+|["']+$/g, '').trim();
    if (!cell) continue;

    const digitCount = (cell.match(/\d/g) || []).length;
    if (digitCount === 0 || DATE_CELL.test(cell)) continue; // a header ("phone"), a name or a date -- not a candidate at all

    if (PHONE_CELL.test(cell) && digitCount >= 7 && digitCount <= 15) numbers.push(cell);
    else skipped += 1; // has digits but is not a plausible phone number (an id, a date, "ext 12"...)
  }

  return { numbers, skipped };
}
