"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { selectBrand } from "@/lib/brand-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Brand } from "@/lib/types";

export function BrandSwitcher({
  brands,
  currentId,
}: {
  brands: Pick<Brand, "id" | "name">[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!brands.length) {
    return <span className="text-sm text-muted-foreground">No brands yet</span>;
  }

  return (
    <Select
      value={currentId ?? undefined}
      onValueChange={(value) =>
        startTransition(async () => {
          await selectBrand(value);
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-[200px]" disabled={pending}>
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Select brand" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {brands.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
