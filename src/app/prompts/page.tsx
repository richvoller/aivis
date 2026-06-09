import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { PromptManager } from "@/components/prompts/prompt-manager";
import { getCurrentBrand } from "@/lib/current-brand";
import { getPromptLastChecked, listPromptsWithConfig } from "@/lib/queries";

export default async function PromptsPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Prompt Manager" />
        <NoBrand />
      </>
    );
  }

  const [prompts, lastChecked] = await Promise.all([
    listPromptsWithConfig(brand.id),
    getPromptLastChecked(brand.id),
  ]);

  return (
    <>
      <PageHeader
        title="Prompt Manager"
        description={`Tracked prompts for ${brand.name}. Configure platforms/models and run on demand.`}
      />
      <PromptManager brandId={brand.id} prompts={prompts} lastChecked={lastChecked} />
    </>
  );
}
