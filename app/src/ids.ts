/**
 * Stable object identifiers (PRD 7.4), e.g. `bud-0201-004217`:
 * `<kind>-<TERYT of the county>-<serial>`. An id is assigned once by the pipeline and
 * never changes between rebuilds; the app only parses and formats it.
 */
export interface ObjectId {
  /** Three-letter object kind, e.g. `bud` for a building. */
  kind: string;
  /** Four-digit county TERYT code, e.g. `0201` for powiat bolesławiecki. */
  teryt: string;
  serial: number;
}

const OBJECT_ID_RE = /^([a-z]{3})-(\d{4})-(\d{6})$/;

export function parseObjectId(text: string): ObjectId | null {
  const m = OBJECT_ID_RE.exec(text);
  if (!m) return null;
  return { kind: m[1]!, teryt: m[2]!, serial: Number(m[3]) };
}

export function formatObjectId(id: ObjectId): string {
  const text = `${id.kind}-${id.teryt}-${String(id.serial).padStart(6, '0')}`;
  if (!Number.isInteger(id.serial) || !OBJECT_ID_RE.test(text)) {
    throw new RangeError(`not a valid object id: ${text}`);
  }
  return text;
}

/** The object selected by the page address (`?obj=bud-0201-004217`), if it is a valid id. */
export function objectIdFromSearch(search: string): ObjectId | null {
  const value = new URLSearchParams(search).get('obj');
  return value ? parseObjectId(value) : null;
}
