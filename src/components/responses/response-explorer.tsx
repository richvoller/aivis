"use client";

import * as React from "react";
import { Quote, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MentionBadge, PlatformBadge, SentimentBadge } from "@/components/badges";
import { PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/constants";
import { formatDateTime, normaliseDomain } from "@/lib/utils";
import type { ResponseSnapshot } from "@/lib/types";

function highlight(text: string, aliases: string[]): React.ReactNode {
  if (!aliases.length || !text) return text;
  const escaped = aliases
    .filter(Boolean)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    escaped.some((a) => new RegExp(`^${a}$`, "i").test(part)) ? (
      <mark key={i} className="rounded bg-primary/20 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export function ResponseExplorer({
  snapshots,
  promptMap,
  brandName,
  brandDomain,
}: {
  snapshots: ResponseSnapshot[];
  promptMap: Record<string, string>;
  brandName: string;
  brandDomain: string;
}) {
  const [platform, setPlatform] = React.useState<string>("all");
  const [mentioned, setMentioned] = React.useState<string>("all");
  const [sentiment, setSentiment] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<ResponseSnapshot | null>(null);

  const aliases = React.useMemo(
    () => [brandName, normaliseDomain(brandDomain).split(".")[0]].filter(Boolean),
    [brandName, brandDomain],
  );

  const filtered = snapshots.filter((s) => {
    if (platform !== "all" && s.platform !== platform) return false;
    if (mentioned === "yes" && !s.brand_mentioned) return false;
    if (mentioned === "no" && s.brand_mentioned) return false;
    if (sentiment !== "all" && s.brand_sentiment !== sentiment) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="Platform"
          value={platform}
          onChange={setPlatform}
          options={[
            { value: "all", label: "All platforms" },
            ...PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })),
          ]}
        />
        <FilterSelect
          label="Mention"
          value={mentioned}
          onChange={setMentioned}
          options={[
            { value: "all", label: "All" },
            { value: "yes", label: "Mentioned" },
            { value: "no", label: "Absent" },
          ]}
        />
        <FilterSelect
          label="Sentiment"
          value={sentiment}
          onChange={setSentiment}
          options={[
            { value: "all", label: "All" },
            { value: "positive", label: "Positive" },
            { value: "neutral", label: "Neutral" },
            { value: "negative", label: "Negative" },
          ]}
        />
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {snapshots.length} snapshots
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No snapshots match these filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Mention</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(s.fetched_at)}
                    </TableCell>
                    <TableCell>
                      <PlatformBadge platform={s.platform as Platform} />
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {s.prompt_id ? promptMap[s.prompt_id] ?? "—" : "—"}
                    </TableCell>
                    <TableCell>
                      <MentionBadge mentioned={s.brand_mentioned} />
                    </TableCell>
                    <TableCell>
                      <SentimentBadge sentiment={s.brand_sentiment} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PlatformBadge platform={selected.platform as Platform} />
                  <span className="text-sm font-normal text-muted-foreground">
                    {selected.model_name} · {formatDateTime(selected.fetched_at)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <MentionBadge mentioned={selected.brand_mentioned} />
                  <SentimentBadge sentiment={selected.brand_sentiment} />
                  {selected.prompt_id && promptMap[selected.prompt_id] && (
                    <Badge variant="outline">{promptMap[selected.prompt_id]}</Badge>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    Response
                  </p>
                  <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                    {highlight(selected.response_text ?? "", aliases)}
                  </div>
                </div>

                {selected.fan_out_queries?.length ? (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                      <Search className="h-3 w-3" /> Fan-out queries
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.fan_out_queries.map((q, i) => (
                        <Badge key={i} variant="secondary">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.competitors_mentioned?.length ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                      Known competitors mentioned
                    </p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      From your competitor list — used for share-of-voice benchmarking.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.competitors_mentioned.map((c, i) => (
                        <Badge key={i} variant="muted">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.entities_detected?.length ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                      Other brands detected
                    </p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Auto-detected from AI brand entities and cited domains — not limited to your
                      competitor list.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.entities_detected.map((e, i) => (
                        <Badge key={i} variant="secondary">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.cited_urls?.length ? (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                      <Quote className="h-3 w-3" /> Cited sources
                    </p>
                    <ul className="space-y-1 text-sm">
                      {selected.cited_urls.map((u, i) => (
                        <li key={i}>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {u}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
