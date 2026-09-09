/**
 * Sorting and filtering behaviour behind the contacts toolbar.
 */
import { describe, expect, it } from 'vitest';
import type { Contact } from '@/lib/contact-schema';
import {
  applyFilters,
  applySort,
  defaultFilters,
  filterAndSort,
  hasActiveFilters,
} from '@/lib/filter-sort';

const contact = (over: Partial<Contact> & { name: string }): Contact => ({
  id: over.name.toLowerCase().replace(/\s+/g, '-'),
  user_id: 'user-1',
  company: null,
  role: null,
  met_at: null,
  notes: null,
  priority: 'medium',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const contacts: Contact[] = [
  contact({ name: 'Bianca Ortiz', company: 'Figma', priority: 'low',    created_at: '2026-03-01T00:00:00Z' }),
  contact({ name: 'Aaron Chen',   company: 'Stripe', priority: 'high',   created_at: '2026-01-15T00:00:00Z' }),
  contact({ name: 'Chidi Okeke',  company: 'Stripe', priority: 'medium', created_at: '2026-02-10T00:00:00Z',
            met_at: 'Berkeley career fair', notes: 'Mentioned an internship req.' }),
];

describe('applyFilters — priority', () => {
  it('returns everything when the filter is "all"', () => {
    expect(applyFilters(contacts, defaultFilters)).toHaveLength(3);
  });

  it.each(['high', 'medium', 'low'] as const)('narrows to only %s priority', (priority) => {
    const result = applyFilters(contacts, { ...defaultFilters, priority });
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe(priority);
  });
});

describe('applyFilters — search', () => {
  it('matches on name, case-insensitively', () => {
    expect(applyFilters(contacts, { ...defaultFilters, search: 'aaron' }).map((c) => c.name))
      .toEqual(['Aaron Chen']);
  });

  it('matches on company and can return several people', () => {
    expect(applyFilters(contacts, { ...defaultFilters, search: 'stripe' }).map((c) => c.name))
      .toEqual(['Aaron Chen', 'Chidi Okeke']);
  });

  it('matches on where they met and on notes', () => {
    expect(applyFilters(contacts, { ...defaultFilters, search: 'career fair' })).toHaveLength(1);
    expect(applyFilters(contacts, { ...defaultFilters, search: 'internship' })).toHaveLength(1);
  });

  it('ignores surrounding whitespace in the search term', () => {
    expect(applyFilters(contacts, { ...defaultFilters, search: '   ' })).toHaveLength(3);
  });

  it('returns an empty list when nothing matches', () => {
    expect(applyFilters(contacts, { ...defaultFilters, search: 'nobody here' })).toHaveLength(0);
  });

  it('does not fall over on contacts whose optional fields are null', () => {
    expect(() => applyFilters(contacts, { ...defaultFilters, search: 'x' })).not.toThrow();
  });
});

describe('applyFilters — combined', () => {
  it('applies search and priority together', () => {
    const result = applyFilters(contacts, { search: 'stripe', priority: 'high' });
    expect(result.map((c) => c.name)).toEqual(['Aaron Chen']);
  });
});

describe('applySort', () => {
  it('sorts by name ascending and descending', () => {
    expect(applySort(contacts, 'name_asc').map((c) => c.name))
      .toEqual(['Aaron Chen', 'Bianca Ortiz', 'Chidi Okeke']);
    expect(applySort(contacts, 'name_desc').map((c) => c.name))
      .toEqual(['Chidi Okeke', 'Bianca Ortiz', 'Aaron Chen']);
  });

  it('sorts by date added, newest and oldest first', () => {
    expect(applySort(contacts, 'created_desc').map((c) => c.name))
      .toEqual(['Bianca Ortiz', 'Chidi Okeke', 'Aaron Chen']);
    expect(applySort(contacts, 'created_asc').map((c) => c.name))
      .toEqual(['Aaron Chen', 'Chidi Okeke', 'Bianca Ortiz']);
  });

  it('sorts by priority using high > medium > low, not alphabetically', () => {
    expect(applySort(contacts, 'priority_desc').map((c) => c.priority))
      .toEqual(['high', 'medium', 'low']);
    expect(applySort(contacts, 'priority_asc').map((c) => c.priority))
      .toEqual(['low', 'medium', 'high']);
  });

  it('breaks priority ties by name so the order is stable', () => {
    const tied = [
      contact({ name: 'Zoe Adams', priority: 'high' }),
      contact({ name: 'Adam Zephyr', priority: 'high' }),
    ];
    expect(applySort(tied, 'priority_desc').map((c) => c.name))
      .toEqual(['Adam Zephyr', 'Zoe Adams']);
  });

  it('never mutates the array it is given', () => {
    const original = [...contacts];
    applySort(contacts, 'name_asc');
    expect(contacts).toEqual(original);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default filters', () => {
    expect(hasActiveFilters(defaultFilters)).toBe(false);
  });

  it('is false when the search box holds only whitespace', () => {
    expect(hasActiveFilters({ ...defaultFilters, search: '  ' })).toBe(false);
  });

  it('is true once a search term or priority is set', () => {
    expect(hasActiveFilters({ ...defaultFilters, search: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...defaultFilters, priority: 'high' })).toBe(true);
  });
});

describe('filterAndSort', () => {
  it('filters first, then sorts what is left', () => {
    const result = filterAndSort(contacts, { search: 'stripe', priority: 'all' }, 'name_desc');
    expect(result.map((c) => c.name)).toEqual(['Chidi Okeke', 'Aaron Chen']);
  });
});
