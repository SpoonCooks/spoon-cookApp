import { gateCookAccess, normalisePhone, type VerifyResult } from '@core/domain/auth';

/**
 * The approved-cook gate is the rule that "a valid OTP alone must not grant access". Because the
 * backend currently auto-provisions an active CUSTOMER for any unknown phone that passes OTP
 * (GAP-06), these tests matter: they prove the app refuses entry in exactly the cases the server
 * does not yet reject.
 */

const approved: VerifyResult = {
  role: 'cook',
  userStatus: 'active',
  cookProfileStatus: 'active',
  profile: { cookId: 'c1', name: 'Rekha', photoUrl: null, phone: '9876543210', rating: 4.9 },
};

describe('gateCookAccess', () => {
  it('admits an approved, active cook', () => {
    expect(gateCookAccess(approved)).toMatchObject({ kind: 'signed_in' });
  });

  it('refuses a customer who passed OTP', () => {
    // This is the exact shape the backend returns today for an unknown phone.
    expect(gateCookAccess({ ...approved, role: 'user' })).toEqual({
      kind: 'denied',
      reason: 'not_provisioned',
    });
  });

  it.each([
    ['suspended', 'suspended'],
    ['pending', 'pending_approval'],
    ['deactivated', 'inactive'],
  ])('refuses user status %s', (userStatus, reason) => {
    expect(gateCookAccess({ ...approved, userStatus })).toEqual({ kind: 'denied', reason });
  });

  it.each([
    ['pending', 'pending_approval'],
    ['rejected', 'rejected'],
    ['paused', 'suspended'],
    ['suspended', 'suspended'],
  ])('refuses cook profile status %s', (cookProfileStatus, reason) => {
    expect(gateCookAccess({ ...approved, cookProfileStatus })).toEqual({ kind: 'denied', reason });
  });

  it('refuses an unknown future profile status rather than admitting it', () => {
    // Allowlist behaviour: a status this build has never heard of must not open the app.
    expect(gateCookAccess({ ...approved, cookProfileStatus: 'some_new_status' })).toEqual({
      kind: 'denied',
      reason: 'not_provisioned',
    });
  });

  it('refuses an approved cook with no profile payload', () => {
    expect(gateCookAccess({ ...approved, profile: null })).toEqual({
      kind: 'denied',
      reason: 'not_provisioned',
    });
  });
});

describe('normalisePhone', () => {
  it.each(['9876543210', '+919876543210', '919876543210', '09876543210', '98765 43210'])(
    'accepts %s',
    (input) => {
      expect(normalisePhone(input)).toBe('9876543210');
    },
  );

  it.each(['1234567890', '5876543210', '987654321', '98765432101', ''])('rejects %s', (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});
