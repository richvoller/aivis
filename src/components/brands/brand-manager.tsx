"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Trash2, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { createBrand, deleteBrand, updateBrand } from "@/lib/actions";
import type { Brand } from "@/lib/types";

function BrandDialog({
  brand,
  trigger,
}: {
  brand?: Brand;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const res = brand ? await updateBrand(brand.id, formData) : await createBrand(formData);
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{brand ? "Edit brand" : "Add brand"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Brand name</Label>
            <Input id="name" name="name" defaultValue={brand?.name} placeholder="Acme CRM" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              name="domain"
              defaultValue={brand?.domain}
              placeholder="acmecrm.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={brand?.description ?? ""}
              placeholder="e.g. B2B CRM for small sales teams"
            />
            <p className="text-xs text-muted-foreground">
              Used by AI brand research and suggested prompts. Does not affect mention detection or
              API calls directly.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {brand ? "Save changes" : "Create brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteBrandButton({ brand }: { brand: Brand }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Delete brand"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete ${brand.name} and all its data? This cannot be undone.`)) return;
        startTransition(async () => {
          await deleteBrand(brand.id);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}

export function BrandManager({ brands }: { brands: Brand[] }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BrandDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" /> Add brand
            </Button>
          }
        />
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No brands yet. Add your first brand to start tracking.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{brand.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{brand.domain}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Link href={`/brands/${brand.id}`}>
                      <Button variant="ghost" size="icon" title="Brand settings">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                    <BrandDialog
                      brand={brand}
                      trigger={
                        <Button variant="ghost" size="icon" title="Edit brand">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DeleteBrandButton brand={brand} />
                  </div>
                </div>
                {brand.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {brand.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
