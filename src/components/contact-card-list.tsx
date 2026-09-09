'use client';

import { Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/priority-badge';
import type { Contact } from '@/lib/contact-schema';

/**
 * Phone presentation. A six-column table on a 375px screen is unreadable, so below `md`
 * each contact becomes a card with the same information and the same two actions.
 */
export function ContactCardList({
  contacts,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <ul className="grid gap-3">
      {contacts.map((contact) => (
        <li key={contact.id} className="bg-card rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{contact.name}</p>
              {(contact.company || contact.role) && (
                <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                  <Building2 className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">
                    {[contact.role, contact.company].filter(Boolean).join(' · ')}
                  </span>
                </p>
              )}
            </div>
            <PriorityBadge priority={contact.priority} />
          </div>

          {contact.met_at && (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{contact.met_at}</span>
            </p>
          )}

          {contact.notes && (
            <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">{contact.notes}</p>
          )}

          <div className="mt-3 flex gap-2 border-t pt-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(contact)}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-destructive flex-1"
              onClick={() => onDelete(contact)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
