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
import { listSovSnapshots } from "@/lib/queries";
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

  const snapshots = await listSovSnapshots(brand.id);
  const ownDomain = normaliseDomain(brand.domain);

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
  const rows = domains
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
        description={`Brand vs competitors in the LLM Mentions dataset for ${brand.name}.`}
      >
        <RunJobButton brandId={brand.id} job="mentions" label="Run benchmarking" />
      </PageHeader>

      {snapshots.length === 0 ? (
        <EmptyState
          title="No benchmarking data yet"
          description="Run the weekly mentions job to compute share of voice against your competitors."
        >
          <RunJobButton brandId={brand.id} job="mentions" label="Run benchmarking" />
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Share of Voice Over Time</CardTitle>
              <CardDescription>Percentage of mentions across tracked domains</CardDescription>
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
                  {rows.map((r) => (
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
        </div>
      )}
    </>
  );
}
