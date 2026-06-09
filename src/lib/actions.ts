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
// Brand profile actions
// ---------------------------------------------------------------------------
export async function reanalyzeBrand(brandId: string): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("name,domain,description")
    .eq("id", brandId)
    .single();
  if (error) return fail(error.message);

  // Set status to analyzing
  await supabase
    .from("brands")
    .update({ profile_status: "analyzing", profile_error: null })
    .eq("id", brandId);

  try {
    const { reanalyzeBrand: reanalyze } = await import("@/lib/research");
    const result = await reanalyze(brand.name, brand.domain, brand.description);

    if (result.error) {
      await supabase
        .from("brands")
        .update({ profile_status: "error", profile_error: result.error })
        .eq("id", brandId);
      return fail(result.error);
    }

    if (!result.profile) {
      await supabase
        .from("brands")
        .update({ profile_status: "error", profile_error: "No profile returned from AI" })
        .eq("id", brandId);
      return fail("No profile returned from AI");
    }

    // Update the brand with the extracted profile
    const { error: updateError } = await supabase
      .from("brands")
      .update({
        tagline: result.profile.tagline,
        value_proposition: result.profile.value_proposition,
        mission_statement: result.profile.mission_statement,
        industry: result.profile.industry,
        headquarters: result.profile.headquarters,
        founded_year: result.profile.founded_year,
        company_size: result.profile.company_size,
        products: result.profile.products,
        services: result.profile.services,
        key_facts: result.profile.key_facts,
        key_people: result.profile.key_people,
        research_sources: result.sources ?? result.profile.research_sources,
        brand_aliases: result.profile.brand_aliases,
        categories: result.profile.categories,
        content_language: result.profile.content_language,
        tone_of_voice: result.profile.tone_of_voice,
        writing_style: result.profile.writing_style,
        ai_image_style: result.profile.ai_image_style,
        banned_phrases: result.profile.banned_phrases,
        primary_country: result.profile.primary_country,
        primary_language: result.profile.primary_language,
        profile_status: "ready",
        profile_generated_at: new Date().toISOString(),
        profile_error: null,
      })
      .eq("id", brandId);

    if (updateError) return fail(updateError.message);

    revalidatePath("/brands/[id]", "layout");
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile analyzed and updated" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    await supabase
      .from("brands")
      .update({ profile_status: "error", profile_error: msg })
      .eq("id", brandId);
    return fail(msg);
  }
}

export async function updateBrandProfile(brandId: string, formData: FormData): Promise<ActionResult> {
  const supabase = getAdminClient();
  const data: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.endsWith("[]")) {
      const realKey = key.slice(0, -2);
      data[realKey] = formData.getAll(key);
    } else if (key.startsWith("products.") || key.startsWith("services.") || key.startsWith("key_facts.") || key.startsWith("key_people.") || key.startsWith("research_sources.")) {
      // Skip array-of-objects for now — handled by the page's specialised form
      continue;
    } else if (value === "") {
      data[key] = null;
    } else if (key === "founded_year") {
      data[key] = value ? Number(value) : null;
    } else {
      data[key] = value;
    }
  }

  const { error } = await supabase.from("brands").update(data).eq("id", brandId);
  if (error) return fail(error.message);
  revalidatePath("/brands/[id]", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Prompt generation from categories
// ---------------------------------------------------------------------------
export async function generatePromptsFromCategories(brandId: string): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("name,description,categories")
    .eq("id", brandId)
    .single();
  if (error) return fail(error.message);

  const categories = (brand as { categories?: string[] }).categories ?? [];
  if (categories.length === 0) return fail("No categories defined for this brand");

  const brandName = (brand as { name: string }).name;
  const brandDesc = (brand as { description: string | null }).description ?? "";

  // Generate prompts for each category
  const prompts = categories.map((cat) => {
    const basePrompt = `What are the best ${cat.toLowerCase()} options for ${brandName}?`;
    const enhancedPrompt = brandDesc
      ? `${basePrompt} ${brandName} is ${brandDesc}. Provide a comprehensive comparison.`
      : basePrompt;
    return {
      brand_id: brandId,
      prompt_text: enhancedPrompt,
      category: cat,
      is_active: true,
    };
  });

  const { error: insertError } = await supabase.from("tracked_prompts").insert(prompts);
  if (insertError) return fail(insertError.message);

  revalidatePath("/prompts", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: `Generated ${prompts.length} prompts from categories` };
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
// Suggested prompts
// ---------------------------------------------------------------------------
export async function suggestPrompts(brandId: string): Promise<
  ActionResult & { suggestions?: import("./suggested-prompts").SuggestedPrompt[]; source?: string }
> {
  const supabase = getAdminClient();
  const [{ data: brand, error: brandErr }, { data: competitors }, { data: prompts }] =
    await Promise.all([
      supabase.from("brands").select("*").eq("id", brandId).single(),
      supabase.from("competitors").select("*").eq("brand_id", brandId),
      supabase.from("tracked_prompts").select("prompt_text").eq("brand_id", brandId),
    ]);
  if (brandErr || !brand) return fail(brandErr?.message ?? "Brand not found");

  const { generateSuggestedPrompts } = await import("./suggested-prompts");
  const { suggestions, source } = await generateSuggestedPrompts(
    brand as import("./types").Brand,
    (competitors ?? []) as import("./types").Competitor[],
    (prompts ?? []).map((p) => p.prompt_text),
  );

  return { ok: true, suggestions, source, message: `Generated ${suggestions.length} suggestions` };
}

export async function addSuggestedPrompt(
  brandId: string,
  promptText: string,
  category: string,
): Promise<ActionResult> {
  const parsed = promptSchema.safeParse({ prompt_text: promptText, category });
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

export async function addAllSuggestedPrompts(
  brandId: string,
  items: { prompt_text: string; category: string }[],
): Promise<ActionResult> {
  let added = 0;
  for (const item of items) {
    const res = await addSuggestedPrompt(brandId, item.prompt_text, item.category);
    if (res.ok) added += 1;
  }
  revalidatePath("/prompts");
  return { ok: true, message: `Added ${added} prompt${added === 1 ? "" : "s"}` };
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
