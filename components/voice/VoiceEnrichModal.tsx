"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mic, Square, Loader2, Plus, Trash2, RefreshCcw } from "lucide-react";
import type { VoiceSessionRow } from "@/lib/agent/types";

type Mode =
  | "idle"
  | "denied"
  | "recording"
  | "short_confirm"
  | "transcribing"
  | "confirm"
  | "submitting"
  | "error";

type SessionResponse = {
  ok: boolean;
  session?: VoiceSessionRow;
  extractionError?: string | null;
  empty?: boolean;
  error?: string;
  reason?: string;
};

const MAX_SECONDS = 360; // 6:00 hard cap
const WARN_AT = MAX_SECONDS - 15; // 5:45
const MIN_SECONDS = 15;
const BRIEF_MAX = 600;

export function VoiceEnrichModal({
  open,
  itemId,
  itemName,
  onClose
}: {
  open: boolean;
  itemId: number;
  itemName: string;
  onClose: () => void;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<VoiceSessionRow | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [editedBrief, setEditedBrief] = useState("");
  const [editedAC, setEditedAC] = useState<{ text: string }[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);

  // ---- Esc handling: only allowed when not recording ----
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (mode === "recording" || mode === "transcribing" || mode === "submitting") return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode, onClose]);

  // ---- Reset on close ----
  useEffect(() => {
    if (!open) {
      // Tear down any in-flight recording.
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch {}
      }
      const tracks = recorderRef.current?.stream?.getTracks?.() ?? [];
      tracks.forEach((t) => t.stop());
      recorderRef.current = null;
      chunksRef.current = [];
      lastBlobRef.current = null;
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setMode("idle");
      setElapsed(0);
      setErrorMessage(null);
      setSession(null);
      setExtractionError(null);
      setEditedBrief("");
      setEditedAC([]);
    }
  }, [open]);

  if (!open) return null;

  // ---- Recording helpers ----
  async function startRecording() {
    setErrorMessage(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMode("denied");
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setMode("recording");
    recorder.start();
    tickRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000);
      setElapsed(sec);
      if (sec >= MAX_SECONDS) stopRecording("cap");
    }, 250);
  }

  function stopRecording(trigger: "user" | "cap") {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") rec.stop();
    const sec = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000);
    setElapsed(sec);
    // Wait one tick for ondataavailable to flush, then assemble blob.
    window.setTimeout(() => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      lastBlobRef.current = blob;
      if (trigger === "user" && sec < MIN_SECONDS) {
        setMode("short_confirm");
        return;
      }
      void uploadBlob(blob, sec);
    }, 100);
  }

  async function uploadBlob(blob: Blob, durationSeconds: number) {
    setMode("transcribing");
    setErrorMessage(null);
    const fd = new FormData();
    fd.append("audio", blob, `recording.${extOf(blob.type)}`);
    fd.append("duration_seconds", String(durationSeconds));
    fd.append("mime_type", blob.type);

    const attempts = [0, 1000, 3000];
    let lastErr: string | null = null;
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i] > 0) await wait(attempts[i]);
      try {
        const r = await fetch(`/api/items/${itemId}/voice-session`, {
          method: "POST",
          body: fd
        });
        const data = (await r.json().catch(() => ({}))) as SessionResponse;
        if (!r.ok || !data.ok) {
          lastErr = data.error ?? `Request failed (${r.status})`;
          // If the server gave us a reason like transcript_too_short or
          // provider_error, no point retrying — surface immediately.
          if (data.reason || r.status === 401 || r.status === 429 || r.status === 422) {
            setErrorMessage(lastErr);
            setMode("error");
            return;
          }
          continue;
        }
        // Success path — render confirm view.
        const sess = data.session as VoiceSessionRow;
        setSession(sess);
        setExtractionError(data.extractionError ?? null);
        setEditedBrief(sess.extracted_brief ?? "");
        setEditedAC(
          sess.extracted_ac && sess.extracted_ac.length > 0
            ? sess.extracted_ac.map((c) => ({ text: c.text }))
            : [{ text: "" }, { text: "" }, { text: "" }]
        );
        setMode("confirm");
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "network error";
      }
    }
    setErrorMessage(lastErr ?? "Couldn't reach the server.");
    setMode("error");
  }

  async function submitDraft() {
    if (!session) return;
    const cleanedAC = editedAC.map((c) => ({ text: c.text.trim() })).filter((c) => c.text);
    if (!editedBrief.trim() || cleanedAC.length === 0) return;
    setMode("submitting");
    setErrorMessage(null);
    try {
      const r = await fetch(`/api/voice-sessions/${session.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: editedBrief.trim(),
          acceptance_criteria: cleanedAC
        })
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setErrorMessage(data.error ?? `Submit failed (${r.status})`);
        setMode("confirm");
        return;
      }
      onClose();
      router.refresh();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Submit failed");
      setMode("confirm");
    }
  }

  async function reRecord() {
    if (!confirm("Discard this recording and start over?")) return;
    if (session) {
      // Fire and forget — the discard mark is a debugging convenience, not a gate.
      void fetch(`/api/voice-sessions/${session.id}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "rerecord" })
      });
    }
    setSession(null);
    setExtractionError(null);
    setEditedBrief("");
    setEditedAC([]);
    setElapsed(0);
    setErrorMessage(null);
    setMode("idle");
  }

  function continueShortAnyway() {
    const blob = lastBlobRef.current;
    if (!blob) {
      setMode("idle");
      return;
    }
    void uploadBlob(blob, elapsed);
  }

  // ---- Layout: width grows to 720 in confirm state ----
  const wide = mode === "confirm" || mode === "submitting";
  const closeAllowed = mode !== "recording" && mode !== "transcribing" && mode !== "submitting";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeAllowed) onClose();
      }}
    >
      <div
        className={`flex max-h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xl ${
          wide ? "w-[720px]" : "w-[480px]"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="font-serif text-section text-text-primary">Voice enrich</h2>
            <span className="text-text-tertiary">·</span>
            <span className="truncate text-compact text-text-secondary">{itemName}</span>
          </div>
          {closeAllowed && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        {mode === "idle" && <IdleView onStart={startRecording} />}
        {mode === "denied" && <DeniedView onClose={onClose} />}
        {mode === "recording" && (
          <RecordingView elapsed={elapsed} onStop={() => stopRecording("user")} />
        )}
        {mode === "short_confirm" && (
          <ShortConfirmView
            elapsed={elapsed}
            onContinue={continueShortAnyway}
            onReRecord={() => {
              lastBlobRef.current = null;
              setElapsed(0);
              setMode("idle");
            }}
          />
        )}
        {mode === "transcribing" && <TranscribingView />}
        {mode === "error" && (
          <ErrorView
            message={errorMessage ?? "Something went wrong."}
            onReRecord={() => {
              lastBlobRef.current = null;
              setElapsed(0);
              setErrorMessage(null);
              setMode("idle");
            }}
            onCancel={onClose}
          />
        )}
        {(mode === "confirm" || mode === "submitting") && session && (
          <ConfirmView
            session={session}
            extractionError={extractionError}
            brief={editedBrief}
            setBrief={setEditedBrief}
            ac={editedAC}
            setAC={setEditedAC}
            submitting={mode === "submitting"}
            errorMessage={errorMessage}
            onReRecord={reRecord}
            onSubmit={submitDraft}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Sub-views ----------

function IdleView({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-4 px-5 py-5">
      <p className="text-compact text-text-primary">
        Talk through these three questions. Take 2–4 minutes. You only get one shot — when you stop, that&apos;s it.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-compact text-text-secondary">
        <li>What is this, and why does it matter?</li>
        <li>What does &ldquo;done&rdquo; look like?</li>
        <li>Anything else worth knowing — risks, dependencies, related work?</li>
      </ol>
      <div className="border-t border-border-subtle pt-4">
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={onStart}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-text-inverse shadow-md transition-opacity hover:opacity-90"
            aria-label="Record"
          >
            <Mic className="h-7 w-7" />
          </button>
          <div className="text-label text-text-tertiary">Click to start. Click again to stop.</div>
        </div>
      </div>
      <div className="space-y-1 text-label text-text-tertiary">
        <div>We&apos;ll keep the transcript for 30 days for debugging. We don&apos;t store the audio.</div>
        <div>Max 6 minutes. Quiet room recommended.</div>
      </div>
    </div>
  );
}

function DeniedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4 px-5 py-6">
      <div className="rounded-md border border-status-blocked-soft bg-status-blocked-soft px-3 py-2 text-compact text-status-blocked-text">
        Microphone access denied. Allow microphone permission in your browser, then try again.
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-compact text-text-secondary hover:text-text-primary"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function RecordingView({ elapsed, onStop }: { elapsed: number; onStop: () => void }) {
  const warn = elapsed >= WARN_AT;
  return (
    <div className="space-y-4 px-5 py-6">
      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={onStop}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-status-blocked text-text-inverse shadow-md transition-opacity hover:opacity-90"
          aria-label="Stop"
        >
          <Square className="h-7 w-7 fill-current" />
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-status-blocked" />
          <span
            className={`font-mono tabular-nums text-[16px] ${
              warn ? "text-status-blocked-text" : "text-text-primary"
            }`}
          >
            {fmtMMSS(elapsed)}
          </span>
        </div>
        {warn && (
          <div className="text-label text-status-blocked-text">
            Recording will stop at 6:00.
          </div>
        )}
      </div>
    </div>
  );
}

function ShortConfirmView({
  elapsed,
  onContinue,
  onReRecord
}: {
  elapsed: number;
  onContinue: () => void;
  onReRecord: () => void;
}) {
  return (
    <div className="space-y-4 px-5 py-6">
      <div className="rounded-md border border-border-subtle bg-bg-muted px-3 py-2 text-compact text-text-secondary">
        That was {elapsed}s — under 15s, extraction may be poor.
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-compact text-text-secondary hover:bg-bg-muted"
        >
          Continue anyway
        </button>
        <button
          type="button"
          onClick={onReRecord}
          className="rounded-md bg-brand px-3 py-1.5 text-compact text-text-inverse hover:opacity-90"
        >
          Re-record
        </button>
      </div>
    </div>
  );
}

function TranscribingView() {
  const [stage, setStage] = useState<"transcribing" | "still">("transcribing");
  useEffect(() => {
    const t = window.setTimeout(() => setStage("still"), 30_000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10">
      <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      <div className="text-compact text-text-secondary">
        {stage === "transcribing" ? "Transcribing…" : "Still working…"}
      </div>
    </div>
  );
}

function ErrorView({
  message,
  onReRecord,
  onCancel
}: {
  message: string;
  onReRecord: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 px-5 py-6">
      <div className="rounded-md border border-status-blocked-soft bg-status-blocked-soft px-3 py-2 text-compact text-status-blocked-text">
        {message}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-compact text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onReRecord}
          className="rounded-md bg-brand px-3 py-1.5 text-compact text-text-inverse hover:opacity-90"
        >
          Re-record
        </button>
      </div>
    </div>
  );
}

function ConfirmView({
  session,
  extractionError,
  brief,
  setBrief,
  ac,
  setAC,
  submitting,
  errorMessage,
  onReRecord,
  onSubmit
}: {
  session: VoiceSessionRow;
  extractionError: string | null;
  brief: string;
  setBrief: (s: string) => void;
  ac: { text: string }[];
  setAC: (next: { text: string }[]) => void;
  submitting: boolean;
  errorMessage: string | null;
  onReRecord: () => void;
  onSubmit: () => void;
}) {
  const cleanedACCount = ac.filter((c) => c.text.trim()).length;
  const briefValid = brief.trim().length > 0 && brief.length <= BRIEF_MAX;
  const canSubmit = briefValid && cleanedACCount >= 1 && !submitting;
  const wordCount = session.transcript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <div className="grid flex-1 grid-cols-[40%_60%] overflow-hidden">
        {/* Transcript column */}
        <div className="flex min-h-0 flex-col border-r border-border-subtle px-5 py-4">
          <div className="mb-2 text-badge uppercase tracking-[0.04em] text-text-tertiary">
            Transcript
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-compact text-text-secondary scrollbar-thin">
            {session.transcript || (
              <span className="italic text-text-tertiary">No transcript captured.</span>
            )}
          </div>
          <div className="mt-3 text-label text-text-tertiary">
            {fmtMMSS(session.duration_seconds ?? 0)} · {wordCount} words · transcribed by{" "}
            {session.transcript_model || "—"}
          </div>
        </div>

        {/* Draft column */}
        <div className="flex min-h-0 flex-col px-5 py-4">
          <div className="mb-2 text-badge uppercase tracking-[0.04em] text-text-tertiary">
            Draft
          </div>
          {extractionError && (
            <div className="mb-3 rounded-md border border-border-subtle bg-bg-muted px-3 py-2 text-label text-text-secondary">
              We have your transcript but couldn&apos;t auto-fill the fields. You can paste a brief manually.
            </div>
          )}

          <div className="space-y-3 overflow-y-auto pb-2 scrollbar-thin">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-label text-text-tertiary">Brief</span>
                <span
                  className={`text-label tabular-nums ${
                    brief.length > BRIEF_MAX ? "text-status-blocked-text" : "text-text-tertiary"
                  }`}
                >
                  {brief.length}/{BRIEF_MAX}
                </span>
              </div>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-compact text-text-primary focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1 text-label text-text-tertiary">Acceptance criteria</div>
              <div className="space-y-1.5">
                {ac.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={c.text}
                      onChange={(e) => {
                        const next = ac.slice();
                        next[i] = { text: e.target.value };
                        setAC(next);
                      }}
                      placeholder={`Criterion ${i + 1}`}
                      className="flex-1 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-compact text-text-primary focus:border-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setAC(ac.filter((_, j) => j !== i))}
                      className="rounded-md p-1 text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
                      aria-label={`Remove criterion ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAC([...ac, { text: "" }])}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-label text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Add criterion
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 text-label text-text-tertiary">
            extraction model: {session.extraction_model ?? "—"}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="border-t border-border-subtle px-5 py-2 text-label text-status-blocked-text">
          {errorMessage}
        </div>
      )}

      <footer className="flex items-center justify-between gap-2 border-t border-border-subtle bg-bg-page px-5 py-3">
        <button
          type="button"
          onClick={onReRecord}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-compact text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Re-record
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-compact text-text-inverse hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit for approval
        </button>
      </footer>
    </>
  );
}

// ---------- helpers ----------

function fmtMMSS(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function extOf(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("mp4") || lower.includes("m4a") || lower.includes("aac")) return "mp4";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("wav")) return "wav";
  return "webm";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
