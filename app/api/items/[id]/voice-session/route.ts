import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { fetchPlanningById } from "@/lib/queries/planning";
import { transcribeAudio } from "@/lib/voice/transcribe";
import { extractFromTranscript, type ExtractItemContext } from "@/lib/voice/extract";
import type { VoiceSessionRow } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const RATE_LIMIT_PER_HOUR = 5;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ ok: false, error: "bad item id" }, { status: 400 });
  }

  const item = await fetchPlanningById(itemId);
  if (!item) {
    return NextResponse.json({ ok: false, error: "item not found" }, { status: 404 });
  }

  const sb = supabaseService();

  // Rate limit: 5 sessions per user per hour. Count rows the user has created
  // in the last hour regardless of status — failed/discarded still cost the
  // OpenAI call, so they should count toward the budget.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countErr } = await sb
    .from("voice_enrichment_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_email", userEmail)
    .gte("created_at", oneHourAgo);
  if (countErr) {
    return NextResponse.json({ ok: false, error: countErr.message }, { status: 500 });
  }
  if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { ok: false, error: "Rate limit reached. Try again in an hour." },
      { status: 429 }
    );
  }

  // Parse multipart. Next.js 16 supports req.formData() natively.
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bad multipart body" },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  const durationRaw = form.get("duration_seconds");
  const mimeType = String(form.get("mime_type") ?? "");

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "missing audio blob" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { ok: false, error: `audio exceeds ${MAX_AUDIO_BYTES} bytes` },
      { status: 413 }
    );
  }
  if (!mimeType.startsWith("audio/") && !audio.type.startsWith("audio/")) {
    return NextResponse.json({ ok: false, error: "unsupported mime type" }, { status: 415 });
  }
  const durationSeconds = Number(durationRaw);
  const safeDuration = Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null;

  // Pick a filename extension OpenAI's audio endpoint will accept based on the
  // mime type. The browser may report audio/webm;codecs=opus or audio/mp4.
  const ext = filenameExt(mimeType || audio.type);
  const filename = `recording.${ext}`;

  // ---- 1. Transcribe ----
  const transcribeResult = await transcribeAudio(audio, filename);
  if (!transcribeResult.ok) {
    // Persist a failed-session row so we can debug later. No transcript text
    // exists in this branch, but we still want a record that the user tried.
    const { data: failRow } = await sb
      .from("voice_enrichment_sessions")
      .insert({
        item_id: itemId,
        user_email: userEmail,
        transcript: "",
        transcript_model: "",
        duration_seconds: safeDuration,
        status: "failed",
        failure_reason: `${transcribeResult.reason}: ${transcribeResult.message}`
      })
      .select("*")
      .single();
    return NextResponse.json(
      {
        ok: false,
        error: transcribeResult.message,
        reason: transcribeResult.reason,
        session: (failRow as VoiceSessionRow | null) ?? null
      },
      { status: transcribeResult.reason === "transcript_too_short" ? 422 : 502 }
    );
  }

  // ---- 2. Extract ----
  const extractContext: ExtractItemContext = {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    subsystem: item.subsystem,
    status: item.status,
    parent_epic: item.parent_epic,
    comments: item.comments,
    dod: item.dod,
    blocker: item.blocker
  };
  const extractResult = await extractFromTranscript(
    transcribeResult.transcript,
    extractContext
  );

  // Persist the session. Even on extraction failure we keep the transcript,
  // because the user can still type a brief manually from it.
  const sessionInsert = {
    item_id: itemId,
    user_email: userEmail,
    transcript: transcribeResult.transcript,
    transcript_model: transcribeResult.model,
    extraction_model: extractResult.ok ? extractResult.model : null,
    extracted_brief: extractResult.ok ? extractResult.payload.brief : null,
    extracted_ac: extractResult.ok ? extractResult.payload.acceptance_criteria : null,
    duration_seconds: safeDuration,
    status: "extracted" as const,
    failure_reason: extractResult.ok ? null : `${extractResult.reason}: ${extractResult.message}`
  };

  const { data: sessionRow, error: insertErr } = await sb
    .from("voice_enrichment_sessions")
    .insert(sessionInsert)
    .select("*")
    .single();
  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    session: sessionRow as VoiceSessionRow,
    extractionError: extractResult.ok ? null : extractResult.message,
    empty: extractResult.ok ? extractResult.empty : false
  });
}

function filenameExt(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("mp4") || lower.includes("m4a") || lower.includes("aac")) return "mp4";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  return "webm";
}
