"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toggleActionItem } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/types";

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "muted"> = {
  high: "destructive",
  medium: "secondary",
  low: "muted",
};

export function ActionItemList({ items }: { items: ActionItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActionItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ActionItemRow({ item }: { item: ActionItem }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card className={cn(item.is_done && "opacity-60")}>
      <CardContent className="flex items-start gap-4 p-5">
        <Switch
          checked={item.is_done}
          disabled={pending}
          onCheckedChange={(v) =>
            startTransition(async () => {
              await toggleActionItem(item.id, v);
              router.refresh();
            })
          }
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={cn("font-medium", item.is_done && "line-through")}>{item.title}</span>
            <Badge variant={SEVERITY_VARIANT[item.severity] ?? "muted"} className="capitalize">
              {item.severity}
            </Badge>
            {item.category && (
              <Badge variant="outline" className="capitalize">
                {item.category}
              </Badge>
            )}
          </div>
          {item.detail && <p className="text-sm text-muted-foreground">{item.detail}</p>}
        </div>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardContent>
    </Card>
  );
}
