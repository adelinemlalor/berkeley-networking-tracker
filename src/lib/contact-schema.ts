/**
 * Shape and validation rules for a contact.
 *
 * IMPORTANT: this module is a *convenience*, not a security control. It exists so the user
 * gets an instant, friendly error instead of a round trip. The rules that actually protect
 * the data are the CHECK constraints in db/migrations/0001_contacts.sql, which apply to every
 * write regardless of where it came from -- including a curl straight at the Data API that
 * never loads this file.
 *
 * The limits below are kept deliberately identical to those constraints. If you change one,
 * change both: the SQL is the source of truth and this is the mirror.
 */
import { z } from 'zod';

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Mirrors the CHECK constraint character limits in 0001_contacts.sql. */
export const LIMITS = { name: 120, company: 120, role: 120, metAt: 200, notes: 2000 } as const;

/** Trims, then converts an empty optional field to null so the DB stores NULL, not "". */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null);

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(LIMITS.name, `Name must be ${LIMITS.name} characters or fewer.`),
  company: optionalText(LIMITS.company, 'Company'),
  role: optionalText(LIMITS.role, 'Role'),
  met_at: optionalText(LIMITS.metAt, 'Where you met'),
  notes: optionalText(LIMITS.notes, 'Notes'),
  priority: z.enum(PRIORITIES, { message: 'Priority must be high, medium, or low.' }),
});

/** A validated contact, ready to send to the Data API. */
export type ContactInput = z.infer<typeof contactSchema>;

/** A contact as it comes back from the database. */
export type Contact = ContactInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ValidationResult =
  | { ok: true; value: ContactInput }
  | { ok: false; errors: Partial<Record<keyof ContactInput, string>> };

/**
 * Validates raw form input.
 *
 * Returns field-keyed messages rather than throwing, so the form can render each error
 * next to the input it belongs to.
 */
export function validateContact(raw: unknown): ValidationResult {
  const parsed = contactSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof ContactInput | undefined;
    // Keep the first error per field: showing three messages under one input is noise.
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Blank form values, used when opening the "add contact" dialog. */
export const emptyContact = {
  name: '',
  company: '',
  role: '',
  met_at: '',
  notes: '',
  priority: 'medium' as Priority,
};
