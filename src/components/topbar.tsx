import { BrandSwitcher } from "@/components/brand-switcher";
import { LoadDemoDataButton } from "@/components/load-demo-data-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import type { Brand } from "@/lib/types";

export function Topbar({
  brands,
  currentId,
  mockMode,
}: {
  brands: Pick<Brand, "id" | "name">[];
  currentId: string | null;
  mockMode: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
      <BrandSwitcher brands={brands} currentId={currentId} />
      <div className="flex items-center gap-3">
        <LoadDemoDataButton />
        {mockMode && (
          <Badge variant="muted" title="New API collections use mock responses instead of DataForSEO">
            Mock API
          </Badge>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
