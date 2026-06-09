"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runBrandMentions, runBrandResponses } from "@/lib/actions";

export function RunJobButton({
  brandId,
  job,
  label,
  icon: Icon = RefreshCw,
}: {
  brandId: string;
  job: "responses" | "mentions";
  label: string;
  icon?: React.ElementType;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setMsg(null);
      const res =
        job === "responses" ? await runBrandResponses(brandId) : await runBrandMentions(brandId);
      setMsg(res.ok ? (res.message ?? "Done") : (res.error ?? "Failed"));
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button onClick={run} disabled={pending} variant="outline" size="sm">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}
