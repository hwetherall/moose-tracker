"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X, Send, Loader2, Wrench } from "lucide-react";
import { MessageContent } from "./MessageContent";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };
type ToolCall = { id: string; name: string; status: "running" | "done" };

const PROMPTS = [
  "What should I look at first this morning?",
  "What's blocked right now?",
  "What is everyone working on for R17?",
  "Who has the most on their plate?"
];

export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<ToolCall[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming, activeTools]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;
      setError(null);
      const next: Message[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setStreaming(true);
      setActiveTools([]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
          signal: controller.signal
        });
        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed (${res.status})`);
        }
        // Insert empty assistant message we'll fill as text arrives.
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            let payload: { type: string; [k: string]: unknown };
            try {
              payload = JSON.parse(json);
            } catch {
              continue;
            }
            if (payload.type === "text") {
              const v = String(payload.value ?? "");
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + v };
                }
                return copy;
              });
            } else if (payload.type === "tool_start") {
              setActiveTools((t) => [
                ...t,
                { id: String(payload.id), name: String(payload.name), status: "running" }
              ]);
            } else if (payload.type === "tool_end") {
              setActiveTools((t) =>
                t.map((tc) => (tc.id === String(payload.id) ? { ...tc, status: "done" } : tc))
              );
            } else if (payload.type === "error") {
              setError(String(payload.message));
            } else if (payload.type === "done") {
              // no-op; loop will exit on stream end
            }
          }
        }
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming]
  );

  const empty = messages.length === 0;
  const toolList = useMemo(() => activeTools, [activeTools]);

  return (
    <>
      <button
        type="button"
        aria-label="Open chat"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-text-inverse shadow-lg transition-transform hover:scale-105"
        data-test-id="chat-launcher"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xl"
          style={{ height: "560px" }}
          role="dialog"
          aria-label="Ask about Antler"
        >
          <div className="border-t-[3px] border-brand" aria-hidden />
          <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h3 className="font-serif text-[15px] font-medium text-text-primary">Ask about Antler</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 scrollbar-thin">
            {empty ? (
              <div className="space-y-3">
                <p className="text-compact text-text-secondary">
                  Ask about owners, blockers, releases, or signals.
                </p>
                <div className="flex flex-col gap-1.5">
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p)}
                      className="rounded-md border border-border-subtle bg-bg-muted px-3 py-2 text-left text-compact text-text-secondary hover:border-border-medium hover:text-text-primary"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-md bg-brand-soft px-3 py-2 text-compact text-text-primary"
                      : "mr-6 text-compact text-text-primary"
                  }
                >
                  <MessageContent text={m.content} />
                  {m.role === "assistant" && i === messages.length - 1 && streaming && !m.content && (
                    <span className="text-text-tertiary">…</span>
                  )}
                </div>
              ))
            )}

            {streaming &&
              toolList.map((tc) => (
                <div
                  key={tc.id}
                  className="flex items-center gap-2 rounded-md bg-bg-muted px-2.5 py-1.5 text-label text-text-tertiary"
                >
                  {tc.status === "running" ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Wrench className="h-3 w-3" aria-hidden />
                  )}
                  <span className="font-mono">
                    {tc.status === "running" ? "Looking up" : "Looked up"} {humanizeTool(tc.name)}
                    {tc.status === "running" ? "…" : ""}
                  </span>
                </div>
              ))}

            {error && (
              <div className="rounded-md border border-status-blocked-soft bg-status-blocked-soft px-3 py-2 text-compact text-status-blocked-text">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border-subtle bg-bg-page px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              className="flex-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-compact text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              disabled={streaming}
              data-test-id="chat-input"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand text-text-inverse disabled:opacity-50"
              aria-label="Send"
            >
              {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function humanizeTool(name: string): string {
  switch (name) {
    case "list_items": return "matching items";
    case "find_items": return "items by name";
    case "get_item": return "item detail";
    case "who_owns": return "owner counts";
    case "whats_for": return "items for that person";
    case "whats_blocked": return "blocked items";
    case "release_status": return "release status";
    case "get_signals": return "current signals";
    case "list_people": return "the directory";
    default: return name;
  }
}
