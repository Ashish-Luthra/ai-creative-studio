-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

create table if not exists emailers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled',
  subject     text,
  blocks      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger emailers_updated_at
  before update on emailers
  for each row execute procedure set_updated_at();

-- Index for listing by most recent first
create index if not exists emailers_updated_at_idx on emailers (updated_at desc);
