/**
 * Redaction for anything sent to crash reporting.
 *
 * A crash report leaves the device and sits in Firebase, so nothing personal may be in it. This app
 * handles more of that than most: the cook's own phone and name, and for every job the CUSTOMER's
 * name, address, flat, coordinates, and the start/end OTPs the customer reads out. The Customer App
 * has an equivalent module (`core/logging/redact.ts` there); this one adds the coordinate and
 * customer-detail rules this app needs.
 *
 * Two layers, because neither alone is enough:
 *   - KEYS: a value stored under a name like `phone` or `address` is removed whatever it contains.
 *   - VALUES: a string that merely LOOKS personal (a mobile number inside an error message, a
 *     bearer token, a lat/lng pair) is scrubbed even under an innocent key.
 */

export const REDACTED = '[REDACTED]';

/** Key names whose values are removed entirely, matched case-insensitively as substrings. */
const DENY_KEYS: readonly string[] = [
  'otp',
  'token',
  'authorization',
  'password',
  'secret',
  'apikey',
  'phone',
  'mobile',
  'msisdn',
  'email',
  'name',
  'address',
  'flat',
  'tower',
  'building',
  'society',
  'landmark',
  'street',
  'area',
  'pincode',
  'postalcode',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'lon',
  'coord',
  'location',
  'photo',
  'selfie',
];

/** Value patterns scrubbed even when the key looks innocent. */
const VALUE_PATTERNS: readonly RegExp[] = [
  // Indian mobile numbers, with or without +91 / spaces / hyphens.
  /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g,
  // Bearer tokens and JWT-shaped strings.
  /Bearer\s+[\w.\-+/=]+/gi,
  /\beyJ[\w-]*\.[\w-]*\.[\w-]*/g,
  // A latitude/longitude pair: two decimals of 4+ places, comma-separated.
  /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g,
];

const MAX_DEPTH = 6;

function isDeniedKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
  return DENY_KEYS.some((denied) => normalized.includes(denied));
}

function redactString(value: string): string {
  return VALUE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, REDACTED), value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A deep copy with denied keys and denied value patterns replaced. Cycles and over-deep structures
 * collapse to a marker rather than throwing.
 *
 * An `Error` becomes `{ name, message }`. To report an error WITH its stack, use the reporter,
 * which redacts the message and the stack text separately and keeps the frames.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    return value.map((item) => redact(item, depth + 1, seen));
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = isDeniedKey(key) ? REDACTED : redact(item, depth + 1, seen);
    }
    return output;
  }

  // Functions, symbols, class instances: never sent verbatim.
  return `[${typeof value}]`;
}
