"use client";

import { ExternalLink, Link2 } from "lucide-react";
import type { CitationLink } from "@/lib/citations";
import { normaliseDomain } from "@/lib/utils";

export function CitationsPanel({ citations }: { citations: CitationLink[] }) {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cited URLs
        </p>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {citations.length}
        </span>
      </div>

      <div className="max-h-[min(420px,50vh)] flex-1 overflow-y-auto p-2">
        {citations.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No cited URLs in this response.</p>
        ) : (
          <ul className="space-y-1">
            {citations.map((citation, i) => (
              <li key={citation.url}>
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  <span className="min-w-0 break-all">
                    {citation.title ? (
                      <span className="block font-medium text-foreground group-hover:text-primary">
                        {citation.title}
                      </span>
                    ) : (
                      <span className="block font-medium text-foreground group-hover:text-primary">
                        {normaliseDomain(citation.url)}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">{citation.url}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
