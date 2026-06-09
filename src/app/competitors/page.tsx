import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { CompetitorManager } from "@/components/competitors/competitor-manager";
import { getCurrentBrand } from "@/lib/current-brand";
import { listCompetitors } from "@/lib/queries";

export default async function CompetitorsPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Competitors" />
        <NoBrand />
      </>
    );
  }

  const competitors = await listCompetitors(brand.id);
  return (
    <>
      <PageHeader
        title="Competitors"
        description={`Known competitors for ${brand.name} — used for share-of-voice benchmarking and to flag when they appear in tracked responses.`}
      />
      <CompetitorManager brandId={brand.id} competitors={competitors} />
    </>
  );
}
