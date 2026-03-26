-- Migration: Add integrations table and fix invite_tokens schema
-- Run this in Supabase SQL Editor

-- 1. Create integrations table (Slack, LINE, etc.)
create table if not exists integrations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  config jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, type)
);

alter table integrations enable row level security;
create policy "service_role_all" on integrations for all using (true) with check (true);

-- 2. Add missing columns to invite_tokens (if not exists)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='invite_tokens' and column_name='invited_by') then
    alter table invite_tokens add column invited_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='invite_tokens' and column_name='used_at') then
    alter table invite_tokens add column used_at timestamptz;
  end if;
end $$;

-- 3. Create budget-related tables if they don't exist
create table if not exists budget_categories (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  budget_amount numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists budget_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references budget_categories(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  description text not null,
  amount numeric not null default 0,
  date date,
  vendor text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Enable RLS on new tables (if not already)
do $$
begin
  alter table budget_categories enable row level security;
  alter table budget_items enable row level security;
exception when others then null;
end $$;

-- Add policies if they don't exist
do $$
begin
  create policy "service_role_all" on budget_categories for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "service_role_all" on budget_items for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 4. Create project_documents table if it doesn't exist
create table if not exists project_documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  content text,
  section text not null default 'general',
  file_url text,
  file_type text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table project_documents enable row level security;
  create policy "service_role_all" on project_documents for all using (true) with check (true);
exception when others then null;
end $$;
