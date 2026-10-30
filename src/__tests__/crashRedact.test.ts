import { REDACTED, redact } from '@core/crash/redact';

/**
 * What may never reach Firebase. This app handles the cook's own details AND the customer's (name,
 * address, flat, coordinates, and the start/end OTPs read out at the door), so the rules are checked
 * one by one rather than trusting a single catch-all assertion.
 */
describe('redact', () => {
  it.each([
    'otp',
    'startOtp',
    'accessToken',
    'refreshToken',
    'authorization',
    'phone',
    'cookPhone',
    'customerName',
    'name',
    'address',
    'addressLine1',
    'flat',
    'tower',
    'society',
    'latitude',
    'longitude',
    'lat',
    'lng',
    'coords',
    'photoUrl',
    'selfie',
  ])('removes the value under the key %s, whatever it holds', (key) => {
    expect(redact({ [key]: 'anything' })).toEqual({ [key]: REDACTED });
  });

  it('keeps the harmless context this app actually attaches', () => {
    expect(redact({ task: 'location', status: 502, source: 'route-error-boundary' })).toEqual({
      task: 'location',
      status: 502,
      source: 'route-error-boundary',
    });
  });

  it.each([
    ['a mobile number', 'could not reach 9876543210 now'],
    ['a +91 number', 'sent to +91 98765 43210'],
    ['a bearer token', 'header Bearer abc.def-ghi_jkl=='],
    ['a JWT', 'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln here'],
    ['a coordinate pair', 'at 12.9058471, 77.6487022 failed'],
  ])('scrubs %s out of a string under an innocent key', (_label, text) => {
    const result = redact({ detail: text }) as { detail: string };

    expect(result.detail).toContain(REDACTED);
    expect(result.detail).not.toMatch(/9876543210|98765 43210|abc\.def|eyJhbGci|12\.9058471/);
  });

  it('reduces an Error to a scrubbed name and message, with no stack', () => {
    const result = redact(new Error('failed for 9876543210')) as Record<string, unknown>;

    expect(Object.keys(result).sort()).toEqual(['message', 'name']);
    expect(String(result['message'])).not.toContain('9876543210');
  });

  it('copes with cycles and very deep structures instead of throwing', () => {
    const cyclic: Record<string, unknown> = { task: 'location' };
    cyclic['self'] = cyclic;
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 20; i += 1) deep = { next: deep };

    expect(() => redact(cyclic)).not.toThrow();
    expect(() => redact(deep)).not.toThrow();
  });

  it('never passes a function or class instance through verbatim', () => {
    expect(redact({ handler: () => 'secret' })).toEqual({ handler: '[function]' });
  });
});
