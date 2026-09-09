import { SearchX, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Two genuinely different empty states.
 *
 * "You have no contacts" and "your filters matched nothing" look the same if you only check
 * `list.length === 0`, but they need opposite actions: add something, or stop filtering.
 */
export function EmptyState({
  filtered,
  onAdd,
  onClearFilters,
}: {
  filtered: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
}) {
  const Icon = filtered ? SearchX : UserPlus;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </div>

      <h2 className="font-medium">
        {filtered ? 'No contacts match your filters' : 'No contacts yet'}
      </h2>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm text-balance">
        {filtered
          ? 'Try a different search term, or clear the filters to see everyone.'
          : 'Add the first person you want to stay connected with. Only you can see your contacts.'}
      </p>

      <Button className="mt-5" onClick={filtered ? onClearFilters : onAdd} variant={filtered ? 'outline' : 'default'}>
        {filtered ? 'Clear filters' : 'Add your first contact'}
      </Button>
    </div>
  );
}
