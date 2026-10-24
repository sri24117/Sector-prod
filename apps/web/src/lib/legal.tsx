import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

// /privacy and /terms render docs/legal/*.md, so the lawyer reviews the exact text people see.
// The pages are static: the file is read at build time (the web Dockerfile copies the whole repo
// into the build stage). Only the Markdown those documents use is supported: #, ##, ### headings,
// paragraphs, "- " lists, **bold**, `code`, [links](/x) and [[HUMAN DECISION REQUIRED: ...]] gaps.

export function readLegalDoc(file: "privacy-policy.md" | "terms-of-service.md"): string {
  return readFileSync(join(process.cwd(), "..", "..", "docs", "legal", file), "utf8");
}

const INLINE = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith("[[")) return <mark key={i} className="legal-gap">{part.slice(2, -2)}</mark>;
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
    return part;
  });
}

export function LegalDoc({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    if (items.length) blocks.push(<ul key={blocks.length}>{items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>);
    para = []; items = [];
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (!line) flush();
    else if (heading) {
      flush();
      const text = inline(heading[2]!);
      const level = heading[1]!.length;
      blocks.push(level === 1 ? <h1 key={blocks.length} className="headline">{text}</h1>
        : level === 2 ? <h2 key={blocks.length} className="section-heading">{text}</h2>
        : <h3 key={blocks.length} className="legal-subheading">{text}</h3>);
    } else if (line.startsWith("- ")) { if (para.length) flush(); items.push(line.slice(2)); }
    else { if (items.length) flush(); para.push(line); }
  }
  flush();
  return <article className="legal prose">{blocks}</article>;
}
