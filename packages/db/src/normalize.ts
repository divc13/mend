/**
 * Removes `undefined` object properties recursively.
 *
 * Postgres row mappers return optional columns as `undefined` properties, while
 * the in-memory repository omits them. `stableStringify` intentionally keeps
 * undefined keys, so hashes must be computed over a normalised value to make
 * memory and Postgres read-model fingerprints identical.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      output[key] = stripUndefined(nested);
    }
    return output as T;
  }
  return value;
}
