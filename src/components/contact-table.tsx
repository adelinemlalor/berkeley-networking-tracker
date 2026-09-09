'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PriorityBadge } from '@/components/priority-badge';
import type { Contact } from '@/lib/contact-schema';

/** Desktop presentation. The phone layout is ContactCardList. */
export function ContactTable({
  contacts,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Where you met</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell className="font-medium">
                {contact.name}
                {contact.notes && (
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 max-w-[38ch] text-xs font-normal">
                    {contact.notes}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{contact.company ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{contact.role ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{contact.met_at ?? '—'}</TableCell>
              <TableCell>
                <PriorityBadge priority={contact.priority} />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(contact)}
                  aria-label={`Edit ${contact.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(contact)}
                  aria-label={`Delete ${contact.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
