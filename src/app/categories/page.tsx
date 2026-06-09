import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentBrand } from "@/lib/current-brand";
import { getCategoryPerformance } from "@/lib/queries";
import { pct } from "@/lib/utils";

export default async function CategoriesPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Category Performance" />
        <NoBrand />
      </>
    );
  }

  const categories = await getCategoryPerformance(brand.id);

  return (
    <>
      <PageHeader
        title="Category Performance"
        description="Visibility by prompt intent — identify the weakest category for this brand."
      />

      {categories.length === 0 ? (
        <EmptyState
          title="No category data yet"
          description="Tag prompts with a category and collect responses to see performance by intent."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.category}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium capitalize">{c.category}</span>
                  <span className="text-lg font-semibold">{pct(c.rate)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, c.rate)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.mentioned} of {c.total} responses mentioned the brand
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
