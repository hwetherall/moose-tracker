import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Structured extraction from the voice transcript. Per V2.5 §7 and Harry's
 * day-one model choice, this is `google/gemini-3-flash-preview` via OpenRouter.
 * Use the slug exactly. No silent fallback. If OpenRouter rejects it, surface
 * the error including the slug.
 */
export const EXTRACTION_MODEL = "google/gemini-3-flash-preview";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const ExtractionSchema = z.object({
  brief: z.string().max(600),
  acceptance_criteria: z.array(z.object({ text: z.string().min(1) })).max(8)
});
export type ExtractionPayload = z.infer<typeof ExtractionSchema>;

export type ExtractItemContext = {
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

export type ExtractOk = {
  ok: true;
  payload: ExtractionPayload;
  empty: boolean;
  model: string;
};

export type ExtractFail = {
  ok: false;
  reason: "provider_error" | "invalid_json" | "schema_violation";
  message: string;
};

export type ExtractResult = ExtractOk | ExtractFail;

const SYSTEM_PROMPT = `You convert a spoken transcript about a planning item into structured fields. The user was asked three questions and spoke for 2-4 minutes. Their answers are in the transcript. Convert what they said into a brief and a set of acceptance criteria.

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
  An empty response is a valid response. Do not pad.`;

export async function extractFromTranscript(
  transcript: string,
  item: ExtractItemContext
): Promise<ExtractResult> {
  const userMessage = `Item:\n${JSON.stringify(item, null, 2)}\n\nTranscript:\n${transcript}\n\nReturn the JSON object now.`;

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openrouterKey()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://antler.innovera.ai",
        "X-Title": "Antler Voice Enrich"
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        stream: false,
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: `extraction network error (model ${EXTRACTION_MODEL}): ${
        e instanceof Error ? e.message : String(e)
      }`
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      reason: "provider_error",
      message: `OpenRouter error (model ${EXTRACTION_MODEL}): ${response.status} ${text.slice(0, 600)}`
    };
  }

  const data = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(content);
  } catch {
    return {
      ok: false,
      reason: "invalid_json",
      message: `extraction returned non-JSON (model ${EXTRACTION_MODEL})`
    };
  }

  const parsed = ExtractionSchema.safeParse(parsedRaw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema_violation",
      message: `extraction schema violation: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; ")}`
    };
  }

  const empty =
    parsed.data.brief.trim() === "" && parsed.data.acceptance_criteria.length === 0;

  return {
    ok: true,
    payload: {
      brief: parsed.data.brief.trim(),
      acceptance_criteria: parsed.data.acceptance_criteria.map((c) => ({ text: c.text.trim() }))
    },
    empty,
    model: EXTRACTION_MODEL
  };
}
