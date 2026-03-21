-- Supabase Schema for Movie AI SaaS
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Workspaces
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  account_type text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspace Members
create table workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  status text not null default '対応中',
  overview text,
  client_id uuid references clients(id) on delete set null,
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  start_date date,
  end_date date,
  assignee_user_id uuid,
  assignee_name text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Milestones
create table milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  status text not null default 'planned',
  start_date date,
  end_date date,
  due_date date,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Budgets
create table budgets (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade unique,
  currency text not null default 'JPY',
  total_budget int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Budget Categories
create table budget_categories (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid not null references budgets(id) on delete cascade,
  name text not null,
  budget_limit int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Budget Items
create table budget_items (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid not null references budgets(id) on delete cascade,
  category text not null,
  title text not null,
  amount int not null,
  quantity int not null default 1,
  vendor text,
  incurred_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Storyboards
create table storyboards (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Storyboard Versions
create table storyboard_versions (
  id uuid primary key default uuid_generate_v4(),
  storyboard_id uuid not null references storyboards(id) on delete cascade,
  version_number int not null,
  source text not null default 'draft',
  created_at timestamptz not null default now()
);

-- Drafts
create table drafts (
  id uuid primary key default uuid_generate_v4(),
  storyboard_id uuid not null references storyboards(id) on delete cascade,
  generation_config jsonb not null default '{}',
  base_version_id uuid references storyboard_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Draft Scenes
create table draft_scenes (
  id uuid primary key default uuid_generate_v4(),
  draft_id uuid not null references drafts(id) on delete cascade,
  scene_order int not null,
  dialogue text,
  description text,
  image_prompt text,
  image_url text,
  image_asset_id uuid,
  regen_config_override jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Version Scenes (snapshot of scenes at publish time)
create table version_scenes (
  id uuid primary key default uuid_generate_v4(),
  version_id uuid not null references storyboard_versions(id) on delete cascade,
  scene_order int not null,
  dialogue text,
  description text,
  image_asset_id uuid,
  created_at timestamptz not null default now()
);

-- Assets
create table assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes int,
  width int,
  height int,
  created_at timestamptz not null default now()
);

-- Project Assets (junction table)
create table project_assets (
  project_id uuid not null references projects(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  primary key (project_id, asset_id)
);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null,
  title text,
  url text,
  memo text,
  asset_id uuid references assets(id),
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs (for async operations)
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  progress int not null default 0,
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invite Tokens
create table invite_tokens (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  max_uses int,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Add foreign key for storyboard published version
alter table storyboards
  add constraint fk_published_version
  foreign key (current_published_version_id)
  references storyboard_versions(id)
  on delete set null;

-- Row Level Security (basic - allow all for now, tighten later)
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table milestones enable row level security;
alter table budgets enable row level security;
alter table budget_categories enable row level security;
alter table budget_items enable row level security;
alter table storyboards enable row level security;
alter table storyboard_versions enable row level security;
alter table drafts enable row level security;
alter table draft_scenes enable row level security;
alter table version_scenes enable row level security;
alter table assets enable row level security;
alter table project_assets enable row level security;
alter table documents enable row level security;
alter table jobs enable row level security;
alter table invite_tokens enable row level security;

-- Permissive policies for service role (API routes use service role key)
-- These allow the service role to do everything
create policy "service_role_all" on workspaces for all using (true) with check (true);
create policy "service_role_all" on workspace_members for all using (true) with check (true);
create policy "service_role_all" on clients for all using (true) with check (true);
create policy "service_role_all" on projects for all using (true) with check (true);
create policy "service_role_all" on tasks for all using (true) with check (true);
create policy "service_role_all" on milestones for all using (true) with check (true);
create policy "service_role_all" on budgets for all using (true) with check (true);
create policy "service_role_all" on budget_categories for all using (true) with check (true);
create policy "service_role_all" on budget_items for all using (true) with check (true);
create policy "service_role_all" on storyboards for all using (true) with check (true);
create policy "service_role_all" on storyboard_versions for all using (true) with check (true);
create policy "service_role_all" on drafts for all using (true) with check (true);
create policy "service_role_all" on draft_scenes for all using (true) with check (true);
create policy "service_role_all" on version_scenes for all using (true) with check (true);
create policy "service_role_all" on assets for all using (true) with check (true);
create policy "service_role_all" on project_assets for all using (true) with check (true);
create policy "service_role_all" on documents for all using (true) with check (true);
create policy "service_role_all" on jobs for all using (true) with check (true);
create policy "service_role_all" on invite_tokens for all using (true) with check (true);

-- Insert default workspace
insert into workspaces (name, slug, account_type) values ('デモワークスペース', 'demo', 'free');
