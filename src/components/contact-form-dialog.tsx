'use client';

/**
 * Add / edit dialog.
 *
 * Validation happens twice on purpose. `validateContact` runs here so a mistake is caught
 * instantly next to the field that caused it. The same rules then run again as CHECK
 * constraints inside Postgres, and if the database refuses a write for any reason the
 * message it gives is surfaced verbatim in the banner rather than swallowed.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LIMITS,
  PRIORITIES,
  emptyContact,
  validateContact,
  type Contact,
  type ContactInput,
  type Priority,
} from '@/lib/contact-schema';
import { cn } from '@/lib/utils';

type FormValues = typeof emptyContact;
type FieldErrors = Partial<Record<keyof ContactInput, string>>;

/** Database nulls become empty strings for controlled inputs. */
function toFormValues(contact: Contact | null): FormValues {
  if (!contact) return emptyContact;
  return {
    name: contact.name,
    company: contact.company ?? '',
    role: contact.role ?? '',
    met_at: contact.met_at ?? '',
    notes: contact.notes ?? '',
    priority: contact.priority,
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

export function ContactFormDialog({
  open,
  contact,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ContactInput) => Promise<void>;
}) {
  const isEdit = contact !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details for this person.'
              : 'Add someone you want to stay connected with. Only you can see this.'}
          </DialogDescription>
        </DialogHeader>

        {/*
          The form lives in its own component so its state is created fresh each time the
          dialog opens. Radix unmounts dialog content while closed, so opening the dialog
          for a different contact cannot show the previous person's half-edited details --
          no reset effect required.
        */}
        <ContactForm
          contact={contact}
          isEdit={isEdit}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (input) => {
            await onSubmit(input);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({
  contact,
  isEdit,
  onCancel,
  onSubmit,
}: {
  contact: Contact | null;
  isEdit: boolean;
  onCancel: () => void;
  onSubmit: (input: ContactInput) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(contact));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear a field's error as soon as the user starts fixing it.
    setErrors((e) => (e[key as keyof ContactInput] ? { ...e, [key]: undefined } : e));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = validateContact(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setPending(true);
    try {
      await onSubmit(result.value);
    } catch (err) {
      // Anything the database refused, including rules the client did not check.
      setFormError(err instanceof Error ? err.message : 'Could not save this contact.');
      setPending(false);
    }
  }

  /** Wires a field to its error message for assistive technology. */
  const a11y = (key: keyof ContactInput) => ({
    'aria-invalid': errors[key] ? (true as const) : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="contact-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="contact-name"
          value={values.name}
          maxLength={LIMITS.name}
          placeholder="Priya Raman"
          onChange={(e) => set('name', e.target.value)}
          className={cn(errors.name && 'border-destructive')}
          {...a11y('name')}
        />
        <FieldError id="name-error" message={errors.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact-company">Company</Label>
          <Input
            id="contact-company"
            value={values.company}
            maxLength={LIMITS.company}
            placeholder="Stripe"
            onChange={(e) => set('company', e.target.value)}
            {...a11y('company')}
          />
          <FieldError id="company-error" message={errors.company} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contact-role">Role</Label>
          <Input
            id="contact-role"
            value={values.role}
            maxLength={LIMITS.role}
            placeholder="Staff Engineer"
            onChange={(e) => set('role', e.target.value)}
            {...a11y('role')}
          />
          <FieldError id="role-error" message={errors.role} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-met-at">Where you met</Label>
        <Input
          id="contact-met-at"
          value={values.met_at}
          maxLength={LIMITS.metAt}
          placeholder="Berkeley career fair, Feb 2026"
          onChange={(e) => set('met_at', e.target.value)}
          {...a11y('met_at')}
        />
        <FieldError id="met_at-error" message={errors.met_at} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-priority">
          Priority <span className="text-destructive">*</span>
        </Label>
        <Select value={values.priority} onValueChange={(v) => set('priority', v as Priority)}>
          <SelectTrigger id="contact-priority" className="w-full" {...a11y('priority')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="priority-error" message={errors.priority} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-notes">Notes</Label>
        <Textarea
          id="contact-notes"
          rows={3}
          value={values.notes}
          maxLength={LIMITS.notes}
          placeholder="What you talked about, what to follow up on…"
          onChange={(e) => set('notes', e.target.value)}
          {...a11y('notes')}
        />
        <FieldError id="notes-error" message={errors.notes} />
      </div>

      {formError && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {formError}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {isEdit ? 'Save changes' : 'Add contact'}
        </Button>
      </DialogFooter>
    </form>
  );
}
