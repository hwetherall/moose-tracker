# claude-2.5.md — Moose Dashboard V2.5

The "voice enrichment PoC" release. A single feature: a user picks an under-enriched item, talks for 2–4 minutes, and the dashboard turns that into a draft brief + acceptance criteria, which goes through the same approval path as any other agent proposal.

This is a proof of concept. The success bar is "does this change behavior" not "is this production-grade." Build it accordingly — small, contained, fast to ship, easy to delete if it doesn't earn its keep.

## Read this first

This file is **additive** to `CLAUDE.md`, `claude-cleanup.md`, `claude-1.5.md`, and `claude-2.md`. It does not replace them. The agent infrastructure (proposal queue, `/inbox`, item enrichment table, sheet writeback path for `brief`) from V2 is inherited unchanged. Voice is a *new entry point* into the existing proposal queue. The downstream approval/writeback machinery does not change.

V2.5 has one feature, one entry point, two backend calls. Build it and ship it. Resist scope creep — this is the PoC, not the production system.

**Out of scope, explicitly:**
- Two-way voice conversation, turn-taking, follow-up questions
- Streaming transcription
- Voice-driven brief reading-aloud, voice-driven inbox approvals
- Voice agent identity / persona / Dik-Dik voice (deferred — those decisions belong to V3)
- Multi-language support beyond whatever the underlying model handles natively
- Storing audio
- Effort estimate or risk level extraction (the typed flow handles those)
- Any UI changes outside the detail drawer's enrichment section
- Any change to the existing typed enrichment flow

**Before writing code:**
1. Read this file end to end.
2. Confirm the V2 enrichment infrastructure is shipped and working — the proposal queue, `/inbox`, `item_enrichment` table, and brief writeback to the sheet must already exist. Voice is layered on top of that. If V2 isn't deployed, finish V2 first.
3. Reply with: (a) what migrations and packages this work requires, (b) any spec ambiguity given the deployed V2, (c) confirmation that you've verified OpenRouter exposes audio transcription endpoints for the named models — see §11. Wait for confirmation before starting.

---

## 1. The flow at a glance

```
1. User opens detail drawer for an item with empty brief / no AC
2. Clicks "Voice enrich"
3. Modal appears with the three questions visible
4. User clicks Record, talks for 2-4 minutes, clicks Stop
5. Audio blob → server → transcribed → extracted to JSON → returned
6. Modal switches to confirm view: transcript on left, draft brief + AC on right (editable)
7. User edits if needed, clicks Submit
8. Two rows are written to agent_proposals (brief, acceptance_criteria)
9. Existing approval flow takes over: user (or someone else) approves in /inbox
10. On approval, brief writes back to sheet column 25 — same path as typed enrichment
```

There is no back-and-forth voice conversation. The user speaks once. The system responds once. Both ends are aware of this constraint upfront.

---

## 2. The three questions

The user sees these three questions in the modal before they start recording. They are also embedded in the extraction prompt so the model knows what the user was answering.

```
1. What is this, and why does it matter?
2. What does "done" look like?
3. Anything else worth knowing — risks, dependencies, related work?
```

Render them as a numbered list above the record button, in body sans 14px, `text.secondary`. Above the list, a single-line preface in `text.primary` 13px: "Talk through these three questions. Take 2–4 minutes. You only get one shot — when you stop, that's it."

That last sentence is important. The user must understand this is one-shot before they press Record. Setting that expectation up front is a kindness; surprising them with it after is a betrayal.

---

## 3. Entry point

In the detail drawer's "AI-enriched" section (V2 §2.6), the empty state for `brief` and `acceptance_criteria` currently shows a `Suggest one` button. V2.5 adds a second button beside it: **"Voice enrich"** with a `Mic` lucide icon (14px), same styling as `Suggest one`.

Both buttons remain. The user chooses. There is no auto-redirect, no nudge, no "did you know voice is faster?" message. The button is there; people will find it or they won't.

The Voice enrich button is also visible if the item has *any* empty enrichment field, not just brief and AC. Voice fills brief and AC; the others remain typed-only in V2.5.

---

## 4. Recording UI

The modal is 480px wide, centered, `bg.surface`, `border.subtle`, `xl` radius. Same chrome as the V1.5 New Item modal — match, don't reinvent.

Header: "Voice enrich · {item.name}" in serif 15px, with the item ID in `text.tertiary` to the right. Close button (X) top-right.

### 4.1 Idle state (before recording)

Body, top-down:

- One-line preface (see §2)
- The three numbered questions
- A horizontal `border.subtle` divider
- Centered: a 64px circular **Record** button. `bg.brand`, white `Mic` icon. Hover state slightly darker.
- Below the button: "Click to start. Click again to stop." in 12px `text.tertiary`
- Two thin lines below in `text.tertiary`:
  - "We'll keep the transcript for 30 days for debugging. We don't store the audio."
  - "Max 6 minutes. Quiet room recommended."

Cancel button bottom-left (text-only, `text.secondary`). Closes the modal without doing anything.

### 4.2 Recording state

Pressing Record triggers `navigator.mediaDevices.getUserMedia({ audio: true })`. If the browser denies permission, surface a clear inline error: "Microphone access denied. Allow microphone permission in your browser, then try again." with no further action.

On grant:
- Button switches to **Stop** — same circle, but `bg.status-blocked` (red) and a `Square` lucide icon
- Below the button, replace the helper text with a live MM:SS timer in tabular-nums 16px `text.primary`
- A subtle pulsing dot (`status.blocked.dot`) to the left of the timer
- Disable the modal's close button while recording — force the user to Stop explicitly. Esc does nothing.
- Hard cap at **6:00**. At 5:45, the timer turns `status.blocked.text` and a one-line warning appears: "Recording will stop in 15 seconds." At 6:00, automatically stop and proceed as if the user clicked Stop.
- Soft floor at **0:15**. If the user clicks Stop before 15 seconds, show a confirmation toast: "That was less than 15 seconds — extraction may be poor. [Continue anyway] [Re-record]". Default action is Re-record.

Use `MediaRecorder` with default options. Let the browser pick the mime type (`audio/webm;codecs=opus` on Chromium, `audio/mp4` on Safari). Both are accepted by the transcription endpoint; we pass the mime type through.

### 4.3 Transcribing state

When recording stops, the modal switches to a centered loading state:
- A small spinner (lucide `Loader2`, animate-spin)
- Text: "Transcribing…" then changes to "Extracting…" once the transcription returns and extraction begins
- No cancel option. The whole round-trip should be <15s for a 4-minute recording. If it takes longer than 30s, show "Still working…" but do not abort.

If either step errors, see §13.

### 4.4 Confirm state

Two-column layout inside the modal body. Modal widens to 720px for this state.

**Left column (40% width):**
- Header: "Transcript" in 12px `text.tertiary` uppercase tracking-wide
- Body: the raw transcript, plain prose, `text.secondary` 13px, scrollable. Read-only. No editing the transcript.
- Footer: "{duration} · {word_count} words · transcribed by {model}" in `text.tertiary` 11px

**Right column (60% width):**
- Header: "Draft" in 12px `text.tertiary` uppercase tracking-wide
- A `Brief` editable textarea, labeled, 4 rows, with character count (target ≤ 600 chars; show in red if exceeded)
- An editable bulleted list for `Acceptance criteria`. Each row is one criterion with a drag-handle, an inline text input, and a delete (X) button. Below the list, a `+ Add criterion` ghost button.
- Footer: extraction model name in `text.tertiary` 11px

Bottom of modal:
- Left: a `Re-record` button (ghost). Clicking it returns to §4.1 — wipes the transcript and draft, prompts confirmation ("Discard this recording and start over?")
- Right: primary `Submit for approval` button. Disabled if `brief` is empty or `acceptance_criteria` has zero non-empty rows.

On Submit: see §10.3.

---

## 5. Recording → upload (client side)

Browser-side, no third-party SDK. `MediaRecorder` accumulates chunks via `ondataavailable`. On stop, concat chunks into a single `Blob` and POST it.

```ts
// Pseudocode for the upload step
const blob = new Blob(chunks, { type: recorder.mimeType });
const form = new FormData();
form.append('audio', blob, `recording.${ext}`);
form.append('duration_seconds', String(durationSeconds));
form.append('mime_type', blob.type);
const res = await fetch(`/api/items/${itemId}/voice-session`, {
  method: 'POST',
  body: form,
});
```

The server handles transcription and extraction in the same request. The endpoint returns the populated session, including transcript and extracted fields, in one response. We do not stream to the client.

Why one endpoint instead of two: PoC simplicity. The total round-trip is bounded (<30s in practice), and a single request keeps client state simple. We can split if needed in V3 when streaming UX matters.

Network-failure retry: client retries the upload twice with exponential backoff (1s, 3s) before surfacing an error.

---

## 6. Transcription (server side)

The route receives the audio blob and forwards it to OpenRouter's audio transcription endpoint.

- **Provider:** OpenRouter
- **Primary model:** `openai/gpt-4o-transcribe`
- **Fallback model (named, not auto-fallback):** `openai/whisper-1`
- Use exactly those slugs. The user has confirmed both exist on OpenRouter. Do not substitute. Do not silently fall back from gpt-4o-transcribe to whisper-1 mid-request — if gpt-4o-transcribe errors, surface the error.
- Endpoint: OpenRouter's `audio/transcriptions` (OpenAI-compatible interface).
- API key: existing `OPENROUTER_API_KEY`.

```ts
// Server-side, in /api/items/[id]/voice-session/route.ts
const transcriptionRes = await fetch(
  'https://openrouter.ai/api/v1/audio/transcriptions',
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: forwardedFormData,  // includes file, model='openai/gpt-4o-transcribe'
  }
);
```

The response shape follows the OpenAI audio.transcriptions JSON: `{ text: string, ... }`. We persist `text` only.

If the response is empty (`text.length < 50` or whitespace-only), do not call the extraction step — return an error state to the client immediately. See §13.

The audio blob is **never written to disk and never written to a database**. It exists in the request handler's memory, gets forwarded, and is discarded when the handler returns.

### 6.1 Which model is the actual default

`openai/gpt-4o-transcribe`. `openai/whisper-1` is documented here as available — for example, an admin override or a per-environment env var (`VOICE_TRANSCRIPTION_MODEL`) could point at either. Default behavior in V2.5: use gpt-4o-transcribe. Only switch by config, never automatically.

---

## 7. Extraction (server side)

After transcription, the server calls a second model to extract structured fields from the transcript.

- **Provider:** OpenRouter
- **Model:** `google/gemini-flash-latest`
- Use exactly that slug. The user has confirmed it exists on OpenRouter. Do not substitute. Do not silently fall back.
- Endpoint: OpenRouter's standard chat completions.
- API key: existing `OPENROUTER_API_KEY`.

### 7.1 Input context

Build a context object from the planning_items row plus the transcript:

```ts
type ExtractionInput = {
  item: {
    id: number;
    name: string;
    type: string | null;
    category: string | null;
    subsystem: string | null;
    status: string;
    parent_epic: string | null;
    comments: string | null;
    dod: string | null;
    blocker: string | null;
  };
  transcript: string;
};
```

Pass this to the model as a single user message, alongside the system prompt below.

### 7.2 Extraction system prompt

```
You convert a spoken transcript about a planning item into structured fields. The user was asked three questions and spoke for 2-4 minutes. Their answers are in the transcript. Convert what they said into a brief and a set of acceptance criteria.

The three questions were:
1. What is this, and why does it matter?
2. What does "done" look like?
3. Anything else worth knowing — risks, dependencies, related work?

You will receive:
- A planning item with whatever existing fields are populated (name, type, category, parent epic, comments, dod, blocker)
- A raw transcript

Return strict JSON:

{
  "brief": string,                                   // 2-3 sentences, ≤ 600 chars
  "acceptance_criteria": Array<{text: string}>      // 3-5 items
}

Hard rules:
- Only use information present in the transcript or the existing item fields. Do not invent technical details, owners, dates, or system references.
- Prefer the speaker's own phrasing where it is clear and concise. Do not over-sanitize. This is their voice; honor it.
- Filter out interpersonal commentary about specific people ("I think Spencer is dragging his feet on this"). Keep technical and product substance only. If the speaker says something negative about a person, do not include it in the brief or AC.
- The brief should not restate the item's title. Add information.
- Acceptance criteria should be testable — each one is a thing someone could check off as done. If the speaker did not give clear AC, infer 3 minimal ones from the brief, marked plainly (do not invent specifics).
- Return strict JSON, no commentary, no markdown fence.
- If the transcript is unintelligible, very short, or off-topic (e.g. the user clearly stopped recording mid-sentence about something else), return:
  { "brief": "", "acceptance_criteria": [] }
  An empty response is a valid response. Do not pad.
```

### 7.3 Output validation

Validate the model's JSON response with Zod:

```ts
const ExtractionResultSchema = z.object({
  brief: z.string().max(600),
  acceptance_criteria: z.array(z.object({ text: z.string().min(1) })).max(8),
});
```

If parsing fails (malformed JSON, schema violation), do not retry the model — return an error state to the client. See §13.

If the result is empty (`brief === ''` and `acceptance_criteria.length === 0`), still persist the session and return it; the client renders an empty draft and lets the user paste a brief manually. The transcript is not wasted.

---

## 8. Schema

### 8.1 New table

```sql
create table voice_enrichment_sessions (
  id bigserial primary key,
  item_id int not null references planning_items(id) on delete cascade,
  user_email text not null,
  transcript text not null,
  transcript_model text not null,
  extraction_model text,                    -- null if extraction step failed or skipped
  extracted_brief text,
  extracted_ac jsonb,
  duration_seconds int,
  status text not null default 'extracted', -- 'extracted'|'submitted'|'discarded'|'failed'
  failure_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index on voice_enrichment_sessions (item_id, created_at desc);
create index on voice_enrichment_sessions (expires_at);
create index on voice_enrichment_sessions (status, created_at desc);
```

### 8.2 Column added to `agent_proposals`

```sql
alter table agent_proposals
  add column source_session_id bigint references voice_enrichment_sessions(id) on delete set null;
```

When a voice session is submitted, the two resulting proposal rows (one for `brief`, one for `acceptance_criteria`) both have `source_session_id` pointing at the session. This lets `/inbox` render a small "via voice" badge on those proposals, and lets the approver click through to the transcript if curious.

### 8.3 Retention cron

Add to `vercel.json`:

```
0 4 * * *  →  /api/cron/voice/retention
```

The handler runs:

```sql
DELETE FROM voice_enrichment_sessions WHERE expires_at < now();
```

The `agent_proposals.source_session_id` references will null out via `ON DELETE SET NULL`. The proposal rows themselves stay intact — the brief and AC text live on `agent_proposals.proposed_value`, not on the session.

---

## 9. The "via voice" badge in `/inbox`

In the V2 `/inbox` page (V2 §5.2), proposals from a voice session render with a small `Mic` icon (12px, `text.tertiary`) before the rationale, and a `View transcript` chip in the action row that opens a small inline panel showing the transcript. If the session has been retention-deleted (transcript is gone), the chip is replaced by `Transcript expired` in `text.tertiary` non-interactive.

This is a five-line UI change. Do not turn it into a redesign of the inbox.

---

## 10. API routes

### 10.1 `POST /api/items/[id]/voice-session`

Creates a session. Body: multipart/form-data with `audio` (Blob), `duration_seconds` (int), `mime_type` (string). Auth: existing `@innovera.com` SSO. Rate-limit: 5 sessions per user per hour.

Flow:
1. Validate the item exists and is not soft-deleted.
2. Validate the audio: size ≤ 25 MB, mime type starts with `audio/`.
3. Create a session row with `status = 'extracted'` placeholder values (transcript = '', will overwrite).
4. Forward the audio to OpenRouter for transcription.
5. If transcription succeeds, store transcript on the session, then call extraction.
6. If extraction succeeds, store brief and AC on the session.
7. Return the full session row to the client.

Each step's failure mode is in §13. The session row is updated in-place as steps complete; if a step fails, the row stays with `status = 'failed'` and `failure_reason` populated, so we can debug.

### 10.2 `POST /api/voice-sessions/[id]/submit`

The user has confirmed (possibly edited) the draft. Body:

```ts
{
  brief: string;                              // ≤ 600 chars
  acceptance_criteria: Array<{ text: string }>;  // ≥ 1, ≤ 8
}
```

Flow:
1. Validate the session belongs to the requesting user (or is admin) and `status = 'extracted'`.
2. Validate the body with Zod.
3. Create two rows in `agent_proposals` with `proposal_type = 'enrichment'`, `source = 'voice'`, `source_session_id = sessionId`. One for `field = 'brief'`, one for `field = 'acceptance_criteria'`.
4. Mark session `status = 'submitted'`.
5. Return the two proposal IDs.

The session's stored `extracted_brief` and `extracted_ac` may differ from the submitted values — that's fine; the proposal carries the human-confirmed value, and the session row preserves what the model originally produced. Useful for evaluating extraction quality later.

After submit, the modal closes and a small toast appears in the detail drawer: "Submitted for approval. View in /inbox →"

### 10.3 `POST /api/voice-sessions/[id]/discard`

Called when the user hits Re-record or closes the modal in the confirm state. Body: optional `{ reason: 'rerecord' | 'cancel' }`. Marks session `status = 'discarded'`. Returns 204. The transcript stays on the row until retention deletes it — we keep discarded sessions for the same 30 days because they're useful for understanding what doesn't work.

### 10.4 Retention cron

`GET /api/cron/voice/retention`. Auth: `CRON_SECRET` header. Deletes expired session rows. Logs the count.

---

## 11. Models and providers — summary

All voice features use `OPENROUTER_API_KEY`. No new env vars for credentials.

| Step | Model slug | Purpose |
|------|-----------|---------|
| Transcription (default) | `openai/gpt-4o-transcribe` | Audio → transcript |
| Transcription (named alternate) | `openai/whisper-1` | Available via env var override; not default |
| Extraction | `google/gemini-flash-latest` | Transcript → structured JSON |

Apply the same hard rule used in V1.5 chat and V2 agent: **use these slugs exactly. Do not substitute. Do not "verify" they exist by web-searching first. The user has confirmed they exist on OpenRouter at the time of writing.** If a call fails, surface the error including the slug; do not silently fall back.

**Note for the implementer:** OpenRouter's audio transcription support is the assumption this spec rests on. Verify that `https://openrouter.ai/api/v1/audio/transcriptions` accepts `openai/gpt-4o-transcribe` and `openai/whisper-1` as the `model` parameter on day one of implementation. If it does not (e.g., OpenRouter hasn't shipped audio routing for these models yet), the fix is to call OpenAI's `https://api.openai.com/v1/audio/transcriptions` directly with a separate `OPENAI_API_KEY`. Do not silently switch — flag it back to the user, and we'll decide. Only the transcription step is at risk; the extraction step is standard chat completions and definitely works on OpenRouter.

---

## 12. Privacy and retention

This is the section to read carefully. Voice transcripts are more sensitive than they feel.

- **Audio:** never persisted. Lives in the request handler's memory; sent to the transcription provider; discarded.
- **Transcripts:** persisted on `voice_enrichment_sessions` for 30 days. Auto-deleted by the retention cron.
- **Extracted fields:** persist on `agent_proposals` (and on `item_enrichment` after approval) indefinitely. These are the artifact, and they have been seen and confirmed by a human.
- **The 30-day window** exists for two reasons: (a) debugging when extraction is wrong, and (b) letting a second approver in `/inbox` listen to the source if they want to. After 30 days, there's no compelling reason to keep it.
- **The extraction prompt explicitly filters interpersonal commentary.** This is not a guarantee — it's a mitigation. Anyone who voice-enriches should still understand they're speaking on the record. Surface that in the modal copy if it isn't already.
- **No external data leaves the OpenRouter pipeline.** No analytics on the audio. No third-party recording libraries. No browser extensions in the recommended setup.

If a user asks for their transcripts deleted before the 30-day window, an admin can run a manual delete keyed on `user_email`. This is rare enough not to need a UI.

---

## 13. Failure modes

Every failure path lands the user back in a sane place with a clear message. None of them produce a confusing modal state or a half-written proposal.

| Failure | Detection | User sees |
|---------|-----------|-----------|
| Microphone permission denied | `getUserMedia` rejection | Inline error in modal idle state, no recording starts |
| Audio recording <15s | Client-side timer | Confirmation toast: "Less than 15 seconds — are you sure?" with [Continue] / [Re-record] |
| Audio upload fails (network) | Fetch error | Client retries 2× with backoff; on final failure, error toast: "Couldn't reach the server. [Try again]" — recorded blob is preserved in client state for the retry |
| Transcription returns empty / <50 chars | Server-side check | Modal shows error state: "We couldn't make out the audio. [Re-record] [Cancel]" — session row marked `status = 'failed'`, `failure_reason = 'transcription_empty'` |
| Transcription provider errors | HTTP non-2xx | Error state with provider error message included. `failure_reason = 'transcription_error: {message}'` |
| Extraction returns malformed JSON | Zod parse failure | Modal shows confirm state with empty draft fields and the transcript visible. Inline note: "We have your transcript but couldn't auto-fill the fields. You can paste a brief manually." User can still type and submit. |
| Extraction returns empty (valid empty) | Schema parse OK, but content empty | Same as above — transcript visible, fields empty, user fills in manually. |
| User submits with empty brief or no AC | Server-side Zod | 400 response, modal stays open with field-level error |
| Submit succeeds but proposal write partially fails | Transaction failure | Roll back, return 500, modal shows "Couldn't save your draft — try again. Your transcript is safe." (Session is preserved.) |

The pattern: **never throw away the user's work**. If anything fails after they've spoken, the transcript is preserved, and they can always paste a brief manually as a last resort.

---

## 14. Success metric

This is the part you should write down before shipping, not after.

V2.5 succeeds if, in the **first two weeks after deploy**, all of:
- ≥ 10 voice sessions reach `status = 'submitted'` (i.e., extracted, confirmed, sent to inbox)
- ≥ 70% of submitted voice proposals are approved in `/inbox` (vs. rejected or sitting unapproved >7 days)
- ≥ 2 distinct users have submitted at least one voice session (not just Harry)

If we hit all three, voice has earned its place — graduate it from PoC to "regular feature" in V3 planning.

If we miss any, voice is interesting but not load-bearing. We keep it (it's small) but don't double down. The typed enrichment flow is the floor.

Track this with a simple admin view at `/admin/voice-stats` showing session counts by status, approval rate by source, and unique users in the last 14 days. No fancy charts — just numbers.

---

## 15. What we explicitly are NOT building (yet)

These are the features people will ask for after the demo. Hold the line.

- **Voice in the chat widget.** "Why can't I just talk to the chat box?" Different feature, different latency profile, different UX. V3 if at all.
- **Real-time follow-up questions during recording.** "It would be smarter if it asked me about effort." That's the conversational agent, which is at least 5× the engineering of this. V3.
- **Voice-driven inbox approvals.** "Approve item 34 by voice." No. Approval is the human decision; pressing a button is the right amount of friction.
- **Speaker diarization or multi-user recordings.** A team member can't hand the mic around to three people during a session. One user, one session.
- **Saving the audio for review.** No. See §12.
- **Voice in any agent persona / voice (Dik-Dik speaking back).** Whole separate feature stream. V3.
- **Voice on mobile.** Desktop browser only for V2.5. Mobile may work but isn't tested or supported.

If anyone asks for any of the above after the demo, the answer is "noted, V3." Do not stretch V2.5 to cover them.

---

## 16. Done checklist

**Schema and infra**
- [ ] `voice_enrichment_sessions` table exists with indexes
- [ ] `agent_proposals.source_session_id` column added
- [ ] `vercel.json` includes the retention cron
- [ ] `OPENROUTER_API_KEY` confirmed available; voice path uses it
- [ ] Verified day-one that OpenRouter's audio transcriptions endpoint accepts the named models — if not, switched to direct OpenAI and added `OPENAI_API_KEY` (per §11)

**Recording**
- [ ] Detail drawer shows `Voice enrich` button alongside `Suggest one`
- [ ] Modal opens with the three questions visible and the one-shot warning
- [ ] Microphone permission request handled cleanly on grant and denial
- [ ] Recording state shows live timer, pulsing dot, and disables modal close
- [ ] 6-minute hard cap auto-stops recording; 5:45 warning renders
- [ ] <15s soft floor warns the user with a confirmation toast
- [ ] Audio blob is sent as multipart/form-data to the session route

**Transcription + extraction**
- [ ] `POST /api/items/[id]/voice-session` route works end-to-end
- [ ] Transcription via `openai/gpt-4o-transcribe` returns text
- [ ] Extraction via `google/gemini-flash-latest` returns valid JSON
- [ ] Empty transcript (<50 chars) short-circuits to error state, no extraction call
- [ ] Malformed extraction JSON falls back to "fields empty, transcript visible" state
- [ ] Audio is never written to disk or DB

**Confirm UI**
- [ ] Two-column confirm view renders transcript and editable draft
- [ ] Brief textarea enforces ≤ 600 char count
- [ ] AC list supports add / edit / delete / reorder
- [ ] `Submit` is disabled when invalid; `Re-record` confirms before discarding
- [ ] Submit creates two `agent_proposals` rows with `source = 'voice'` and `source_session_id`

**Inbox integration**
- [ ] Voice-sourced proposals show a `Mic` icon and `View transcript` chip
- [ ] `View transcript` opens an inline panel; expired sessions show `Transcript expired`
- [ ] Approval flow downstream of submit is unchanged from V2

**Privacy**
- [ ] Audio confirmed not stored anywhere
- [ ] Retention cron deletes expired sessions; manual smoke test passes
- [ ] Modal copy mentions 30-day transcript retention and no-audio policy
- [ ] Extraction prompt filters interpersonal commentary

**Polish**
- [ ] Light and dark modes pass for the modal in idle, recording, transcribing, confirm, and error states
- [ ] No new hardcoded colors
- [ ] All routes have proper auth gates; cron has `CRON_SECRET`
- [ ] `/admin/voice-stats` page renders the three success-metric numbers

---

## 17. Hand back

When done, post:
- Screen recording (≤ 60s) of a full voice session: open drawer → record → stop → confirm → submit → see in `/inbox`
- Screenshot of the confirm view, light + dark
- Screenshot of `/inbox` showing a voice-sourced proposal with the `Mic` badge
- Screenshot of `/admin/voice-stats` after at least one submitted session
- A short note on observed end-to-end latency (record stop → confirm view rendered) for a 3-minute recording
- A two-line note confirming: audio is never persisted, named model slugs are exact, no auto-fallback between transcription models
- Any spec ambiguity you resolved on your own

---

## 18. Open TBDs

Decide during implementation; don't block on them:

- Whether the modal should remember the user's mic device choice (Bluetooth headset vs. laptop mic) across sessions — probably yes, via `localStorage`, but not worth blocking
- Browser support: Chrome and Safari latest are required; Firefox should work but isn't a launch blocker. Decide whether to gate by user-agent or just let it fail naturally
- Whether `/admin/voice-stats` is admin-only or visible to everyone — default admin-only, can loosen later
- Whether to log per-call OpenRouter cost (tokens × rate) on the session row for budget tracking. Cheap to add, useful if the feature scales
- The wording of the modal copy. Spec'd here as a starting point; adjust after the first internal demo with Pedram or Daniel
- Whether the success metric of "70% approval rate" is the right bar — set during dogfooding week 1; this is the placeholder

---

## Appendix A — A note on what V2.5 isn't

V2.5 is not the voice agent. The voice agent — the thing that talks back, asks follow-ups, knows Innovera's identity, and feels like a co-worker — is V3 or later. That feature requires an identity doc that doesn't exist yet (see the V2 conversation), a conversational architecture, and a much higher trust bar than a one-shot enrichment flow.

V2.5 is the *minimum experiment* that tells us whether voice changes behavior. If 10 items get enriched in two weeks across two users, voice is real and worth investing in. If they don't, we've spent a long weekend on a feature we can keep or remove cheaply, and we've learned something true about the team's working habits.

Resist the temptation to make V2.5 "almost the agent." The whole point of the PoC is that it's *not* the agent — it's the test of one specific assumption (voice unlocks enrichment) before we commit serious engineering to the larger arc.
