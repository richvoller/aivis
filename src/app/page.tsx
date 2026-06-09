import { Activity, BarChart3, Gauge, Layers } from "lucide-react";
import { getCurrentBrand } from "@/lib/current-brand";
import { getOverview } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { NoBrand } from "@/components/no-brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VisibilityTrend } from "@/components/charts/visibility-trend";
import { PlatformDonut } from "@/components/charts/platform-donut";
import { PlatformBadge } from "@/components/badges";
import { RunJobButton } from "@/components/run-job-button";
import { formatDateTime, pct } from "@/lib/utils";

export default async function DashboardPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Dashboard" description="AI visibility overview" />
        <NoBrand />
      </>
    );
  }

  const overview = await getOverview(brand.id, 30);
  const { kpis, trend, breakdown } = overview;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`AI visibility for ${brand.name} (${brand.domain}) — last 30 days`}
      >
        <RunJobButton brandId={brand.id} job="responses" label="Collect responses" />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="AI Visibility Score"
          value={kpis.visibilityScore}
          sub="mention rate across all platforms"
          icon={Gauge}
        />
        <KpiCard
          label="Mention Rate"
          value={pct(kpis.mentionRate, 1)}
          sub={`${kpis.totalSnapshots} snapshots`}
          icon={Activity}
        />
        <KpiCard
          label="Platforms Tracked"
          value={kpis.platformsTracked}
          sub="ChatGPT · Claude · Gemini · Perplexity"
          icon={Layers}
        />
        <KpiCard
          label="Last Updated"
          value={kpis.lastUpdated ? formatDateTime(kpis.lastUpdated).split(",")[0] : "—"}
          sub={kpis.lastUpdated ? formatDateTime(kpis.lastUpdated) : "No data yet"}
          icon={BarChart3}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Visibility Trend</CardTitle>
            <CardDescription>Daily mention rate per platform</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length ? (
              <VisibilityTrend data={trend} />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No snapshots in the last 30 days
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Breakdown</CardTitle>
            <CardDescription>Mentions by platform</CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformDonut data={breakdown} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {breakdown.map((b) => (
          <Card key={b.platform}>
            <CardContent className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <PlatformBadge platform={b.platform} />
                <span className="text-sm font-semibold">{pct(b.rate)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {b.mentioned} of {b.total} responses mentioned the brand
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
