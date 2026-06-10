"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadDemoData } from "@/lib/actions";

export function LoadDemoDataButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await loadDemoData();
      if (res.ok) {
        setMsg("Acme CRM ready — use the brand dropdown");
        router.refresh();
      } else {
        setMsg(res.error ?? "Failed");
      }
    });

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="hidden text-xs text-muted-foreground sm:inline">{msg}</span>}
      <Button
        onClick={run}
        disabled={pending}
        variant="outline"
        size="sm"
        title="Adds Acme CRM with 30 days of sample data. Your other brands are untouched."
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        Add Acme CRM demo
      </Button>
    </div>
  );
}
