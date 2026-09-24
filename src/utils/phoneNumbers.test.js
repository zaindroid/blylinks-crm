import { describe, it, expect } from 'vitest';
import { extractPhoneNumbers, parseDncFile } from './phoneNumbers';

describe('extractPhoneNumbers', () => {
  it('reads one number per line, however it is formatted', () => {
    const { numbers, skipped } = extractPhoneNumbers('03001234567\n+92 300 7654321\n(555) 123-4567\r\n0092-300-1112222');
    expect(numbers).toEqual(['03001234567', '+92 300 7654321', '(555) 123-4567', '0092-300-1112222']);
    expect(skipped).toBe(0);
  });

  it('finds the phone column in a CSV with a header and other columns', () => {
    const csv = 'name,phone,city\nAli Khan,0300 1234567,Lahore\n"Sara, Jr",+1 555 123 4567,Austin\n';
    expect(extractPhoneNumbers(csv).numbers).toEqual(['0300 1234567', '+1 555 123 4567']);
  });

  it('handles commas, semicolons, tabs and pipes as separators, and strips quotes', () => {
    expect(extractPhoneNumbers('"03001111111";\'03002222222\'\t03003333333|03004444444,03005555555').numbers)
      .toHaveLength(5);
  });

  it('ignores headers and names entirely, and counts digit-bearing junk as skipped', () => {
    const { numbers, skipped } = extractPhoneNumbers('phone\nAli\n12345\next 4421\n03001234567');
    expect(numbers).toEqual(['03001234567']);
    expect(skipped).toBe(2); // 12345 (too short) and "ext 4421" (not a number)
  });

  it('ignores a date-added column instead of mistaking dates for phone numbers', () => {
    const csv = 'phone,added\n03001234567,2026-03-05\n03007654321,05/03/2026\n03009998888,2026-03-05 14:30';
    const { numbers, skipped } = extractPhoneNumbers(csv);
    expect(numbers).toEqual(['03001234567', '03007654321', '03009998888']);
    expect(skipped).toBe(0);
  });

  it('does not mistake a hyphenated phone number for a date', () => {
    expect(extractPhoneNumbers('555-123-4567\n0300-12-34567\n042-3585-1234').numbers).toHaveLength(3);
  });

  it('rejects absurdly long digit strings', () => {
    expect(extractPhoneNumbers('1'.repeat(30)).numbers).toEqual([]);
  });

  it('copes with empty and missing input', () => {
    expect(extractPhoneNumbers('')).toEqual({ numbers: [], skipped: 0 });
    expect(extractPhoneNumbers(undefined)).toEqual({ numbers: [], skipped: 0 });
    expect(extractPhoneNumbers('\n\n , ;\n')).toEqual({ numbers: [], skipped: 0 });
  });
});

describe('parseDncFile', () => {
  it('keeps the sheet\'s other columns with each number, and reads a notes column as the note', () => {
    const csv = 'name,phone,city,remarks\nAli,0300 1234567,Lahore,called twice\nSara,+1 555 123 4567,Austin,asked to be removed\n';
    const { rows, phoneColumn, columns } = parseDncFile(csv);

    expect(phoneColumn).toBe('phone');
    expect(columns).toEqual(['name', 'phone', 'city', 'remarks']);
    expect(rows).toEqual([
      { phone: '0300 1234567', note: 'called twice', fields: { name: 'Ali', city: 'Lahore' } },
      { phone: '+1 555 123 4567', note: 'asked to be removed', fields: { name: 'Sara', city: 'Austin' } }
    ]);
  });

  it('trusts a column named for phones over one that merely scores well', () => {
    // Both columns are full of 7+ digit values, so the values alone cannot tell them apart -- the header
    // is what says which one is the phone number.
    const csv = 'account,mobile\n1234567890,03001234567\n7654321098,03007654321\n';
    const { rows, phoneColumn } = parseDncFile(csv);
    expect(phoneColumn).toBe('mobile');
    expect(rows.map(r => r.phone)).toEqual(['03001234567', '03007654321']);
  });

  it('does not pick a column of amounts or quantities just because it has the most digits', () => {
    const csv = 'invoice,amount,phone\nINV-1,1234567,03001234567\nINV-2,7654321,03007654321\n';
    const { rows, phoneColumn } = parseDncFile(csv);
    expect(phoneColumn).toBe('phone');
    expect(rows.map(r => r.phone)).toEqual(['03001234567', '03007654321']);
  });

  it('keeps every cell of a headerless file and reports no columns at all', () => {
    const { rows, columns, phoneColumn } = parseDncFile('03001234567\n03007654321\n');
    expect(phoneColumn).toBeNull();
    expect(columns).toEqual([]);
    expect(rows).toEqual([
      { phone: '03001234567', note: '', fields: {} },
      { phone: '03007654321', note: '', fields: {} }
    ]);
  });

  it('keeps a quoted field containing the delimiter in one piece', () => {
    const { rows } = parseDncFile('name,phone\n"Sara, Jr",03001234567\n');
    expect(rows[0].fields.name).toBe('Sara, Jr');
  });

  it('never imports a date column as numbers, whatever it is headed', () => {
    const { rows } = parseDncFile('added,phone\n2026-03-05,03001234567\n05/03/2026,03007654321\n');
    expect(rows.map(r => r.phone)).toEqual(['03001234567', '03007654321']);
    expect(rows.every(r => r.fields.added)).toBe(true);
  });

  it('reads both numbers out of a cell that holds two', () => {
    const { rows } = parseDncFile('phone,note\n03001234567;03007654321,two numbers\n');
    expect(rows.map(r => r.phone)).toEqual(['03001234567', '03007654321']);
    expect(rows.every(r => r.note === 'two numbers')).toBe(true);
  });
});
