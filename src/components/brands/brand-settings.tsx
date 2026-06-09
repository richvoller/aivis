"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { reanalyzeBrand, updateBrandProfile, generatePromptsFromCategories } from "@/lib/actions";
import { formatDate } from "@/lib/utils";
import type { Brand } from "@/lib/types";

export function BrandSettings({
  brand,
  aiKeysConfigured,
}: {
  brand: Brand;
  aiKeysConfigured: boolean;
}) {
  const router = useRouter();
  const [analyzing, startAnalyze] = React.useTransition();
  const [saving, startSave] = React.useTransition();
  const [generating, startGenerate] = React.useTransition();
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleReanalyze() {
    startAnalyze(async () => {
      setSaveMsg(null);
      const res = await reanalyzeBrand(brand.id);
      setSaveMsg(res.ok ? (res.message ?? "Profile updated") : (res.error ?? "Failed"));
      if (res.ok) router.refresh();
    });
  }

  function handleGeneratePrompts() {
    startGenerate(async () => {
      setSaveMsg(null);
      const res = await generatePromptsFromCategories(brand.id);
      setSaveMsg(res.ok ? (res.message ?? "Prompts generated") : (res.error ?? "Failed"));
      if (res.ok) router.refresh();
    });
  }

  function handleSave(formData: FormData) {
    setSaveMsg(null);
    startSave(async () => {
      const res = await updateBrandProfile(brand.id, formData);
      setSaveMsg(res.ok ? "Profile saved" : (res.error ?? "Failed to save"));
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge
            variant={
              brand.profile_status === "ready"
                ? "success"
                : brand.profile_status === "error"
                  ? "destructive"
                  : brand.profile_status === "analyzing"
                    ? "secondary"
                    : "muted"
            }
          >
            Profile: {brand.profile_status}
          </Badge>
          {brand.profile_generated_at && (
            <span className="text-xs text-muted-foreground">
              Analyzed {formatDate(brand.profile_generated_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm text-muted-foreground">{saveMsg}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            disabled={analyzing || !aiKeysConfigured}
            title={
              !aiKeysConfigured
                ? "Add PERPLEXITY_API_KEY and OPENAI_API_KEY to .env.local"
                : "Re-analyze brand using AI"
            }
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-analyze (AI)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePrompts}
            disabled={generating || !brand.categories.length}
            title="Generate prompts from brand categories"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate Prompts
          </Button>
        </div>
      </div>

      {brand.profile_error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{brand.profile_error}</CardContent>
        </Card>
      )}

      <form ref={formRef} action={handleSave} className="space-y-6">
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        </div>

        {/* Brand Information */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
            <CardDescription>Core brand identity and positioning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" name="tagline" defaultValue={brand.tagline ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value_proposition">Value Proposition</Label>
              <Textarea
                id="value_proposition"
                name="value_proposition"
                defaultValue={brand.value_proposition ?? ""}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mission_statement">Mission Statement</Label>
              <Textarea
                id="mission_statement"
                name="mission_statement"
                defaultValue={brand.mission_statement ?? ""}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Industry, location, founding year, and size.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" defaultValue={brand.industry ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="headquarters">Headquarters</Label>
              <Input id="headquarters" name="headquarters" defaultValue={brand.headquarters ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="founded_year">Founded Year</Label>
              <Input
                id="founded_year"
                name="founded_year"
                type="number"
                defaultValue={brand.founded_year ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company_size">Company Size</Label>
              <Input
                id="company_size"
                name="company_size"
                placeholder="e.g., 2-10, 11-50, 51-200"
                defaultValue={brand.company_size ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        {/* Products & Services */}
        <Card>
          <CardHeader>
            <CardTitle>Products & Services</CardTitle>
            <CardDescription>Key offerings your brand provides.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProductsSection items={brand.products} fieldName="products" />
            <Separator />
            <ProductsSection items={brand.services} fieldName="services" />
          </CardContent>
        </Card>

        {/* Key Facts & People */}
        <Card>
          <CardHeader>
            <CardTitle>Key Facts & People</CardTitle>
            <CardDescription>Important facts and key people at your company.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KeyFactsSection items={brand.key_facts} />
            <Separator />
            <KeyPeopleSection items={brand.key_people} />
          </CardContent>
        </Card>

        {/* Detection & Prompt Generation */}
        <Card>
          <CardHeader>
            <CardTitle>Detection & Prompt Generation</CardTitle>
            <CardDescription>Aliases for mention detection and categories for auto-generated prompts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ArrayInputSection
              label="Brand Aliases"
              description="Alternative names, legal entity names, or variations to detect mentions."
              items={brand.brand_aliases}
              fieldName="brand_aliases"
            />
            <Separator />
            <ArrayInputSection
              label="Categories"
              description="Market topics for auto-generating prompts (e.g. CRM, sales automation). Separate from prompt intent categories on the Prompts page."
              items={brand.categories}
              fieldName="categories"
            />
          </CardContent>
        </Card>

        {/* Content Generation Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Content Generation Preferences</CardTitle>
            <CardDescription>Customize how AI generates content for your brand.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="content_language">Content Language</Label>
              <Input
                id="content_language"
                name="content_language"
                defaultValue={brand.content_language ?? "English"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tone_of_voice">Tone of Voice</Label>
              <Input
                id="tone_of_voice"
                name="tone_of_voice"
                defaultValue={brand.tone_of_voice ?? "Professional"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="writing_style">Writing Style</Label>
              <Input id="writing_style" name="writing_style" defaultValue={brand.writing_style ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai_image_style">AI Image Style</Label>
              <Input
                id="ai_image_style"
                name="ai_image_style"
                defaultValue={brand.ai_image_style ?? "Default style"}
              />
            </div>
            <ArrayInputSection
              label="Banned Phrases"
              description="Phrases to avoid in AI-generated content."
              items={brand.banned_phrases}
              fieldName="banned_phrases"
            />
          </CardContent>
        </Card>

        {/* Default Location & Language */}
        <Card>
          <CardHeader>
            <CardTitle>Default Location & Language</CardTitle>
            <CardDescription>Defaults used for new reports and content generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="primary_country">Primary Country</Label>
              <Input
                id="primary_country"
                name="primary_country"
                defaultValue={brand.primary_country ?? "United Kingdom"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="primary_language">Primary Language</Label>
              <Input
                id="primary_language"
                name="primary_language"
                defaultValue={brand.primary_language ?? "English"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Research Sources (read-only, populated by AI) */}
        {brand.research_sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Research Sources</CardTitle>
              <CardDescription>Sources used by the AI during brand analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {brand.research_sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline-offset-2 hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}

function ProductsSection({
  items,
  fieldName,
}: {
  items: Array<{ name: string; description: string }>;
  fieldName: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="capitalize">{fieldName}</Label>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {fieldName} added yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded border p-3 text-sm">
              <p className="font-medium">{item.name}</p>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyFactsSection({ items }: { items: Array<{ fact: string; source_url: string | null }> }) {
  return (
    <div className="space-y-3">
      <Label>Key Facts</Label>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No key facts added yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((f, i) => (
            <li key={i} className="rounded border p-3">
              <p>{f.fact}</p>
              {f.source_url && (
                <a
                  href={f.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  {f.source_url}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyPeopleSection({ items }: { items: Array<{ name: string; role: string }> }) {
  return (
    <div className="space-y-3">
      <Label>Key People</Label>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No key people added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((p, i) => (
            <Badge key={i} variant="secondary">
              {p.name} — {p.role}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrayInputSection({
  label,
  description,
  items,
  fieldName,
}: {
  label: string;
  description?: string;
  items: string[];
  fieldName: string;
}) {
  const [localItems, setLocalItems] = React.useState(items);
  const [newItem, setNewItem] = React.useState("");

  function add() {
    if (!newItem.trim()) return;
    setLocalItems([...localItems, newItem.trim()]);
    setNewItem("");
  }

  function remove(index: number) {
    setLocalItems(localItems.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={`Add ${label.toLowerCase()}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <Button type="button" size="icon" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {localItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {localItems.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {item}
              <button
                type="button"
                onClick={() => remove(i)}
                className="hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {/* Hidden inputs for form submission */}
      {localItems.map((item, i) => (
        <input
          key={i}
          type="hidden"
          name={`${fieldName}[]`}
          value={item}
        />
      ))}
    </div>
  );
}
