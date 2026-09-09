-- 0001_contacts.sql
-- Secure Networking Tracker: contacts table, trusted validation, and RLS ownership policies.
--
-- This file is the single source of truth for the schema. It is idempotent: running it twice
-- is safe, so it doubles as the "recreate the database from scratch" script.
--
-- Design note: the browser talks to this database through the public Neon Data API using a JWT.
-- Nothing in the client bundle is trusted. Every rule that actually matters -- who may read a
-- row, who may change it, and what counts as a valid row -- is enforced here, in Postgres.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  id         uuid        primary key default gen_random_uuid(),

  -- Ownership. Defaults to the caller's identity, taken from the verified JWT rather than
  -- from anything the client sends. A client that omits user_id gets its own id; a client
  -- that forges one is stopped by the RLS WITH CHECK clauses below.
  user_id    text        not null default auth.user_id(),

  name       text        not null,
  company    text,
  role       text,
  met_at     text,                    -- where they met, e.g. "Sutardja Dai Hall, CS 194 mixer"
  notes      text,
  priority   text        not null default 'medium',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Trusted validation. These are the constraints the assignment requires to live in
  -- server/database code: a hostile client posting straight to the Data API hits them too.
  constraint contacts_name_not_blank check (length(btrim(name)) > 0),
  constraint contacts_name_max_len   check (length(name) <= 120),
  constraint contacts_priority_valid check (priority in ('high', 'medium', 'low')),
  constraint contacts_company_max_len check (company is null or length(company) <= 120),
  constraint contacts_role_max_len    check (role    is null or length(role)    <= 120),
  constraint contacts_met_at_max_len  check (met_at  is null or length(met_at)  <= 200),
  constraint contacts_notes_max_len   check (notes   is null or length(notes)   <= 2000)
);

-- Every query is "my contacts, newest first", so index exactly that.
create index if not exists contacts_user_created_idx
  on public.contacts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------------
-- Kept server-side so the timestamp cannot be back-dated by a client.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.contacts enable row level security;

-- Belt and braces: also apply RLS to the table owner, so a future owner-role connection
-- cannot quietly bypass the policies.
alter table public.contacts force row level security;

drop policy if exists contacts_select_own on public.contacts;
drop policy if exists contacts_insert_own on public.contacts;
drop policy if exists contacts_update_own on public.contacts;
drop policy if exists contacts_delete_own on public.contacts;

-- SELECT: you can only ever see your own rows.
create policy contacts_select_own on public.contacts
  as permissive for select to authenticated
  using ((select auth.user_id()) = user_id);

-- INSERT: you can only create rows owned by you. Blocks "insert a row on someone else's behalf".
create policy contacts_insert_own on public.contacts
  as permissive for insert to authenticated
  with check ((select auth.user_id()) = user_id);

-- UPDATE: USING picks which rows you may target (yours);
-- WITH CHECK validates the row *after* the edit, which is what stops a user from
-- rewriting user_id to hand their row to -- or steal it for -- someone else.
create policy contacts_update_own on public.contacts
  as permissive for update to authenticated
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);

-- DELETE: you can only delete your own rows.
create policy contacts_delete_own on public.contacts
  as permissive for delete to authenticated
  using ((select auth.user_id()) = user_id);

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------
-- RLS filters rows; grants decide who may attempt an operation at all. Both are needed:
-- RLS on a table with no grant is unreachable, and a grant with no RLS is wide open.

-- Signed-out callers get nothing on this table. There is no public contact data.
revoke all on public.contacts from anonymous;

grant select, insert, delete on public.contacts to authenticated;

-- Column-level UPDATE grant: defense in depth. The RLS WITH CHECK above is what the
-- assignment requires and is sufficient on its own, but withholding UPDATE on id, user_id,
-- and the timestamps means an attempt to rewrite ownership is refused by the privilege
-- system before RLS is even consulted.
grant update (name, company, role, met_at, notes, priority)
  on public.contacts to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 5. Refresh the Data API schema cache
-- ---------------------------------------------------------------------------
-- The Neon Data API (PostgREST) caches the schema separately from Postgres. Without this,
-- the table exists and psql can see it, but every HTTP request still fails with
-- "relation does not exist" until the cache expires. Must run outside the transaction.
notify pgrst, 'reload schema';
