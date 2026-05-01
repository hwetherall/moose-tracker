---
name: V2.5 voice enrichment compliance review
description: First-pass GDPR/CCPA review of the voice enrichment feature (MediaRecorder → OpenRouter transcription → Supabase transcript storage). Key blockers: DPA with OpenRouter, no self-serve deletion, per-session consent gap, cross-border transfer documentation.
type: project
---

Feature reviewed: 2026-05-01.

Audio not persisted; transcripts stored 30 days in Supabase `voice_enrichment_sessions`; extracted brief/AC persist indefinitely. EU contractors in scope → GDPR applies. Voice potentially biometric-adjacent under GDPR Art. 9.

Key findings:
- BLOCKER: No DPA with OpenRouter (sub-processor chain: OpenAI + Google)
- BLOCKER: Cross-border transfer mechanism for audio/transcript not documented
- BLOCKER: Lawful basis not established in writing (LI vs. consent analysis needed)
- SHOULD-FIX: No self-serve transcript deletion (admin-only SQL is inadequate for DSAR timelines)
- SHOULD-FIX: Modal notice inadequate — missing lawful basis, sub-processor disclosure, DSAR contact
- SHOULD-FIX: One-time onboarding consent record needed before first use
- NICE-TO-HAVE: 14-day retention would be more defensible than 30

**Why:** EU contractors trigger full GDPR applicability. Voice + transcript = PII, possibly special category.
**How to apply:** Any future feature touching audio/transcript/AI sub-processors should check DPA chain first.
