import { describe, it, expect } from 'vitest';
import { dmChannelId, isDmChannel, DM_PREFIX } from './chatChannels';

describe('dmChannelId', () => {
  it('is order-independent -- same two users always produce the same channel id', () => {
    const a = dmChannelId('usr_agent_1', 'usr_admin_2');
    const b = dmChannelId('usr_admin_2', 'usr_agent_1');
    expect(a).toBe(b);
  });

  it('produces different channel ids for different pairs', () => {
    expect(dmChannelId('a', 'b')).not.toBe(dmChannelId('a', 'c'));
  });

  it('is stable and parseable even when user ids contain underscores', () => {
    const id = dmChannelId('usr_agent_1787115184576', 'usr_admin_1787114859859');
    expect(id.startsWith(DM_PREFIX)).toBe(true);
    // Uses '|' as the pair separator specifically so underscores inside ids never collide with it.
    const withoutPrefix = id.slice(DM_PREFIX.length);
    expect(withoutPrefix.split('|')).toHaveLength(2);
  });
});

describe('isDmChannel', () => {
  it('recognizes a dm: prefixed channel', () => {
    expect(isDmChannel('dm:a|b')).toBe(true);
  });

  it('rejects a plain group channel id', () => {
    expect(isDmChannel('announcements')).toBe(false);
    expect(isDmChannel('grp_night_shift_123')).toBe(false);
  });

  it('rejects non-string input without throwing', () => {
    expect(isDmChannel(undefined)).toBe(false);
    expect(isDmChannel(null)).toBe(false);
    expect(isDmChannel(42)).toBe(false);
  });
});
