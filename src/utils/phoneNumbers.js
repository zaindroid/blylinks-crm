// Pulls phone numbers out of an uploaded DNC file (.csv / .tsv / .txt), keeping the rest of the sheet.
//
// Files arrive from all sorts of places: one number per line, a CSV with a name column and a phone column,
// a spreadsheet export with a "date added" column next to the number. So this does two things: it works out
// which column holds the phone numbers (or, in a file with no real columns, treats every cell on its own),
// and it keeps the values of the sheet's *other* columns alongside each number.
//
// That second part is why parseDncFile returns rows rather than a flat list of numbers: the master list a
// DNC list ends up as is far more useful when a number still carries the name, city or reference the sheet
// had, and it makes that text searchable. The server re-validates and normalises every number it is given,
// so the parsing here only decides what to offer -- it is never the last word on what is a valid number.

// A cell that could be a phone number: digits, and the punctuation phones get written with, nothing else.
const PHONE_CELL = /^[+()\d][\d\s().+-]*$/;

// A "date added" column is common in exports. Only unambiguous dates (a 4-digit year, in year-first or
// year-last order) are recognised, so a genuine number written with hyphens is never mistaken for one and
// dropped -- and, just as importantly, a date is never mistaken for a phone number and imported.
const DATE_CELL = /^(?:(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;

// Filler like 0000000 or 1111111 is a placeholder, not a number. Mirrors phoneKey() on the server, so the
// preview cannot promise a number that the server is about to reject.
const PLACEHOLDER_CELL = /^(\d)\1+$/;

// Every delimiter a flat file might use, and the ones a structured one has to choose between.
const ALL_DELIMITERS = [',', ';', '\t', '|'];

// Headers that name the phone column outright -- a stronger signal than any guess based on the values.
const HEADER_PHONE = /(phone|mobile|cell|msisdn|whatsapp|tel)/i;
const HEADER_NOTE = /^(note|notes|remark|remarks|comment|comments|reason)$/i;

const MAX_FIELDS = 20; // how much of a row's other columns is worth keeping
const MAX_FIELD_LENGTH = 200; // per value, matching the limit the server enforces
export const MAX_HEADER_LENGTH = 60;

// How many rows are sent per request when importing. A file is uploaded in chunks of this size, so the size
// of the file itself is never what decides whether it can be imported.
export const IMPORT_CHUNK_SIZE = 5000;

const digitsOf = (cell) => (cell.match(/\d/g) || []).length;

function isPhoneNumber(cell) {
  if (!cell || !PHONE_CELL.test(cell)) return false;
  if (DATE_CELL.test(cell)) return false;
  const digits = cell.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (PLACEHOLDER_CELL.test(digits)) return false;
  return true;
}

// Splits the file into rows and cells. Quotes are honoured (a quoted field may contain the delimiter, or a
// newline), which is what keeps `"Sara, Jr"` from being read as two columns.
function tokenize(text, delimiters) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (delimiters.includes(ch)) { row.push(cell); cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }

  return rows.map(cells => cells.map(c => c.trim().replace(/^['"]+|['"]+$/g, '').trim()));
}

// Which single character separates the columns, if any. A file that uses one delimiter consistently has
// columns; one that uses several equally (or none at all) does not, and is read cell by cell instead.
function detectDelimiter(text) {
  let best = null;
  let bestCount = 0;
  let tied = false;

  for (const delimiter of ALL_DELIMITERS) {
    const count = text.split(delimiter).length - 1;
    if (count > bestCount) { best = delimiter; bestCount = count; tied = false; }
    else if (count > 0 && count === bestCount) tied = true;
  }

  return bestCount === 0 || tied ? null : best;
}

function looksLikeHeader(cells) {
  // Labels, not data: at least one filled cell with no digits in it at all.
  return cells.some(c => c !== '' && digitsOf(c) === 0);
}

// Names the columns. A header row supplies the real names; without one they are positional, which still
// keeps each value attached to its own column rather than lumping them together.
function columnNames(firstRow, hasHeader) {
  return firstRow.map((cell, i) => (hasHeader && cell ? cell.slice(0, MAX_HEADER_LENGTH) : `Column ${i + 1}`));
}

function pickPhoneColumn(columns, dataRows) {
  const named = columns.findIndex(c => HEADER_PHONE.test(c));
  if (named !== -1) return named;

  let best = -1;
  let bestValid = 0;
  for (let c = 0; c < columns.length; c++) {
    let filled = 0;
    let valid = 0;
    for (const row of dataRows) {
      const cell = row[c];
      if (!cell) continue;
      filled += 1;
      if (isPhoneNumber(cell)) valid += 1;
    }
    // The column has to be mostly phone numbers, not merely the one with the most of them. Otherwise a
    // column of invoice amounts or account numbers (7+ digits each) beats the real phone column.
    if (filled > 0 && valid > 0 && valid / filled >= 0.5 && valid > bestValid) {
      best = c;
      bestValid = valid;
    }
  }
  return best;
}

// Every cell on its own. Used when the file has no columns to speak of (one number per line) or none of
// them looks like a phone column -- the same forgiving read the uploader always did, so odd files still
// import instead of being rejected outright.
function scanEveryCell(rows) {
  const numbers = [];
  let skipped = 0;

  for (const row of rows) {
    for (const cell of row) {
      if (!cell) continue;
      if (digitsOf(cell) === 0 || DATE_CELL.test(cell)) continue; // a header, a name or a date
      if (isPhoneNumber(cell)) numbers.push({ phone: cell, note: '', fields: {} });
      else skipped += 1; // has digits but is not a plausible phone number (an id, a date, "ext 12"...)
    }
  }

  return { rows: numbers, skipped, columns: [], phoneColumn: null };
}

// The other columns of the row, as header -> value, minus the number itself and anything blank.
function collectFields(row, columns, { phoneColumn, noteColumn }) {
  const fields = {};
  let note = '';

  for (let c = 0; c < columns.length; c++) {
    if (c === phoneColumn) continue;
    const value = row[c];
    if (!value) continue;
    if (c === noteColumn) { note = value.slice(0, MAX_FIELD_LENGTH); continue; }
    if (Object.keys(fields).length >= MAX_FIELDS) continue;
    fields[columns[c]] = value.slice(0, MAX_FIELD_LENGTH);
  }

  return { fields, note };
}

function readPhoneColumn(dataRows, columns, phoneColumn, noteColumn) {
  const numbers = [];
  let skipped = 0;

  for (const row of dataRows) {
    const cell = row[phoneColumn] || '';
    if (!cell || DATE_CELL.test(cell) || digitsOf(cell) === 0) continue;

    const { fields, note } = collectFields(row, columns, { phoneColumn, noteColumn });

    if (isPhoneNumber(cell)) {
      numbers.push({ phone: cell, note, fields });
      continue;
    }
    // A phone cell holding more than one number ("03001234567 / 03007654321") is worth reading properly
    // rather than throwing the row away over.
    const rescued = cell.split(/[,;\t|]+/).map(part => part.trim()).filter(isPhoneNumber);
    if (rescued.length === 0) { skipped += 1; continue; }
    for (const phone of rescued) numbers.push({ phone, note, fields });
  }

  return { rows: numbers, skipped, columns, phoneColumn: columns[phoneColumn] };
}

/**
 * Reads an uploaded DNC file.
 *
 * Returns `{ rows, skipped, columns, phoneColumn }`, where each row is `{ phone, note, fields }` -- the
 * number as it was written in the sheet, an optional note, and the sheet's other columns for that row.
 */
export function parseDncFile(rawText) {
  const text = String(rawText ?? '');
  const delimiter = detectDelimiter(text);
  const parsed = tokenize(text, delimiter ? [delimiter] : ALL_DELIMITERS);

  // No consistent separator: there are no columns, so read every cell on its own.
  if (!delimiter) return scanEveryCell(parsed);

  const firstRow = parsed[0] || [];
  const hasHeader = looksLikeHeader(firstRow);
  const columns = columnNames(firstRow, hasHeader);
  const dataRows = (hasHeader ? parsed.slice(1) : parsed).filter(row => row.some(c => c !== ''));

  // A structured file with no identifiable phone column (every value a name, say) falls back to reading
  // each cell, so the upload reports "no numbers found" rather than importing the wrong column.
  const phoneColumn = pickPhoneColumn(columns, dataRows);
  if (phoneColumn === -1) return scanEveryCell(dataRows);

  const noteColumn = hasHeader ? columns.findIndex(c => HEADER_NOTE.test(c)) : -1;
  return readPhoneColumn(dataRows, columns, phoneColumn, noteColumn);
}

/**
 * The flat list of numbers in a file, in the shape the original uploader used.
 * Kept for callers that only want the numbers themselves.
 */
export function extractPhoneNumbers(text) {
  const { rows, skipped } = parseDncFile(text);
  return { numbers: rows.map(row => row.phone), skipped };
}
