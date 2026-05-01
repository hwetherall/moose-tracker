-- Moose Dashboard — V2.5 schema additions
-- Voice enrichment PoC: a single new table for sessions, plus one column on
-- agent_proposals so the inbox can render a "via voice" badge and link to the
-- transcript when reviewing a proposal.

-- ----- 1. Voice enrichment sessions -----
create table if not exists voice_enrichment_sessions (
  id bigserial primary key,
  item_id int not null references planning_items(id) on delete cascade,
  user_email text not null,
  transcript text not null,
  transcript_model text not null,
  extraction_model text,
  extracted_brief text,
  extracted_ac jsonb,
  duration_seconds int,
  status text not null default 'extracted',
  failure_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint voice_enrichment_sessions_status_enum
    check (status in ('extracted','submitted','discarded','failed'))
);

create index if not exists voice_enrichment_sessions_item_idx
  on voice_enrichment_sessions (item_id, created_at desc);
create index if not exists voice_enrichment_sessions_expires_idx
  on voice_enrichment_sessions (expires_at);
create index if not exists voice_enrichment_sessions_status_idx
  on voice_enrichment_sessions (status, created_at desc);

-- ----- 2. Link agent_proposals → voice_enrichment_sessions -----
-- Voice submission writes two rows (brief + acceptance_criteria); both carry
-- source_session_id so /inbox can render the Mic badge and "View transcript"
-- chip. ON DELETE SET NULL means the daily retention cron can purge sessions
-- without deleting the proposals (the human-confirmed values live on the
-- proposal row's proposed_value, which we want to keep indefinitely).
alter table agent_proposals
  add column if not exists source_session_id bigint
    references voice_enrichment_sessions(id) on delete set null;

create index if not exists agent_proposals_source_session_idx
  on agent_proposals (source_session_id) where source_session_id is not null;

-- ----- 3. RLS -----
alter table voice_enrichment_sessions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'voice_enrichment_sessions_select_auth') then
    create policy voice_enrichment_sessions_select_auth
      on voice_enrichment_sessions
      for select to authenticated
      using (true);
  end if;
end $$;
