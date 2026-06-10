import { CheckSquare, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { ActionItemList } from "@/components/action-items/action-item-list";
import { RefreshActionItemsButton } from "@/components/action-items/refresh-action-items-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentBrand } from "@/lib/current-brand";
import { listActionItems, listSnapshots } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export default async function ActionItemsPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Action Items" />
        <NoBrand />
      </>
    );
  }

  const [items, snapshots] = await Promise.all([
    listActionItems(brand.id),
    listSnapshots(brand.id, { limit: 1 }),
  ]);
  const open = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);
  const lastGenerated = open[0]?.created_at ?? null;
  const hasData = snapshots.length > 0;

  return (
    <>
      <PageHeader
        title="Action Items"
        description={`Prioritised recommendations from ${brand.name}'s collected response data.`}
      >
        <RefreshActionItemsButton brandId={brand.id} />
      </PageHeader>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-muted-foreground" />
            How recommendations work
          </CardTitle>
          <CardDescription>
            Generated locally from your snapshots — no extra API cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            After each response collection (or when you click Refresh), we analyse mention rates,
            platform gaps, citation patterns, competitor presence, prompt blind spots, and fan-out
            queries.
          </p>
          {lastGenerated ? (
            <p className="text-xs pt-1">
              Open items last updated: {formatDateTime(lastGenerated)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!hasData ? (
        <EmptyState
          icon={CheckSquare}
          title="No response data yet"
          description="Collect responses on your tracked prompts first. Recommendations will appear automatically after collection."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No recommendations yet"
          description="Click Refresh recommendations above to analyse your latest snapshots."
        >
          <RefreshActionItemsButton brandId={brand.id} />
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Open ({open.length})</h2>
            {open.length ? (
              <ActionItemList items={open} />
            ) : (
              <p className="text-sm text-muted-foreground">All caught up — nice work.</p>
            )}
          </div>
          {done.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Completed ({done.length})
              </h2>
              <ActionItemList items={done} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
