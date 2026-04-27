"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkles, History, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState, useTransition } from "react";

type BriefCardProps = {
  briefId: number;
  briefDate: string;
  bodyHtml: string;
  generatedAt: string;
};

/**
 * Renders today's brief on the Overview. Cached HTML comes from the runner —
 * we splice #ID references with clickable chips client-side so links route
 * through the existing intercepting drawer route.
 */
export function BriefCard({ briefId, briefDate, bodyHtml, generatedAt }: BriefCardProps) {
  const html = useMemo(() => linkifyIdRefs(bodyHtml), [bodyHtml]);

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-badge uppercase tracking-[0.04em] text-text-tertiary">
            <Sparkles className="h-3 w-3" />
            <span>This morning</span>
            <span>·</span>
            <span>{briefDate}</span>
          </div>
          <h2 className="mt-1 font-serif text-section font-medium text-text-primary">
            Daily brief
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <BriefFeedback briefId={briefId} />
          <Link
            href={`/brief/${briefDate}`}
            prefetch={false}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-label text-text-secondary hover:bg-bg-muted hover:text-text-primary"
          >
            <History className="h-3 w-3" />
            View history
          </Link>
        </div>
      </header>
      <div
        className="prose-brief text-compact text-text-secondary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="mt-3 text-label text-text-tertiary">
        Generated {new Date(generatedAt).toLocaleString()}
      </p>
    </section>
  );
}

function BriefFeedback({ briefId }: { briefId: number }) {
  const [reaction, setReaction] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (r: "thumbs_up" | "thumbs_down") => {
    if (reaction === r) return;
    startTransition(async () => {
      await fetch("/api/agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "brief",
          target_id: String(briefId),
          reaction: r
        })
      });
      setReaction(r);
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Thumbs up"
        disabled={pending}
        onClick={() => submit("thumbs_up")}
        className={`rounded-md p-1 transition-colors ${
          reaction === "thumbs_up"
            ? "bg-bg-muted text-text-primary"
            : "text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
        }`}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label="Thumbs down"
        disabled={pending}
        onClick={() => submit("thumbs_down")}
        className={`rounded-md p-1 transition-colors ${
          reaction === "thumbs_down"
            ? "bg-bg-muted text-text-primary"
            : "text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
        }`}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * Replace `#123` in HTML with an anchor to /item/123. Skips occurrences inside
 * existing tags (so we don't double-wrap) by working only on text between '>'
 * and '<' boundaries.
 */
function linkifyIdRefs(html: string): string {
  return html.replace(
    />([^<]+)</g,
    (_, text: string) =>
      ">" +
      text.replace(/#(\d+)/g, (_m, id) => {
        return `<a href="/item/${id}" class="font-mono text-text-primary underline decoration-border-medium underline-offset-2 hover:text-brand">#${id}</a>`;
      }) +
      "<"
  );
}
