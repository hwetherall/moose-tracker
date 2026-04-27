"use client";

import Link from "next/link";
import React from "react";

const ID_REF = /(#\d+)/g;

function inlineRender(text: string, keyPrefix: string): React.ReactNode[] {
  // Split out `#ID` references first, then process the literals for **bold** / *italic*.
  const parts = text.split(ID_REF);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      const id = part.slice(1);
      return (
        <Link
          key={`${keyPrefix}:ref:${idx}`}
          href={`/item/${id}`}
          prefetch={false}
          className="rounded-sm bg-bg-muted px-1 font-mono text-[12px] text-text-primary hover:bg-bg-inset"
        >
          {part}
        </Link>
      );
    }
    return <React.Fragment key={`${keyPrefix}:lit:${idx}`}>{renderEmphasis(part)}</React.Fragment>;
  });
}

function renderEmphasis(text: string): React.ReactNode {
  // Minimal **bold** / *italic*. No nesting required for our outputs.
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        out.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && end - i > 1) {
        out.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    const next = text.slice(i).search(/(\*\*|(?<!\*)\*(?!\*))/);
    if (next === -1) {
      out.push(text.slice(i));
      break;
    }
    out.push(text.slice(i, i + next));
    i += next;
  }
  return out;
}

export function MessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] | null = null;

  const flushBullets = () => {
    if (!bullets) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-0.5">
        {bullets.map((b, i) => (
          <li key={i}>{inlineRender(b, `b-${blocks.length}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = null;
  };

  lines.forEach((line, idx) => {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      bullets ??= [];
      bullets.push(m[1]);
      return;
    }
    flushBullets();
    if (!line.trim()) {
      blocks.push(<div key={`br-${idx}`} className="h-1.5" aria-hidden />);
      return;
    }
    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {inlineRender(line, `p-${idx}`)}
      </p>
    );
  });
  flushBullets();
  return <div className="space-y-1">{blocks}</div>;
}
