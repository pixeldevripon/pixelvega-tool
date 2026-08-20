import {
  toActionLabel,
  toAuditLogResponse,
  type AuditLogWithActor,
} from '@/audit-logs/audit-log.mapper';

/**
 * The audit log had no mapper: the service returned `paginate()`'s result
 * untouched, so `action` reached a screen as the raw `user.password_changed` and
 * the actor row went out whole.
 */

describe('toActionLabel', () => {
  it.each([
    ['user.updated', 'User updated'],
    ['user.password_changed', 'User password changed'],
    ['profile.avatar_updated', 'Profile avatar updated'],
    ['user.invited', 'User invited'],
    ['leave.request.approved', 'Leave request approved'],
  ])('%s reads as %s', (action, expected) => {
    expect(toActionLabel(action)).toBe(expected);
  });

  it('handles an action nobody has written yet', () => {
    // The reason this is derived rather than looked up. A lookup table renders
    // a blank cell for whichever new action nobody remembered to add, and it
    // would be blank for exactly the event that mattered enough to audit.
    expect(toActionLabel('invoice.line_item.voided')).toBe(
      'Invoice line item voided',
    );
  });

  it('falls back to the raw action rather than to an empty string', () => {
    // A label is what a screen prints. Empty would render a blank row where
    // something definitely happened.
    expect(toActionLabel('...')).toBe('...');
    expect(toActionLabel('')).toBe('');
  });

  it('leaves a single word alone but for its capital', () => {
    expect(toActionLabel('login')).toBe('Login');
  });
});

describe('toAuditLogResponse', () => {
  const entry = {
    id: 'a1',
    action: 'user.password_changed',
    targetType: 'User',
    targetId: 'u1',
    metadata: { revoked: 3 },
    userId: 'actor1',
    createdAt: new Date('2026-08-19T14:32:00.000Z'),
    user: {
      id: 'actor1',
      name: 'Ada Admin',
      email: 'ada@pixelvega.com',
    },
  } as unknown as AuditLogWithActor;

  it('ships the exact action alongside the readable one', () => {
    // The exact value is what a filter and a comparison use. Nothing may branch
    // on the label.
    const response = toAuditLogResponse(entry);

    expect(response.action).toBe('user.password_changed');
    expect(response.actionLabel).toBe('User password changed');
  });

  it('emits no field the DTO does not declare', () => {
    const response = toAuditLogResponse({
      ...entry,
      user: {
        id: 'actor1',
        name: 'Ada Admin',
        email: 'ada@pixelvega.com',
        password: 'a-real-bcrypt-hash',
        role: 'ADMIN',
      },
    } as unknown as AuditLogWithActor);

    // `User.password` holds a real hash. A spread mapper would have shipped it
    // the moment somebody widened the select.
    expect(Object.keys(response.user as object).sort()).toEqual([
      'email',
      'id',
      'name',
    ]);
  });

  it('keeps a system action with no target', () => {
    // Both columns are nullable, and the DTO used to claim otherwise.
    const response = toAuditLogResponse({
      ...entry,
      targetType: null,
      targetId: null,
      userId: null,
      user: null,
    });

    expect(response.targetType).toBeNull();
    expect(response.targetId).toBeNull();
    expect(response.user).toBeNull();
    // It still reads as something, because it still happened.
    expect(response.actionLabel).toBe('User password changed');
  });

  it('passes the metadata through untouched', () => {
    // Free form and shaped per action. Reformatting it here would guess at a
    // shape the emitting code owns.
    expect(toAuditLogResponse(entry).metadata).toEqual({ revoked: 3 });
  });
});
