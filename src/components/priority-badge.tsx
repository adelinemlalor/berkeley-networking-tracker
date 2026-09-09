import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Priority } from '@/lib/contact-schema';

/**
 * Priority is colour-coded, but never *only* colour-coded: the word itself is always
 * present, so the meaning survives for colourblind users and in greyscale screenshots.
 */
const STYLES: Record<Priority, string> = {
  high: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300',
  medium:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300',
  low: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={cn('capitalize', STYLES[priority])}>
      {priority}
    </Badge>
  );
}
