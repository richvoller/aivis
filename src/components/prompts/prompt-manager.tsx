"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Play, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPrompt,
  deletePrompt,
  runPromptNow,
  setPlatformConfig,
  togglePrompt,
  updatePrompt,
} from "@/lib/actions";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_MODEL_OPTIONS,
  PROMPT_CATEGORIES,
  type Platform,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { PlatformBadge } from "@/components/badges";
import type { PromptWithConfig } from "@/lib/types";

function PromptDialog({ prompt, trigger }: { prompt: PromptWithConfig; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState(prompt.category ?? "");

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    if (category) formData.set("category", category);
    const res = await updatePrompt(prompt.id, formData);
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
          <DialogTitle>Edit prompt</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt_text">Prompt text</Label>
            <Textarea
              id="prompt_text"
              name="prompt_text"
              defaultValue={prompt.prompt_text}
              placeholder="What is the best CRM for small businesses?"
              required
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {prompt ? "Save changes" : "Create prompt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfigDialog({ prompt }: { prompt: PromptWithConfig }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const configByPlatform = new Map(prompt.prompt_platform_config.map((c) => [c.platform, c]));

  function update(platform: Platform, model: string, isActive: boolean) {
    startTransition(async () => {
      await setPlatformConfig(prompt.id, platform, model, isActive);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Platform & model config">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Platform & model configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const cfg = configByPlatform.get(platform);
            const model = cfg?.model_name ?? PLATFORM_MODEL_OPTIONS[platform][0];
            const active = cfg?.is_active ?? true;
            return (
              <div
                key={platform}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={active}
                    onCheckedChange={(v) => update(platform, model, v)}
                    disabled={pending}
                  />
                  <span className="w-20 text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
                </div>
                <Select value={model} onValueChange={(m) => update(platform, m, active)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_MODEL_OPTIONS[platform].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunNowButton({ promptId }: { promptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            if (pollRef.current) clearInterval(pollRef.current);
            const res = await runPromptNow(promptId);
            setMsg(res.ok ? (res.message ?? "Started") : (res.error ?? "Failed"));
            if (res.ok) {
              router.refresh();
              pollRef.current = setInterval(() => router.refresh(), 15_000);
              setTimeout(() => {
                if (pollRef.current) clearInterval(pollRef.current);
              }, 300_000);
            }
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run now
      </Button>
    </div>
  );
}

function PromptCard({
  prompt,
  lastChecked,
}: {
  prompt: PromptWithConfig;
  lastChecked?: string;
}) {
  const router = useRouter();
  const [toggling, startToggle] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const activeConfigs = prompt.prompt_platform_config.filter((c) => c.is_active);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {prompt.category && (
                <Badge variant="secondary" className="capitalize">
                  {prompt.category}
                </Badge>
              )}
              <Badge variant={prompt.is_active ? "success" : "muted"}>
                {prompt.is_active ? "Active" : "Paused"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {lastChecked ? `Last checked ${formatDateTime(lastChecked)}` : "Never checked"}
              </span>
            </div>
            <p className="font-medium">{prompt.prompt_text}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeConfigs.length ? (
                activeConfigs.map((c) => <PlatformBadge key={c.id} platform={c.platform} />)
              ) : (
                <span className="text-xs text-muted-foreground">No active platforms</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <Switch
              checked={prompt.is_active}
              disabled={toggling}
              onCheckedChange={(v) =>
                startToggle(async () => {
                  await togglePrompt(prompt.id, v);
                  router.refresh();
                })
              }
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <RunNowButton promptId={prompt.id} />
          <div className="flex items-center">
            <ConfigDialog prompt={prompt} />
            <PromptDialog
              prompt={prompt}
              trigger={
                <Button variant="ghost" size="icon" title="Edit prompt">
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon"
              title="Delete prompt"
              disabled={deleting}
              onClick={() => {
                if (!confirm("Delete this prompt and its snapshots?")) return;
                startDelete(async () => {
                  await deletePrompt(prompt.id);
                  router.refresh();
                });
              }}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PromptManager({
  brandId,
  prompts,
  lastChecked,
}: {
  brandId: string;
  prompts: PromptWithConfig[];
  lastChecked: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddPrompt brandId={brandId} />
      </div>
      {prompts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No prompts yet. Use suggested prompts above, or add your own manually.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} lastChecked={lastChecked[p.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Add-prompt dialog that injects the brand id into the form. */
function AddPrompt({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    if (category) formData.set("category", category);
    const res = await createPrompt(brandId, formData);
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setCategory("");
      router.refresh();
    } else {
      setError(res.error ?? "Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add prompt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add prompt</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt_text_new">Prompt text</Label>
            <Textarea
              id="prompt_text_new"
              name="prompt_text"
              placeholder="What is the best CRM for small businesses?"
              required
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default models for all four platforms are configured automatically.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create prompt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
