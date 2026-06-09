import Link from "next/link";
import { CalendarClock, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { RunJobButton } from "@/components/run-job-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SovChart, type SovSeriesPoint } from "@/components/charts/sov-chart";
import { getCurrentBrand } from "@/lib/current-brand";
import {
  getBenchmarkSchedule,
  listCompetitors,
  listSovSnapshots,
  getSnapshotSov,
} from "@/lib/queries";
import { formatDate, normaliseDomain, pct } from "@/lib/utils";

export default async function BenchmarkingPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Share of Voice" />
        <NoBrand />
      </>
    );
  }

  const [snapshots, competitors, schedule] = await Promise.all([
    listSovSnapshots(brand.id),
    listCompetitors(brand.id),
    getBenchmarkSchedule(brand.id),
  ]);
  const ownDomain = normaliseDomain(brand.domain);
  const responseSov = await getSnapshotSov(brand.id, brand, competitors);
  const hasMentionsDataset = snapshots.length > 0;
  const hasResponseSov = responseSov.some((r) => r.mentions > 0);

  // Pivot into chart series: one row per date, one key per domain
  const dates = [...new Set(snapshots.map((s) => s.snapshot_date))].sort();
  const domains = [...new Set(snapshots.map((s) => s.domain))];
  const series: SovSeriesPoint[] = dates.map((date) => {
    const point: SovSeriesPoint = { date: formatDate(date) };
    for (const d of domains) {
      const row = snapshots.find((s) => s.snapshot_date === date && s.domain === d);
      point[d] = row?.share_of_voice ? Number(row.share_of_voice.toFixed(1)) : 0;
    }
    return point;
  });

  // Latest + previous snapshot per domain for the table + delta
  const latestDate = dates.at(-1);
  const prevDate = dates.at(-2);
  const mentionsRows = domains
    .map((domain) => {
      const latest = snapshots.find((s) => s.snapshot_date === latestDate && s.domain === domain);
      const prev = snapshots.find((s) => s.snapshot_date === prevDate && s.domain === domain);
      const sov = latest?.share_of_voice ?? 0;
      const delta = sov - (prev?.share_of_voice ?? sov);
      return {
        domain,
        isOwn: normaliseDomain(domain) === ownDomain,
        mentions: latest?.mention_count ?? 0,
        sov,
        delta,
      };
    })
    .sort((a, b) => b.sov - a.sov);

  return (
    <>
      <PageHeader
        title="Share of Voice"
        description="Industry mention data from the LLM Mentions API — run manually on a schedule."
      >
        <RunJobButton brandId={brand.id} job="mentions" label="Run benchmarking" />
      </PageHeader>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            When to run
          </CardTitle>
          <CardDescription>
            Benchmarking is not automatic — you control when industry data is refreshed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{schedule.recommendation}</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong className="font-medium text-foreground">First time:</strong> after your
              initial response collection, to set a baseline.
            </li>
            <li>
              <strong className="font-medium text-foreground">Ongoing:</strong> weekly or monthly —
              whichever matches how often you re-scan prompts.
            </li>
            <li>
              <strong className="font-medium text-foreground">Between runs:</strong> Share of Voice
              from your{" "}
              <Link href="/responses" className="text-primary underline-offset-4 hover:underline">
                collected responses
              </Link>{" "}
              updates automatically whenever you collect — no extra API cost.
            </li>
          </ul>
          {schedule.lastRunDate ? (
            <p className="pt-1 text-xs">
              Last industry benchmark: {formatDate(schedule.lastRunDate)}
              {schedule.runCount > 1 ? ` (${schedule.runCount} snapshots on record)` : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!hasMentionsDataset && !hasResponseSov ? (
        <EmptyState
          title="No benchmarking data yet"
          description="Collect responses first, then run benchmarking here once to pull industry mention data."
        >
          <RunJobButton brandId={brand.id} job="mentions" label="Run benchmarking" />
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {!hasMentionsDataset && hasResponseSov ? (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Showing Share of Voice from your collected responses below. Run benchmarking above
                when you want industry-wide mention data from Google AI Overview.
              </p>
            </div>
          ) : null}

          {hasMentionsDataset ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Share of Voice Over Time</CardTitle>
                  <CardDescription>
                    Industry dataset — percentage of mentions across tracked domains
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SovChart data={series} domains={domains} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Mentions</TableHead>
                        <TableHead>Share of Voice</TableHead>
                        <TableHead>Weekly change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mentionsRows.map((r) => (
                        <TableRow key={r.domain}>
                          <TableCell className="font-medium">
                            {r.domain}
                            {r.isOwn && (
                              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                You
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{r.mentions}</TableCell>
                          <TableCell>{pct(r.sov, 1)}</TableCell>
                          <TableCell
                            className={
                              r.delta > 0
                                ? "text-green-600"
                                : r.delta < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {r.delta > 0 ? "+" : ""}
                            {r.delta.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}

          {hasResponseSov ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {hasMentionsDataset ? "Your collected responses" : "Share of Voice from responses"}
                </CardTitle>
                <CardDescription>
                  How often your brand and known competitors appear in tracked prompt answers —
                  updated whenever you collect responses
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Responses mentioning</TableHead>
                      <TableHead>Share of Voice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responseSov.map((r) => (
                      <TableRow key={r.domain}>
                        <TableCell className="font-medium">
                          {r.domain}
                          {r.is_own && (
                            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                              You
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{r.mentions}</TableCell>
                        <TableCell>{pct(r.share_of_voice, 1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
