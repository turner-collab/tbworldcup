-- Run this in the Supabase dashboard:  SQL Editor  ->  New query  ->  paste  ->  Run
-- Creates the single table the app uses. Each draft group is one row of JSON.

create table if not exists public.groups (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);

-- The app talks to the database only through server-side API routes using the
-- SECRET key, so row-level security can stay on with no public policies.
alter table public.groups enable row level security;

-- (No policies added on purpose: the secret key bypasses RLS server-side,
--  and no client ever touches the table directly.)
