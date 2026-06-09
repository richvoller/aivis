import { PageHeader } from "@/components/page-header";
import { BrandManager } from "@/components/brands/brand-manager";
import { listBrands } from "@/lib/queries";

export default async function BrandsPage() {
  const brands = await listBrands();
  return (
    <>
      <PageHeader
        title="Brands"
        description="Create and manage the brands you track across AI platforms."
      />
      <BrandManager brands={brands} />
    </>
  );
}
