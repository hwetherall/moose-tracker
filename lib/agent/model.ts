import { env } from "@/lib/env";

/**
 * The agent uses Anthropic Claude Sonnet 4.6 via OpenRouter. Per claude-2.md §9
 * this is intentional: chat (V1.5) stays on the cheaper Gemini flash-lite, while
 * brief and enrichment get stronger reasoning. Do not "verify" or substitute —
 * the user has confirmed this slug exists on OpenRouter. If it errors, surface
 * the error including the model slug so we can debug — never silently fall back.
 */
export const AGENT_MODEL = "anthropic/claude-sonnet-4.6";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelCallResult = {
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export async function callAgentModel(
  messages: ModelMessage[],
  opts: { responseFormat?: "json_object" | "text"; temperature?: number } = {}
): Promise<ModelCallResult> {
  const body: Record<string, unknown> = {
    model: AGENT_MODEL,
    messages,
    stream: false,
    temperature: opts.temperature ?? 0.2
  };
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://antler.innovera.ai",
      "X-Title": "Antler Agent"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(
      `OpenRouter error (model ${AGENT_MODEL}): ${r.status} ${text.slice(0, 800)}`
    );
  }

  const data = (await r.json()) as {
    choices: Array<{ message: { content: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    content,
    model: AGENT_MODEL,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null
  };
}
