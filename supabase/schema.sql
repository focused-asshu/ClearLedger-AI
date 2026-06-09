-- ClearLedger AI Milestone 1 schema draft
-- Run in Supabase SQL editor after enabling authentication for your project.

create type risk_level as enum ('Low', 'Medium', 'High', 'Critical');
create type transaction_direction as enum ('inbound', 'outbound');
create type transaction_status as enum ('pending', 'cleared', 'flagged', 'reported');

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  full_name text,
  role text not null default 'analyst',
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id text primary key,
  organization_id uuid references organizations(id) on delete cascade,
  transaction_date date not null,
  customer_name text not null,
  customer_country text not null,
  wallet_address text not null,
  counterparty_name text not null,
  counterparty_country text not null,
  asset text not null,
  amount numeric not null,
  fiat_value_usd numeric not null,
  direction transaction_direction not null,
  status transaction_status not null default 'pending',
  risk_score integer not null default 0,
  risk_level risk_level not null default 'Low',
  risk_factors jsonb not null default '[]'::jsonb,
  sanctions_hits jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists compliance_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  generated_by uuid references profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  total_transactions integer not null,
  total_value_usd numeric not null,
  risk_summary jsonb not null,
  flagged_transaction_ids text[] not null default '{}',
  disclaimer text not null,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table transactions enable row level security;
alter table compliance_reports enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can view organization transactions" on transactions
  for select using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create policy "Users can manage organization transactions" on transactions
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create policy "Users can view organization reports" on compliance_reports
  for select using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
