import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { ActionItemList } from "@/components/action-items/action-item-list";
import { getCurrentBrand } from "@/lib/current-brand";
import { listActionItems } from "@/lib/queries";

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

  const items = await listActionItems(brand.id);
  const open = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);

  return (
    <>
      <PageHeader
        title="Action Items"
        description={`Recommendations based on ${brand.name}'s visibility and citation gaps.`}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No action items yet"
          description="Recommendations are generated from gap analysis as data accumulates."
        />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Open ({open.length})</h2>
            {open.length ? (
              <ActionItemList items={open} />
            ) : (
              <p className="text-sm text-muted-foreground">All caught up.</p>
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
