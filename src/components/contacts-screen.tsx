'use client';

/**
 * The tracker itself: header, toolbar, list, and the create/edit/delete flows.
 *
 * Contacts are fetched once and then kept in local state, with each successful write applied
 * to that state so the list updates without a refetch. The database remains the source of
 * truth -- a page refresh re-reads it, which is exactly what proves the data is persisted in
 * Postgres rather than living in the browser.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, LogOut, Plus, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '@/lib/neon';
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from '@/lib/contacts-repo';
import type { Contact, ContactInput } from '@/lib/contact-schema';
import {
  defaultFilters,
  filterAndSort,
  hasActiveFilters,
  type ContactFilters,
  type SortKey,
} from '@/lib/filter-sort';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContactsToolbar } from '@/components/contacts-toolbar';
import { ContactFormDialog } from '@/components/contact-form-dialog';
import { ContactTable } from '@/components/contact-table';
import { ContactCardList } from '@/components/contact-card-list';
import { EmptyState } from '@/components/empty-state';

type SessionLike = { user?: { name?: string | null; email?: string | null } | null } | null;

export function ContactsScreen({ session }: { session: SessionLike }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ContactFilters>(defaultFilters);
  const [sort, setSort] = useState<SortKey>('created_desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /** Used by the "Try again" button after a failed load. */
  const reload = useCallback(async () => {
    setContacts(null);
    setLoadError(null);
    try {
      setContacts(await listContacts());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your contacts.');
    }
  }, []);

  // Initial fetch. The `cancelled` flag stops a late response from writing state after the
  // component has gone away -- which happens in practice when a user signs out mid-request.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const rows = await listContacts();
        if (!cancelled) setContacts(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load your contacts.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (contacts ? filterAndSort(contacts, filters, sort) : []),
    [contacts, filters, sort],
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setFormOpen(true);
  }

  // Errors are re-thrown so the dialog can show them inline and stay open.
  async function handleSubmit(input: ContactInput) {
    if (editing) {
      const updated = await updateContact(editing.id, input);
      setContacts((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
      toast.success('Changes saved', { description: `${updated.name} has been updated.` });
    } else {
      const created = await createContact(input);
      setContacts((prev) => [created, ...(prev ?? [])]);
      toast.success('Contact added', { description: `${created.name} is now in your tracker.` });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContact(deleteTarget.id);
      setContacts((prev) => (prev ?? []).filter((c) => c.id !== deleteTarget.id));
      toast.success('Contact deleted', { description: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
    } catch (err) {
      toast.error('Could not delete contact', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await auth.signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const loading = contacts === null && loadError === null;
  const displayName = session?.user?.name || session?.user?.email || 'your account';

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Users className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">Networking Tracker</h1>
              <p className="text-muted-foreground truncate text-xs">{displayName}</p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-4" aria-hidden />
            )}
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your contacts</h2>
            <p className="text-muted-foreground text-sm">
              {contacts === null
                ? 'Loading…'
                : `${contacts.length} ${contacts.length === 1 ? 'person' : 'people'}` +
                  (hasActiveFilters(filters) ? ` · ${visible.length} shown` : '')}
            </p>
          </div>

          <Button onClick={openAdd}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Add contact</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        <div className="mb-4">
          <ContactsToolbar
            filters={filters}
            sort={sort}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            onClear={() => setFilters(defaultFilters)}
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid gap-2" role="status" aria-live="polite">
            <span className="sr-only">Loading your contacts…</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 flex flex-col items-start gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
          >
            <AlertCircle className="text-destructive size-5 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="text-destructive text-sm font-medium">Could not load your contacts</p>
              <p className="text-destructive/90 text-sm">{loadError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-4" aria-hidden />
              Try again
            </Button>
          </div>
        )}

        {/* Empty states */}
        {contacts !== null && visible.length === 0 && (
          <EmptyState
            filtered={hasActiveFilters(filters)}
            onAdd={openAdd}
            onClearFilters={() => setFilters(defaultFilters)}
          />
        )}

        {/* The list: cards on phones, table from md up. */}
        {visible.length > 0 && (
          <>
            <div className="md:hidden">
              <ContactCardList contacts={visible} onEdit={openEdit} onDelete={setDeleteTarget} />
            </div>
            <div className="hidden md:block">
              <ContactTable contacts={visible} onEdit={openEdit} onDelete={setDeleteTarget} />
            </div>
          </>
        )}
      </main>

      <ContactFormDialog
        open={formOpen}
        contact={editing}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be permanently removed from your tracker. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open until the request resolves.
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
