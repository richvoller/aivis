"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addAllSuggestedPrompts, addSuggestedPrompt, suggestPrompts } from "@/lib/actions";
import type { SuggestedPrompt } from "@/lib/suggested-prompts";

export function SuggestedPromptsPanel({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [loading, startLoad] = React.useTransition();
  const [adding, startAdd] = React.useTransition();
  const [suggestions, setSuggestions] = React.useState<SuggestedPrompt[]>([]);
  const [source, setSource] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<Set<string>>(new Set());

  function load() {
    setError(null);
    startLoad(async () => {
      const res = await suggestPrompts(brandId);
      if (res.ok && res.suggestions) {
        setSuggestions(res.suggestions);
        setSource(res.source ?? null);
        setAdded(new Set());
      } else {
        setError(res.error ?? "Failed to generate suggestions");
      }
    });
  }

  function addOne(s: SuggestedPrompt) {
    startAdd(async () => {
      const res = await addSuggestedPrompt(brandId, s.prompt_text, s.category);
      if (res.ok) {
        setAdded((prev) => new Set(prev).add(s.prompt_text));
        router.refresh();
      } else {
        setError(res.error ?? "Failed to add prompt");
      }
    });
  }

  function addAll() {
    const remaining = suggestions.filter((s) => !added.has(s.prompt_text));
    if (!remaining.length) return;
    startAdd(async () => {
      const res = await addAllSuggestedPrompts(
        brandId,
        remaining.map((s) => ({ prompt_text: s.prompt_text, category: s.category })),
      );
      if (res.ok) {
        setAdded(new Set(suggestions.map((s) => s.prompt_text)));
        router.refresh();
      } else {
        setError(res.error ?? "Failed to add prompts");
      }
    });
  }

  const remainingCount = suggestions.filter((s) => !added.has(s.prompt_text)).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Suggested prompts
          </CardTitle>
          <CardDescription>
            Generated from your brand profile, industry, categories, and competitors — based on how
            people actually ask AI assistants.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading || adding}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {suggestions.length ? "Refresh suggestions" : "Suggest prompts"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {suggestions.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            Click <strong>Suggest prompts</strong> to generate tracking prompts from your brand
            knowledge. Fill in industry, categories, and competitors in brand settings for better
            results.
          </p>
        )}

        {source && suggestions.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Source: {source === "ai" ? "AI-generated from brand profile" : "Template-based from brand data"}
          </p>
        )}

        {suggestions.length > 0 && (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={addAll} disabled={adding || remainingCount === 0}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add all ({remainingCount})
              </Button>
            </div>
            <div className="space-y-2">
              {suggestions.map((s) => {
                const isAdded = added.has(s.prompt_text);
                return (
                  <div
                    key={s.prompt_text}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-snug">{s.prompt_text}</p>
                      <p className="text-xs text-muted-foreground">{s.rationale}</p>
                      <Badge variant="outline" className="capitalize">
                        {s.category}
                      </Badge>
                    </div>
                    <Button
                      variant={isAdded ? "secondary" : "outline"}
                      size="sm"
                      className="shrink-0"
                      disabled={adding || isAdded}
                      onClick={() => addOne(s)}
                    >
                      {isAdded ? "Added" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
