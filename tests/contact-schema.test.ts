/**
 * Validation tests.
 *
 * These cover the rules the UI enforces for fast feedback. The identical rules are enforced
 * again in Postgres as CHECK constraints, and `npm run verify:rls` proves *that* layer by
 * posting invalid data straight at the Data API with this module bypassed entirely. Both
 * layers matter: this one is for humans, that one is for attackers.
 */
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  PRIORITIES,
  emptyContact,
  validateContact,
} from '@/lib/contact-schema';

const valid = {
  name: 'Priya Raman',
  company: 'Sketchy Labs',
  role: 'Staff Engineer',
  met_at: 'CS 194 guest lecture',
  notes: 'Offered to review my resume.',
  priority: 'high',
};

describe('validateContact — name', () => {
  it('accepts a fully populated contact', () => {
    const result = validateContact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Priya Raman');
  });

  it('rejects an empty name', () => {
    const result = validateContact({ ...valid, name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBe('Name is required.');
  });

  it('rejects a whitespace-only name, matching the DB btrim check', () => {
    const result = validateContact({ ...valid, name: '   \t  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBe('Name is required.');
  });

  it('rejects a missing name', () => {
    const { name, ...withoutName } = valid;
    void name;
    expect(validateContact(withoutName).ok).toBe(false);
  });

  it(`rejects a name longer than ${LIMITS.name} characters`, () => {
    const result = validateContact({ ...valid, name: 'a'.repeat(LIMITS.name + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toContain('120 characters or fewer');
  });

  it(`accepts a name of exactly ${LIMITS.name} characters`, () => {
    expect(validateContact({ ...valid, name: 'a'.repeat(LIMITS.name) }).ok).toBe(true);
  });

  it('trims surrounding whitespace rather than storing it', () => {
    const result = validateContact({ ...valid, name: '  Priya Raman  ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Priya Raman');
  });
});

describe('validateContact — priority', () => {
  it.each(PRIORITIES)('accepts the valid priority %s', (priority) => {
    expect(validateContact({ ...valid, priority }).ok).toBe(true);
  });

  it.each(['urgent', 'HIGH', 'critical', '', 'none', '1'])(
    'rejects the invalid priority %o',
    (priority) => {
      const result = validateContact({ ...valid, priority });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.priority).toBe('Priority must be high, medium, or low.');
    },
  );

  it('rejects a missing priority', () => {
    const { priority, ...withoutPriority } = valid;
    void priority;
    expect(validateContact(withoutPriority).ok).toBe(false);
  });

  it('allows exactly three priorities and no more', () => {
    expect([...PRIORITIES]).toEqual(['high', 'medium', 'low']);
  });
});

describe('validateContact — optional fields', () => {
  it('accepts a contact with only a name and priority', () => {
    expect(validateContact({ name: 'Solo', priority: 'low' }).ok).toBe(true);
  });

  it('normalises blank optional fields to null so the DB stores NULL, not ""', () => {
    const result = validateContact({ name: 'Solo', priority: 'low', company: '   ', notes: '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.company).toBeNull();
      expect(result.value.notes).toBeNull();
    }
  });

  it(`rejects notes longer than ${LIMITS.notes} characters`, () => {
    const result = validateContact({ ...valid, notes: 'x'.repeat(LIMITS.notes + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.notes).toContain('2000 characters or fewer');
  });
});

describe('validateContact — error reporting', () => {
  it('reports every invalid field at once, not just the first', () => {
    const result = validateContact({ name: '', priority: 'urgent' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBeDefined();
      expect(result.errors.priority).toBeDefined();
    }
  });

  it('rejects junk input without throwing', () => {
    for (const junk of [null, undefined, 42, 'a string', []]) {
      expect(() => validateContact(junk)).not.toThrow();
      expect(validateContact(junk).ok).toBe(false);
    }
  });
});

describe('emptyContact', () => {
  it('does not validate on its own, so a blank form cannot be submitted', () => {
    expect(validateContact(emptyContact).ok).toBe(false);
  });

  it('defaults priority to a value the database accepts', () => {
    expect(PRIORITIES).toContain(emptyContact.priority);
  });
});
