'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRIORITIES } from '@/lib/contact-schema';
import {
  SORT_OPTIONS,
  hasActiveFilters,
  type ContactFilters,
  type PriorityFilter,
  type SortKey,
} from '@/lib/filter-sort';

/**
 * Search, priority filter, and sort. Stacks to a single column on phones and spreads out
 * from `sm:` upwards.
 */
export function ContactsToolbar({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onClear,
}: {
  filters: ContactFilters;
  sort: SortKey;
  onFiltersChange: (next: ContactFilters) => void;
  onSortChange: (next: SortKey) => void;
  onClear: () => void;
}) {
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          className="pl-9"
          placeholder="Search name, company, role, notes…"
          aria-label="Search contacts"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <Select
          value={filters.priority}
          onValueChange={(v) => onFiltersChange({ ...filters, priority: v as PriorityFilter })}
        >
          <SelectTrigger className="flex-1 sm:w-[150px] sm:flex-none" aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger className="flex-1 sm:w-[180px] sm:flex-none" aria-label="Sort contacts">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {active && (
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear filters">
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
