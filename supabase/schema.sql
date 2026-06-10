-- ClearLedger AI Milestone 2 schema
-- Run this complete file in the Supabase SQL editor for the project that backs the app.
-- It uses only the anon key from the app; ownership isolation is enforced by RLS and auth.uid().

create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references auth.users not null,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations not null,
  upload_batch_id uuid not null,
  created_at timestamptz default now(),
  raw_csv_row jsonb not null,
  risk_score int not null,
  risk_level text not null,
  flags text[],
  score_breakdown jsonb,
  reviewed boolean not null default false,
  reviewer_note text
);

create index if not exists organizations_owner_user_id_idx on organizations(owner_user_id);
create index if not exists transactions_org_created_at_idx on transactions(org_id, created_at desc);
create index if not exists transactions_upload_batch_id_idx on transactions(upload_batch_id);

alter table organizations enable row level security;
alter table transactions enable row level security;

create policy "Users can read their own organization" on organizations
  for select
  using (owner_user_id = auth.uid());

create policy "Users can create their own organization" on organizations
  for insert
  with check (owner_user_id = auth.uid());

create policy "Users can update their own organization" on organizations
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Users can read organization transactions" on transactions
  for select
  using (
    exists (
      select 1
      from organizations
      where organizations.id = transactions.org_id
        and organizations.owner_user_id = auth.uid()
    )
  );

create policy "Users can insert organization transactions" on transactions
  for insert
  with check (
    exists (
      select 1
      from organizations
      where organizations.id = transactions.org_id
        and organizations.owner_user_id = auth.uid()
    )
  );

create policy "Users can update organization transactions" on transactions
  for update
  using (
    exists (
      select 1
      from organizations
      where organizations.id = transactions.org_id
        and organizations.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from organizations
      where organizations.id = transactions.org_id
        and organizations.owner_user_id = auth.uid()
    )
  );

create or replace function public.create_organization_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_org_name text;
begin
  requested_org_name := nullif(trim(new.raw_user_meta_data ->> 'organization_name'), '');

  insert into public.organizations (name, owner_user_id)
  values (
    coalesce(requested_org_name, split_part(new.email, '@', 1) || ' Workspace'),
    new.id
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_organization on auth.users;
create trigger on_auth_user_created_create_organization
  after insert on auth.users
  for each row execute function public.create_organization_for_new_user();
