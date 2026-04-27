-- Moose Dashboard — V1.5 schema additions
-- Snapshot history (daily), append-only status transitions, blocked episodes, chat audit log.

create table if not exists planning_items_daily (
  snapshot_date date not null,
  item_id int not null,
  data jsonb not null,
  primary key (snapshot_date, item_id)
);
create index if not exists planning_items_daily_item_idx
  on planning_items_daily (item_id, snapshot_date desc);

create table if not exists status_changes (
  id bigserial primary key,
  item_id int not null,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null,
  detected_by_sync_id bigint references sync_log(id) on delete set null
);
create index if not exists status_changes_item_idx on status_changes (item_id, changed_at);
create index if not exists status_changes_to_idx   on status_changes (to_status, changed_at);

create table if not exists blocked_episodes (
  id bigserial primary key,
  item_id int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  blocker_text text,
  resolved_to_status text
);
create unique index if not exists blocked_episodes_open_unique
  on blocked_episodes (item_id) where ended_at is null;
create index if not exists blocked_episodes_item_idx on blocked_episodes (item_id);

create table if not exists chat_log (
  id bigserial primary key,
  user_email text not null,
  message_index int not null,
  role text not null,
  content text,
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_log_user_idx on chat_log (user_email, created_at);

alter table planning_items_daily enable row level security;
alter table status_changes       enable row level security;
alter table blocked_episodes     enable row level security;
alter table chat_log             enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'planning_items_daily_select_auth') then
    create policy planning_items_daily_select_auth on planning_items_daily for select to authenticated using (true);
    create policy status_changes_select_auth       on status_changes       for select to authenticated using (true);
    create policy blocked_episodes_select_auth     on blocked_episodes     for select to authenticated using (true);
    create policy chat_log_select_auth             on chat_log             for select to authenticated using (true);
  end if;
end $$;
