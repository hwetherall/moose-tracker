-- Moose Dashboard — V1 schema
-- Text-typed enums (not Postgres enums) so novel sheet values are accepted gracefully.

create table if not exists people (
  email text primary key,
  display_name text not null,
  aliases text[] not null default '{}'
);

create table if not exists name_aliases (
  alias text primary key,
  canonical_email text references people(email) on delete set null
);

create table if not exists planning_items (
  id int primary key,
  sheet_row int not null,
  name text not null,
  release text,
  seq text,
  status text not null,
  status_raw text not null,
  type text,
  category text,
  subsystem text,
  parent_epic text,
  parent_epic_id int references planning_items(id) on delete set null,
  links jsonb not null default '[]'::jsonb,
  rank_score int,
  priority int,
  impact int,
  difficulty int,
  experiments_refs jsonb not null default '[]'::jsonb,
  r_emails text[] not null default '{}',
  a_emails text[] not null default '{}',
  d_emails text[] not null default '{}',
  r_raw text,
  a_raw text,
  d_raw text,
  due_date date,
  comments text,
  dod text,
  blocker text,
  blocked_since date,
  is_ready boolean,
  row_hash text not null,
  synced_at timestamptz not null default now()
);
create index if not exists planning_items_status_idx on planning_items (status);
create index if not exists planning_items_release_idx on planning_items (release);
create index if not exists planning_items_rank_idx on planning_items (rank_score);
create index if not exists planning_items_r_gin on planning_items using gin (r_emails);
create index if not exists planning_items_a_gin on planning_items using gin (a_emails);
create index if not exists planning_items_d_gin on planning_items using gin (d_emails);

create table if not exists experiments (
  key text primary key,
  sheet_row int not null,
  problem text,
  problem_planning_id int references planning_items(id) on delete set null,
  experiment text,
  question text,
  scope text,
  details text,
  status text not null,
  status_raw text,
  notes text,
  synced_at timestamptz not null default now()
);
create index if not exists experiments_status_idx on experiments (status);
create index if not exists experiments_planning_idx on experiments (problem_planning_id);

create table if not exists releases (
  name text primary key,
  planned_staging date,
  revised_staging date,
  actual_staging date,
  planned_prod date,
  revised_prod date,
  actual_prod date
);

create table if not exists sync_log (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,              -- 'ok' | 'error' | 'partial' | 'running'
  planning_rows int,
  experiments_rows int,
  normalization_warnings jsonb,
  error_message text
);
create index if not exists sync_log_started_idx on sync_log (started_at desc);

-- ----- RLS -----
alter table people           enable row level security;
alter table name_aliases     enable row level security;
alter table planning_items   enable row level security;
alter table experiments      enable row level security;
alter table releases         enable row level security;
alter table sync_log         enable row level security;

-- Authenticated users: read-all. No insert/update/delete from the client.
-- The sync job uses the service role, which bypasses RLS.
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'people_select_auth') then
    create policy people_select_auth         on people         for select to authenticated using (true);
    create policy name_aliases_select_auth   on name_aliases   for select to authenticated using (true);
    create policy planning_items_select_auth on planning_items for select to authenticated using (true);
    create policy experiments_select_auth    on experiments    for select to authenticated using (true);
    create policy releases_select_auth       on releases       for select to authenticated using (true);
    create policy sync_log_select_auth       on sync_log       for select to authenticated using (true);
  end if;
end $$;
