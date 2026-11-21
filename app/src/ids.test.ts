import { describe, expect, it } from 'vitest';
import { formatObjectId, objectIdFromSearch, parseObjectId } from './ids';

describe('object ids', () => {
  it('parses the PRD example', () => {
    expect(parseObjectId('bud-0201-004217')).toEqual({ kind: 'bud', teryt: '0201', serial: 4217 });
  });

  it('round-trips through format', () => {
    const text = 'bud-0201-004217';
    expect(formatObjectId(parseObjectId(text)!)).toBe(text);
  });

  it.each(['', 'bud-0201-4217', 'BUD-0201-004217', 'bud-201-004217', 'bud-0201-004217 ', 'building-0201-004217'])(
    'rejects %j',
    (text) => {
      expect(parseObjectId(text)).toBeNull();
    },
  );

  it('refuses to format a serial that does not fit', () => {
    expect(() => formatObjectId({ kind: 'bud', teryt: '0201', serial: 1_000_000 })).toThrow(RangeError);
    expect(() => formatObjectId({ kind: 'bud', teryt: '0201', serial: 1.5 })).toThrow(RangeError);
  });

  it('reads the selected object from the page address', () => {
    expect(objectIdFromSearch('?obj=bud-0201-004217')?.serial).toBe(4217);
    expect(objectIdFromSearch('?obj=nonsense')).toBeNull();
    expect(objectIdFromSearch('')).toBeNull();
  });
});
