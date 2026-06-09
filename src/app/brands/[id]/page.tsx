import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { BrandSettings } from "@/components/brands/brand-settings";
import { getBrand } from "@/lib/queries";

export default async function BrandSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await getBrand(id);
  if (!brand) notFound();

  return (
    <>
      <PageHeader title={brand.name} description={`Brand settings and profile for ${brand.name}`} />
      <BrandSettings brand={brand} />
    </>
  );
}
