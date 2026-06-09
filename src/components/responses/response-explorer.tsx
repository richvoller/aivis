"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { collectAllCitations } from "@/lib/citations";
import { CitationsPanel } from "@/components/responses/citations-panel";
import { FormattedResponse } from "@/components/responses/formatted-response";
import { repairSnapshots } from "@/lib/actions";
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
  DialogDescription,
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

export function ResponseExplorer({
  brandId,
  snapshots,
  promptMap,
  brandName,
  brandDomain,
  brandAliases = [],
}: {
  brandId: string;
  snapshots: ResponseSnapshot[];
  promptMap: Record<string, string>;
  brandName: string;
  brandDomain: string;
  brandAliases?: string[];
}) {
  const router = useRouter();
  const [platform, setPlatform] = React.useState<string>("all");
  const [mentioned, setMentioned] = React.useState<string>("all");
  const [sentiment, setSentiment] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<ResponseSnapshot | null>(null);
  const [repairing, startRepair] = React.useTransition();
  const [repairMsg, setRepairMsg] = React.useState<string | null>(null);

  const aliases = React.useMemo(
    () =>
      [...new Set([brandName, normaliseDomain(brandDomain).split(".")[0], ...brandAliases])].filter(
        Boolean,
      ),
    [brandName, brandDomain, brandAliases],
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
        <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {repairMsg && <span className="text-xs">{repairMsg}</span>}
          <Button
            variant="outline"
            size="sm"
            disabled={repairing}
            onClick={() =>
              startRepair(async () => {
                setRepairMsg(null);
                const res = await repairSnapshots(brandId);
                setRepairMsg(res.ok ? (res.message ?? "Done") : (res.error ?? "Failed"));
                if (res.ok) router.refresh();
              })
            }
          >
            {repairing ? "Refreshing…" : "Refresh analysis"}
          </Button>
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
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          {selected && (
            <>
              <DialogHeader className="shrink-0 border-b px-6 py-4">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <PlatformBadge platform={selected.platform as Platform} />
                  <span className="text-sm font-normal text-muted-foreground">
                    {selected.model_name} · {formatDateTime(selected.fetched_at)}
                  </span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Full AI response with cited sources for this prompt snapshot.
                </DialogDescription>
                <div className="mt-2 flex flex-wrap gap-2">
                  <MentionBadge
                    mentioned={
                      selected.brand_mentioned ||
                      textMentionsBrand(selected.response_text ?? "", aliases)
                    }
                  />
                  <SentimentBadge sentiment={selected.brand_sentiment} />
                  {selected.prompt_id && promptMap[selected.prompt_id] && (
                    <Badge variant="outline" className="max-w-md truncate">
                      {promptMap[selected.prompt_id]}
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-5">
                <div className="flex min-h-0 flex-col border-b lg:col-span-3 lg:border-b-0 lg:border-r">
                  <p className="shrink-0 px-4 pt-4 text-xs font-medium uppercase text-muted-foreground">
                    Response
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <FormattedResponse
                      text={selected.response_text ?? ""}
                      aliases={aliases}
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-col p-4 lg:col-span-2">
                  <CitationsPanel
                    citations={collectAllCitations(
                      selected.response_text,
                      selected.cited_urls,
                      selected.raw_response,
                    )}
                  />
                </div>
              </div>

              {(selected.fan_out_queries?.length ||
                selected.competitors_mentioned?.length ||
                selected.entities_detected?.length) && (
                <div className="shrink-0 space-y-3 border-t px-6 py-4">
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
                      <div className="flex flex-wrap gap-1.5">
                        {selected.entities_detected.map((e, i) => (
                          <Badge key={i} variant="secondary">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function textMentionsBrand(text: string, aliases: string[]): boolean {
  if (!text.trim()) return false;
  const lower = text.toLowerCase();
  return aliases.some((alias) => alias && lower.includes(alias.toLowerCase()));
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
