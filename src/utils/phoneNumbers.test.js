import { describe, it, expect } from 'vitest';
import { extractPhoneNumbers } from './phoneNumbers';

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
