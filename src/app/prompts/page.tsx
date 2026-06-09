import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { PromptManager } from "@/components/prompts/prompt-manager";
import { SuggestedPromptsPanel } from "@/components/prompts/suggested-prompts-panel";
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
        description={`Tracked prompts for ${brand.name}. Start with suggested prompts, then configure platforms and run on demand.`}
      />
      <div className="space-y-6">
        <SuggestedPromptsPanel brandId={brand.id} />
        <PromptManager brandId={brand.id} prompts={prompts} lastChecked={lastChecked} />
      </div>
    </>
  );
}
