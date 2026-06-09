"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createCompetitor, deleteCompetitor } from "@/lib/actions";
import type { Competitor } from "@/lib/types";

export function CompetitorManager({
  brandId,
  competitors,
}: {
  brandId: string;
  competitors: Competitor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function add(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createCompetitor(brandId, formData);
      if (res.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(res.error ?? "Failed to add competitor");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <form ref={formRef} action={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Competitor domain</label>
              <Input name="domain" placeholder="hubspot.com" required />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Display name (optional)</label>
              <Input name="name" placeholder="HubSpot" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {competitors.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No competitors yet. Add domains to benchmark share of voice.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((c) => (
                  <CompetitorRow key={c.id} competitor={c} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompetitorRow({ competitor }: { competitor: Competitor }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <TableRow>
      <TableCell className="font-medium">{competitor.domain}</TableCell>
      <TableCell className="text-muted-foreground">{competitor.name ?? "—"}</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteCompetitor(competitor.id);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}
