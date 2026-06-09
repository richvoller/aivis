"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function highlightText(text: string, aliases: string[]): React.ReactNode {
  if (!aliases.length || !text) return text;
  const escaped = aliases
    .filter(Boolean)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    escaped.some((a) => new RegExp(`^${a}$`, "i").test(part)) ? (
      <mark key={i} className="rounded bg-primary/25 px-0.5 font-medium text-foreground">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

function wrapChildren(children: React.ReactNode, aliases: string[]): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") return highlightText(child, aliases);
    return child;
  });
}

const markdownBase =
  "text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2";

export function FormattedResponse({
  text,
  aliases = [],
}: {
  text: string;
  aliases?: string[];
}) {
  if (!text?.trim()) {
    return (
      <p className="text-sm text-muted-foreground">No response text available.</p>
    );
  }

  const components: React.ComponentProps<typeof ReactMarkdown>["components"] = {
    p: ({ children }) => (
      <p className="mb-3 last:mb-0">{wrapChildren(children, aliases)}</p>
    ),
    h1: ({ children }) => (
      <h1 className="mb-3 mt-4 text-lg font-semibold first:mt-0">
        {wrapChildren(children, aliases)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">
        {wrapChildren(children, aliases)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-3 text-sm font-semibold first:mt-0">
        {wrapChildren(children, aliases)}
      </h3>
    ),
    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
    li: ({ children }) => <li className="pl-0.5">{wrapChildren(children, aliases)}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold">{wrapChildren(children, aliases)}</strong>
    ),
    em: ({ children }) => <em className="italic">{wrapChildren(children, aliases)}</em>,
    blockquote: ({ children }) => (
      <blockquote className="mb-3 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-border" />,
    table: ({ children }) => (
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="border-b bg-muted/50">{children}</thead>,
    th: ({ children }) => (
      <th className="px-2 py-1.5 font-medium">{wrapChildren(children, aliases)}</th>
    ),
    td: ({ children }) => (
      <td className="border-t px-2 py-1.5 align-top">{wrapChildren(children, aliases)}</td>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    code: ({ className, children }) => {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <code className="block overflow-x-auto rounded bg-muted p-2 text-xs">{children}</code>
        );
      }
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
      );
    },
    pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3">{children}</pre>,
  };

  return (
    <div className={markdownBase}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export { collectAllCitations } from "@/lib/citations";
