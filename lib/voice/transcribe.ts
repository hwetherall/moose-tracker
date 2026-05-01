import { env } from "@/lib/env";

/**
 * Direct OpenAI transcription. OpenRouter does not host an audio/transcriptions
 * endpoint as of V2.5 day-one verification, so we call OpenAI directly. The
 * named slug is `gpt-4o-transcribe` — use it exactly. If it fails, surface the
 * error including the slug; do not silently fall back to whisper-1.
 *
 * `whisper-1` is documented here as a configurable alternate so an env var
 * (`VOICE_TRANSCRIPTION_MODEL`) could swap it in for an environment without a
 * code change. Default is gpt-4o-transcribe.
 */
export const TRANSCRIPTION_MODEL_DEFAULT = "gpt-4o-transcribe";
const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export type TranscribeOk = {
  ok: true;
  transcript: string;
  model: string;
};

export type TranscribeFail = {
  ok: false;
  reason: "transcript_too_short" | "provider_error";
  message: string;
};

export type TranscribeResult = TranscribeOk | TranscribeFail;

const MIN_TRANSCRIPT_CHARS = 50;

export async function transcribeAudio(
  audio: Blob,
  filename: string
): Promise<TranscribeResult> {
  const model = process.env.VOICE_TRANSCRIPTION_MODEL || TRANSCRIPTION_MODEL_DEFAULT;

  const fd = new FormData();
  fd.append("model", model);
  fd.append("file", audio, filename);

  let r: Response;
  try {
    r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey()}` },
      body: fd
    });
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: `transcription network error (model ${model}): ${
        e instanceof Error ? e.message : String(e)
      }`
    };
  }

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      reason: "provider_error",
      message: `transcription provider error (model ${model}): ${r.status} ${text.slice(0, 600)}`
    };
  }

  const data = (await r.json().catch(() => ({}))) as { text?: string };
  const transcript = (data.text ?? "").trim();
  if (transcript.length < MIN_TRANSCRIPT_CHARS) {
    return {
      ok: false,
      reason: "transcript_too_short",
      message: `transcript was ${transcript.length} chars; minimum ${MIN_TRANSCRIPT_CHARS}`
    };
  }

  return { ok: true, transcript, model };
}
