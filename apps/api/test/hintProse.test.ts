import { describe, expect, it } from 'vitest';
import { normalizeHintProse } from '../src/hintProse.js';
describe('hint punctuation', () => {
  it('normalizes prose and preserves identifiers including regex punctuation', () => {
    expect(normalizeHintProse('Inspect q\u20141[0]\u2014then q\u20141.', ['q\u20141', 'q\u20141[0]'])).toBe('Inspect q\u20141[0], then q\u20141.');
  });
  it('normalizes prose without modifying other punctuation', () => {
    expect(normalizeHintProse('Trace a\u2014why? q0 → q1.', [])).toBe('Trace a, why? q0 → q1.');
  });
});
