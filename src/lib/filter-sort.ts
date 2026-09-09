/**
 * Pure sorting and filtering over a list of contacts.
 *
 * Kept free of React and of any network code so it can be unit-tested directly.
 * The list is small (one user's contacts), so filtering client-side keeps the UI
 * instant; the database still only ever hands this code the caller's own rows.
 */
import type { Contact, Priority } from './contact-schema';

export const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'created_asc', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'priority_desc', label: 'Priority (high first)' },
  { value: 'priority_asc', label: 'Priority (low first)' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['value'];
export type PriorityFilter = Priority | 'all';

/** Rank used for priority ordering; high is "greatest" so it sorts first descending. */
const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

export type ContactFilters = {
  search: string;
  priority: PriorityFilter;
};

export const defaultFilters: ContactFilters = { search: '', priority: 'all' };

/** True when any filter is actually narrowing the list -- drives the "clear filters" affordance. */
export function hasActiveFilters(filters: ContactFilters): boolean {
  return filters.search.trim() !== '' || filters.priority !== 'all';
}

/**
 * Free-text search across the fields a person would actually search by, plus a
 * priority facet. Matching is case-insensitive and substring-based.
 */
export function applyFilters(contacts: Contact[], filters: ContactFilters): Contact[] {
  const term = filters.search.trim().toLowerCase();

  return contacts.filter((c) => {
    if (filters.priority !== 'all' && c.priority !== filters.priority) return false;
    if (term === '') return true;

    return [c.name, c.company, c.role, c.met_at, c.notes].some((field) =>
      (field ?? '').toLowerCase().includes(term),
    );
  });
}

/** Returns a new sorted array; never mutates the input. */
export function applySort(contacts: Contact[], sort: SortKey): Contact[] {
  const byName = (a: Contact, b: Contact) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const byCreated = (a: Contact, b: Contact) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  const byPriority = (a: Contact, b: Contact) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  const comparators: Record<SortKey, (a: Contact, b: Contact) => number> = {
    created_desc: (a, b) => -byCreated(a, b),
    created_asc: byCreated,
    name_asc: byName,
    name_desc: (a, b) => -byName(a, b),
    // Ties within a priority band fall back to name, so the order is stable and predictable.
    priority_desc: (a, b) => -byPriority(a, b) || byName(a, b),
    priority_asc: (a, b) => byPriority(a, b) || byName(a, b),
  };

  return [...contacts].sort(comparators[sort]);
}

/** Convenience: filter then sort, the order the UI always wants. */
export function filterAndSort(
  contacts: Contact[],
  filters: ContactFilters,
  sort: SortKey,
): Contact[] {
  return applySort(applyFilters(contacts, filters), sort);
}
