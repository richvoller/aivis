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
        description={`Competitor domains for ${brand.name}. These feed the weekly share-of-voice job.`}
      />
      <CompetitorManager brandId={brand.id} competitors={competitors} />
    </>
  );
}
