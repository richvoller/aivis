import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { RunJobButton } from "@/components/run-job-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentBrand } from "@/lib/current-brand";
import { listCitationDomains } from "@/lib/queries";

export default async function CitationsPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Citation Analysis" />
        <NoBrand />
      </>
    );
  }

  const domains = await listCitationDomains(brand.id);
  const ownCount = domains.filter((d) => d.is_own_domain).reduce((s, d) => s + (d.mention_count ?? 0), 0);
  const thirdPartyCount = domains
    .filter((d) => !d.is_own_domain)
    .reduce((s, d) => s + (d.mention_count ?? 0), 0);
  const total = ownCount + thirdPartyCount || 1;

  return (
    <>
      <PageHeader
        title="Citation Analysis"
        description={`Domains most cited by AI when answering prompts about ${brand.name}'s space.`}
      >
        <RunJobButton brandId={brand.id} job="mentions" label="Refresh citations" />
      </PageHeader>

      {domains.length === 0 ? (
        <EmptyState
          title="No citation data yet"
          description="Run the mentions job to discover which third-party pages AI models cite."
        >
          <RunJobButton brandId={brand.id} job="mentions" label="Refresh citations" />
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Own domain citations</p>
                <p className="text-2xl font-semibold">{ownCount}</p>
                <p className="text-xs text-muted-foreground">
                  {((ownCount / total) * 100).toFixed(0)}% of all citations
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Third-party citations</p>
                <p className="text-2xl font-semibold">{thirdPartyCount}</p>
                <p className="text-xs text-muted-foreground">
                  {((thirdPartyCount / total) * 100).toFixed(0)}% — citation gap opportunities
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Cited Domains</CardTitle>
              <CardDescription>
                Domains where competitors appear but you may not — prioritise these for coverage.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Citations</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.domain}</TableCell>
                      <TableCell>{d.mention_count ?? 0}</TableCell>
                      <TableCell>
                        {d.is_own_domain ? (
                          <Badge variant="success">Own</Badge>
                        ) : (
                          <Badge variant="muted">Third-party</Badge>
                        )}
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
