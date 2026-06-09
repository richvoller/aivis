"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminClient } from "./supabase/admin";
import { runMentionsForBrand, runPromptAllPlatforms, runResponsesForBrand } from "./engine";
import { DEFAULT_MODELS, PLATFORMS, PROMPT_CATEGORIES } from "./constants";
import { normaliseDomain } from "./utils";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
const brandSchema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z.string().min(1, "Domain is required"),
  description: z.string().optional(),
});

export async function createBrand(formData: FormData): Promise<ActionResult> {
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = getAdminClient();
  const { error } = await supabase.from("brands").insert({
    name: parsed.data.name,
    domain: normaliseDomain(parsed.data.domain),
    description: parsed.data.description ?? null,
  });
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBrand(brandId: string, formData: FormData): Promise<ActionResult> {
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("brands")
    .update({
      name: parsed.data.name,
      domain: normaliseDomain(parsed.data.domain),
      description: parsed.data.description ?? null,
    })
    .eq("id", brandId);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBrand(brandId: string): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("brands").delete().eq("id", brandId);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------
export async function createCompetitor(brandId: string, formData: FormData): Promise<ActionResult> {
  const domain = String(formData.get("domain") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!domain) return fail("Domain is required");

  const supabase = getAdminClient();
  const { error } = await supabase.from("competitors").insert({
    brand_id: brandId,
    domain: normaliseDomain(domain),
    name: name || null,
  });
  if (error) return fail(error.message);
  revalidatePath("/competitors");
  return { ok: true };
}

export async function deleteCompetitor(competitorId: string): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("competitors").delete().eq("id", competitorId);
  if (error) return fail(error.message);
  revalidatePath("/competitors");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const promptSchema = z.object({
  prompt_text: z.string().min(1, "Prompt text is required"),
  category: z.enum(PROMPT_CATEGORIES).optional(),
});

export async function createPrompt(brandId: string, formData: FormData): Promise<ActionResult> {
  const parsed = promptSchema.safeParse({
    prompt_text: formData.get("prompt_text"),
    category: (formData.get("category") as string) || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = getAdminClient();
  const { data: prompt, error } = await supabase
    .from("tracked_prompts")
    .insert({
      brand_id: brandId,
      prompt_text: parsed.data.prompt_text,
      category: parsed.data.category ?? null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  // Seed default per-platform model config for all four platforms
  const { error: cfgErr } = await supabase.from("prompt_platform_config").insert(
    PLATFORMS.map((platform) => ({
      prompt_id: prompt.id,
      platform,
      model_name: DEFAULT_MODELS[platform],
      is_active: true,
    })),
  );
  if (cfgErr) return fail(cfgErr.message);

  revalidatePath("/prompts");
  return { ok: true };
}

export async function updatePrompt(promptId: string, formData: FormData): Promise<ActionResult> {
  const parsed = promptSchema.safeParse({
    prompt_text: formData.get("prompt_text"),
    category: (formData.get("category") as string) || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("tracked_prompts")
    .update({
      prompt_text: parsed.data.prompt_text,
      category: parsed.data.category ?? null,
    })
    .eq("id", promptId);
  if (error) return fail(error.message);
  revalidatePath("/prompts");
  return { ok: true };
}

export async function togglePrompt(promptId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("tracked_prompts")
    .update({ is_active: isActive })
    .eq("id", promptId);
  if (error) return fail(error.message);
  revalidatePath("/prompts");
  return { ok: true };
}

export async function deletePrompt(promptId: string): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("tracked_prompts").delete().eq("id", promptId);
  if (error) return fail(error.message);
  revalidatePath("/prompts");
  return { ok: true };
}

export async function setPlatformConfig(
  promptId: string,
  platform: string,
  modelName: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("prompt_platform_config")
    .upsert(
      { prompt_id: promptId, platform, model_name: modelName, is_active: isActive },
      { onConflict: "prompt_id,platform" },
    );
  if (error) return fail(error.message);
  revalidatePath("/prompts");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Run Now + Jobs
// ---------------------------------------------------------------------------
export async function runPromptNow(promptId: string): Promise<ActionResult> {
  try {
    const rows = await runPromptAllPlatforms(promptId);
    revalidatePath("/prompts");
    revalidatePath("/responses");
    revalidatePath("/");
    return { ok: true, message: `Collected ${rows.length} responses` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Run failed");
  }
}

export async function runBrandResponses(brandId: string): Promise<ActionResult> {
  try {
    const count = await runResponsesForBrand(brandId);
    revalidatePath("/", "layout");
    return { ok: true, message: `Collected ${count} responses` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Job failed");
  }
}

export async function runBrandMentions(brandId: string): Promise<ActionResult> {
  try {
    await runMentionsForBrand(brandId);
    revalidatePath("/", "layout");
    return { ok: true, message: "Mentions benchmarking complete" };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Job failed");
  }
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------
export async function toggleActionItem(id: string, isDone: boolean): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("action_items").update({ is_done: isDone }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/action-items");
  return { ok: true };
}
