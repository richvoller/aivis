import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getSnapshotCitationDomains, listCitationDomains } from "@/lib/queries";

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

  const [mentionsDomains, responseDomains] = await Promise.all([
    listCitationDomains(brand.id),
    getSnapshotCitationDomains(brand.id, brand.domain),
  ]);

  const usingResponseData =
    responseDomains.length > 0 && responseDomains.length >= mentionsDomains.length;
  const domains = usingResponseData
    ? responseDomains.map((d) => ({
        id: d.domain,
        domain: d.domain,
        mention_count: d.mention_count,
        is_own_domain: d.is_own_domain,
      }))
    : mentionsDomains;

  const ownCount = domains.filter((d) => d.is_own_domain).reduce((s, d) => s + (d.mention_count ?? 0), 0);
  const thirdPartyCount = domains
    .filter((d) => !d.is_own_domain)
    .reduce((s, d) => s + (d.mention_count ?? 0), 0);
  const total = ownCount + thirdPartyCount || 1;

  return (
    <>
      <PageHeader
        title="Citation Analysis"
        description={
          usingResponseData
            ? `Domains cited in your collected LLM responses for ${brand.name}'s prompts.`
            : `Domains most cited by AI when answering prompts about ${brand.name}'s space.`
        }
      />

      {domains.length === 0 ? (
        <EmptyState
          title="No citation data yet"
          description="Collect responses to see cited domains from your tracked prompts. For industry citation data, run benchmarking manually on a weekly or monthly schedule."
        />
      ) : (
        <div className="space-y-4">
          {usingResponseData ? (
            <p className="text-sm text-muted-foreground">
              From your collected responses. Industry citation data is refreshed via{" "}
              <Link href="/benchmarking" className="text-primary underline-offset-4 hover:underline">
                Share of Voice benchmarking
              </Link>{" "}
              (manual, weekly or monthly).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Industry dataset — last refreshed when you ran{" "}
              <Link href="/benchmarking" className="text-primary underline-offset-4 hover:underline">
                benchmarking
              </Link>
              . Re-run there on your usual schedule.
            </p>
          )}

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
                {usingResponseData
                  ? "Aggregated from URLs cited across your collected responses."
                  : "Industry dataset — domains where competitors appear but you may not."}
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

          {usingResponseData ? (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href="/benchmarking">Industry data → Benchmarking</Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
