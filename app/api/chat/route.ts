import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { TOOL_DEFS, executeTool } from "@/lib/chat/tools";
import { buildSystemPrompt } from "@/lib/chat/systemPrompt";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "google/gemini-3.1-flash-lite-preview";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TOOL_TURNS = 5;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

type Body = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

async function logTurn(
  userEmail: string,
  index: number,
  role: ChatMessage["role"],
  content: string | null,
  tool?: { name: string; args?: unknown; result?: unknown }
) {
  try {
    const sb = supabaseService();
    await sb.from("chat_log").insert({
      user_email: userEmail,
      message_index: index,
      role,
      content,
      tool_name: tool?.name ?? null,
      tool_args: tool?.args ?? null,
      tool_result: tool?.result ?? null
    });
  } catch (e) {
    // Logging failures must never break the chat itself.
    console.warn("chat_log write failed", e);
  }
}

async function callOpenRouter(messages: ChatMessage[], opts: { stream: boolean }): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://antler.innovera.ai",
      "X-Title": "Antler"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_DEFS,
      stream: opts.stream
    })
  });
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const baseMessages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(userEmail) },
    ...body.messages.map((m) => ({ role: m.role, content: m.content }))
  ];

  let messageIndex = 0;
  for (const m of body.messages) {
    void logTurn(userEmail, messageIndex++, m.role, m.content);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const messages = [...baseMessages];
      try {
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          const isLastChance = turn === MAX_TOOL_TURNS - 1;
          // Non-streaming first to see if there are tool calls. We'll switch
          // to streaming once the model emits text without further tool calls.
          const r = await callOpenRouter(messages, { stream: false });
          if (!r.ok) {
            const errText = await r.text();
            emit(controller, {
              type: "error",
              message: `OpenRouter error (model ${MODEL}): ${r.status} ${errText.slice(0, 500)}`
            });
            controller.close();
            return;
          }
          const data = (await r.json()) as {
            choices: Array<{
              message: ChatMessage;
              finish_reason: string;
            }>;
          };
          const choice = data.choices?.[0];
          if (!choice) {
            emit(controller, { type: "error", message: "Empty response from model" });
            controller.close();
            return;
          }
          const msg = choice.message;
          messages.push(msg);

          if (msg.tool_calls && msg.tool_calls.length > 0 && !isLastChance) {
            for (const call of msg.tool_calls) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(call.function.arguments || "{}");
              } catch {
                args = {};
              }
              emit(controller, { type: "tool_start", id: call.id, name: call.function.name, args });
              const result = await executeTool(call.function.name, args);
              await logTurn(userEmail, messageIndex++, "tool", null, {
                name: call.function.name,
                args,
                result
              });
              emit(controller, { type: "tool_end", id: call.id, name: call.function.name });
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                name: call.function.name,
                content: JSON.stringify(result)
              });
            }
            continue;
          }

          // Final assistant message — emit text and finish.
          const text = msg.content ?? "";
          if (text) {
            // Emit in chunks for a nicer reveal even though we got it whole.
            const chunks = text.match(/.{1,40}(\s|$)|.+/g) ?? [text];
            for (const c of chunks) {
              emit(controller, { type: "text", value: c });
            }
          }
          await logTurn(userEmail, messageIndex++, "assistant", text);
          emit(controller, { type: "done" });
          controller.close();
          return;
        }
        emit(controller, {
          type: "error",
          message: `Stopped after ${MAX_TOOL_TURNS} tool turns without a final answer.`
        });
        controller.close();
      } catch (e) {
        emit(controller, {
          type: "error",
          message: e instanceof Error ? e.message : String(e)
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
