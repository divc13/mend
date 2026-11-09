import { describe, expect, it } from 'vitest';
import {
  EvidenceStoreError,
  InMemoryEvidenceStore,
  fixedClock,
} from '../src/index.js';

describe('in-memory evidence store', () => {
  it('stores and returns defensive byte copies', () => {
    const store = new InMemoryEvidenceStore();
    const bytes = new TextEncoder().encode('private evidence');
    store.put('evidence/ev-0001.bin', bytes);
    bytes[0] = 0;

    expect(new TextDecoder().decode(store.get('evidence/ev-0001.bin'))).toBe('private evidence');
    expect(store.has('evidence/ev-0001.bin')).toBe(true);
    expect(store.listKeys()).toEqual(['evidence/ev-0001.bin']);
    expect(store.delete('evidence/ev-0001.bin')).toBe(true);
    expect(store.has('evidence/ev-0001.bin')).toBe(false);
  });

  it('issues a signed token that expires with the deterministic clock', () => {
    const clock = fixedClock('2026-11-10T11:00:00.000Z');
    const store = new InMemoryEvidenceStore({ clock, secret: 'test-secret' });
    store.put('evidence/ev-0001.bin', 'review media');

    const token = store.signAccessToken('evidence/ev-0001.bin', 60);
    expect(token.key).toBe('evidence/ev-0001.bin');
    expect(token.expiresAt).toBe(Math.floor(clock.now().getTime() / 1000) + 60);
    expect(token.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(new TextDecoder().decode(store.readWithToken('evidence/ev-0001.bin', token))).toBe('review media');

    clock.advance(59_000);
    expect(() => store.verifyAccessToken(token)).not.toThrow();
    clock.advance(1_000);
    expect(() => store.verifyAccessToken(token)).toThrow(EvidenceStoreError);
    try {
      store.verifyAccessToken(token);
    } catch (error) {
      expect((error as EvidenceStoreError).code).toBe('TOKEN_EXPIRED');
    }
  });

  it('binds tokens to a key and rejects tampering', () => {
    const store = new InMemoryEvidenceStore({ secret: 'test-secret' });
    store.put('a/one.bin', 'one');
    store.put('a/two.bin', 'two');
    const token = store.signAccessToken('a/one.bin');

    expect(() => store.readWithToken('a/two.bin', token)).toThrow(/different key/);
    expect(() =>
      store.verifyAccessToken({ ...token, token: `${token.token.slice(0, -1)}x` }),
    ).toThrow(/invalid/);
    expect(() =>
      store.verifyAccessToken({ ...token, expiresAt: token.expiresAt + 1 }),
    ).toThrow(/invalid/);
  });

  it('rejects unsafe keys, missing objects and blank secrets', () => {
    const store = new InMemoryEvidenceStore();
    expect(() => store.put('../escape', 'x')).toThrow(/invalid private evidence key/);
    expect(() => store.put('/absolute', 'x')).toThrow(/invalid private evidence key/);
    expect(() => store.put('UPPER', 'x')).toThrow(/invalid private evidence key/);
    expect(() => store.get('missing.bin')).toThrow(/not found/);
    expect(() => new InMemoryEvidenceStore({ secret: '   ' })).toThrow(/must not be blank/);
  });

  it('does not let one store read another store’s token', () => {
    const first = new InMemoryEvidenceStore({ secret: 'first' });
    const second = new InMemoryEvidenceStore({ secret: 'second' });
    first.put('shared.bin', 'first');
    second.put('shared.bin', 'second');
    const token = first.signAccessToken('shared.bin');
    expect(() => second.readWithToken('shared.bin', token)).toThrow(/invalid/);
  });
});
