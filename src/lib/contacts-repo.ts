'use client';

/**
 * Data access for contacts.
 *
 * Every function here is a thin, typed wrapper over the Neon Data API. Deliberately free of
 * React so the UI can stay about rendering and this can stay about requests.
 *
 * Note what is absent: no function ever sends, or filters by, user_id. Ownership is not the
 * client's business. On insert the column defaults to auth.user_id() in Postgres, and on
 * read the RLS SELECT policy narrows the result set before it leaves the database. Adding a
 * `.eq('user_id', me)` here would be redundant at best, and misleading at worst -- it would
 * suggest the client is what keeps users apart.
 */
import { neon } from './neon';
import type { Contact, ContactInput } from './contact-schema';

const TABLE = 'contacts';

/** Columns a user may edit. Mirrors the column-level UPDATE grant in the migration. */
const EDITABLE = ['name', 'company', 'role', 'met_at', 'notes', 'priority'] as const;

/** Shape of the error object the Data API (PostgREST) returns. */
type DataApiError = { message?: string; code?: string; details?: string; hint?: string };

/**
 * Turns a database or transport error into something worth showing a person.
 *
 * The constraint names are the ones defined in db/migrations/0001_contacts.sql. Matching on
 * them means the UI reports the *real* reason a write was refused, rather than a generic
 * "something went wrong", even when the rejection came from a rule the client never checked.
 */
export function mapDbError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';

  const err = error as DataApiError;
  const message = err.message ?? String(error);

  if (message.includes('contacts_name_not_blank')) return 'Name is required.';
  if (message.includes('contacts_name_max_len')) return 'Name is too long (120 characters max).';
  if (message.includes('contacts_priority_valid')) return 'Priority must be high, medium, or low.';
  if (message.includes('contacts_company_max_len')) return 'Company is too long (120 characters max).';
  if (message.includes('contacts_role_max_len')) return 'Role is too long (120 characters max).';
  if (message.includes('contacts_met_at_max_len')) return 'Where you met is too long (200 characters max).';
  if (message.includes('contacts_notes_max_len')) return 'Notes are too long (2000 characters max).';

  // 42501 = insufficient privilege. In this app that means a write was blocked by RLS or by
  // the column-level grant -- i.e. an attempt to touch a row, or a column, that isn't yours.
  if (err.code === '42501') return "You don't have permission to change that contact.";

  // PostgREST auth failures: the JWT is missing, malformed, or expired.
  if (err.code === 'PGRST301' || message.includes('JWT') || message.includes('authentication')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}

/** Thrown by the functions below so callers can catch one thing and show error.message. */
class ContactsError extends Error {
  constructor(cause: unknown) {
    super(mapDbError(cause));
    this.name = 'ContactsError';
  }
}

/** All of the signed-in user's contacts. RLS guarantees "their own" without a filter here. */
export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await neon.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw new ContactsError(error);
  return (data ?? []) as Contact[];
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const { data, error } = await neon.from(TABLE).insert(input).select().single();
  if (error) throw new ContactsError(error);
  return data as Contact;
}

export async function updateContact(id: string, input: ContactInput): Promise<Contact> {
  // Send only the editable columns. Anything else would be refused by the column grant
  // anyway; not sending it keeps the request honest about what it intends to change.
  const patch = Object.fromEntries(EDITABLE.map((k) => [k, input[k]]));

  const { data, error } = await neon.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw new ContactsError(error);
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await neon.from(TABLE).delete().eq('id', id);
  if (error) throw new ContactsError(error);
}
