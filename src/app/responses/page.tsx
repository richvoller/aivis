import { PageHeader } from "@/components/page-header";
import { NoBrand } from "@/components/no-brand";
import { ResponseExplorer } from "@/components/responses/response-explorer";
import { getCurrentBrand } from "@/lib/current-brand";
import { listPromptsWithConfig, listSnapshots } from "@/lib/queries";

export default async function ResponsesPage() {
  const brand = await getCurrentBrand();
  if (!brand) {
    return (
      <>
        <PageHeader title="Response Explorer" />
        <NoBrand />
      </>
    );
  }

  const [snapshots, prompts] = await Promise.all([
    listSnapshots(brand.id, { limit: 500 }),
    listPromptsWithConfig(brand.id),
  ]);
  const promptMap = Object.fromEntries(prompts.map((p) => [p.id, p.prompt_text]));

  return (
    <>
      <PageHeader
        title="Response Explorer"
        description={`Browse and inspect raw LLM responses for ${brand.name}.`}
      />
      <ResponseExplorer
        snapshots={snapshots}
        promptMap={promptMap}
        brandName={brand.name}
        brandDomain={brand.domain}
      />
    </>
  );
}
