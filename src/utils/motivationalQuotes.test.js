import { describe, it, expect } from 'vitest';
import { MOTIVATIONAL_QUOTES, randomMotivationalQuote } from './motivationalQuotes';

describe('randomMotivationalQuote', () => {
  it('always returns one of the defined quotes', () => {
    for (let i = 0; i < 50; i++) {
      expect(MOTIVATIONAL_QUOTES).toContain(randomMotivationalQuote());
    }
  });

  it('has at least a couple of quotes to feel varied, none blank', () => {
    expect(MOTIVATIONAL_QUOTES.length).toBeGreaterThan(1);
    MOTIVATIONAL_QUOTES.forEach(q => expect(q.trim().length).toBeGreaterThan(0));
  });
});
