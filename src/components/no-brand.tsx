import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export function NoBrand() {
  return (
    <EmptyState
      icon={Building2}
      title="No brand selected"
      description="Create your first brand to start tracking AI visibility across ChatGPT, Claude, Gemini and Perplexity."
    >
      <Button asChild>
        <Link href="/brands">Create a brand</Link>
      </Button>
    </EmptyState>
  );
}
