-- Moose Dashboard — V2 schema additions
-- The expert agent: enrichment, inspector, brief, proposal queue, feedback.
-- All seven tables plus a new column on planning_items for the AI Brief sheet round-trip.

-- ----- 1. Enrichment store -----
create table if not exists item_enrichment (
  item_id int primary key references planning_items(id) on delete cascade,
  brief text,
  brief_approved_by text,
  brief_approved_at timestamptz,
  brief_synced_to_sheet boolean not null default false,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  acceptance_criteria_approved_at timestamptz,
  effort_estimate text,
  effort_approved_at timestamptz,
  risk_level text,
  risk_rationale text,
  risk_approved_at timestamptz,
  related_item_ids int[] not null default '{}',
  related_approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint item_enrichment_effort_enum
    check (effort_estimate is null or effort_estimate in ('XS','S','M','L','XL')),
  constraint item_enrichment_risk_enum
    check (risk_level is null or risk_level in ('low','medium','high'))
);
create index if not exists item_enrichment_unsynced_idx
  on item_enrichment (brief_synced_to_sheet) where brief_synced_to_sheet = false;

-- ----- 2. Inspector findings -----
create table if not exists agent_findings (
  id bigserial primary key,
  check_id text not null,
  item_id int not null references planning_items(id) on delete cascade,
  severity text not null,
  title text not null,
  detail text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- One open finding per (check, item). Re-firing after resolution opens a new row.
create unique index if not exists agent_findings_open_unique
  on agent_findings (check_id, item_id) where resolved_at is null;
create index if not exists agent_findings_item_open_idx
  on agent_findings (item_id) where resolved_at is null;
create index if not exists agent_findings_last_seen_idx
  on agent_findings (last_seen_at desc);

-- ----- 3. Proposal queue -----
create table if not exists agent_proposals (
  id bigserial primary key,
  proposal_type text not null,           -- 'enrichment' | 'inspector_fix'
  item_id int not null references planning_items(id) on delete cascade,
  field text not null,
  current_value jsonb,
  proposed_value jsonb not null,
  rationale text,
  source text not null,                  -- 'enrichment' | 'inspector:<check_id>' | etc.
  generated_at timestamptz not null default now(),
  generated_by_model text,
  status text not null default 'pending',
  resolved_at timestamptz,
  resolved_by text,
  resolved_value jsonb
);
-- "Only one pending proposal per (item, field)." Spec §5.1 expressed this as
-- `unique (item_id, field, status) deferrable initially deferred`, which doesn't
-- actually enforce that — including status in the key allows multiple pending
-- rows. A partial unique index gives the real invariant.
create unique index if not exists agent_proposals_pending_unique
  on agent_proposals (item_id, field) where status = 'pending';
create index if not exists agent_proposals_status_idx
  on agent_proposals (status, generated_at desc);
create index if not exists agent_proposals_item_idx
  on agent_proposals (item_id, field);

-- ----- 4. Brief log -----
create table if not exists agent_brief_log (
  id bigserial primary key,
  brief_date date not null unique,
  body_md text not null,
  body_html text not null,
  model_used text not null,
  input_token_count int,
  output_token_count int,
  signals_snapshot jsonb,
  findings_snapshot jsonb,
  delivery_metadata jsonb not null default '{}'::jsonb,
  error text,                            -- §11: cron fail logs an empty row + error
  note text,                             -- §11: divergence/awareness notes
  generated_at timestamptz not null default now()
);

-- ----- 5. Feedback -----
create table if not exists agent_feedback (
  id bigserial primary key,
  user_email text not null,
  target_type text not null,             -- 'finding' | 'proposal' | 'brief'
  target_id text not null,
  reaction text not null,                -- 'thumbs_up' | 'thumbs_down' | 'rejected'
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists agent_feedback_user_idx
  on agent_feedback (user_email, target_type, created_at desc);

-- ----- 6. Per-user preferences -----
create table if not exists agent_preferences (
  user_email text primary key,
  suppressed_check_ids text[] not null default '{}',
  suppressed_signal_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ----- 7. Subscriptions (V3 foundation only — not wired in V2) -----
create table if not exists agent_subscriptions (
  user_email text primary key,
  brief_email_subscribed boolean not null default false,
  brief_slack_subscribed boolean not null default false,
  slack_user_id text,
  created_at timestamptz not null default now()
);

-- ----- 8. AI Brief round-trip on planning_items -----
alter table planning_items
  add column if not exists ai_brief_from_sheet text;

-- ----- RLS -----
alter table item_enrichment      enable row level security;
alter table agent_findings       enable row level security;
alter table agent_proposals      enable row level security;
alter table agent_brief_log      enable row level security;
alter table agent_feedback       enable row level security;
alter table agent_preferences    enable row level security;
alter table agent_subscriptions  enable row level security;

-- Authenticated readers: select-all, no client writes. Service role bypasses RLS
-- and is the only thing that mutates these tables (matches the V1/V1.5 pattern).
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'item_enrichment_select_auth') then
    create policy item_enrichment_select_auth      on item_enrichment      for select to authenticated using (true);
    create policy agent_findings_select_auth       on agent_findings       for select to authenticated using (true);
    create policy agent_proposals_select_auth      on agent_proposals      for select to authenticated using (true);
    create policy agent_brief_log_select_auth      on agent_brief_log      for select to authenticated using (true);
    create policy agent_feedback_select_auth       on agent_feedback       for select to authenticated using (true);
    create policy agent_preferences_select_auth    on agent_preferences    for select to authenticated using (true);
    create policy agent_subscriptions_select_auth  on agent_subscriptions  for select to authenticated using (true);
  end if;
end $$;
