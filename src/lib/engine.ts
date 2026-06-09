import "server-only";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "./supabase/admin";
import {
  getCrossAggregated,
  getLLMResponse,
  getTopDomains,
  normaliseLlmResponse,
  searchMentions,
  type BrandContext,
} from "./dataforseo/client";
import { collectAllCitations } from "./citations";
import { parseResponse } from "./parser";
import type { Platform } from "./constants";
import { DEFAULT_MODELS, PLATFORMS } from "./constants";
import { normaliseDomain } from "./utils";
import type { Brand, Competitor, ResponseSnapshot } from "./types";

interface PromptRow {
  id: string;
  prompt_text: string;
  brand_id: string;
}

interface PlatformTarget {
  platform: Platform;
  modelName: string;
}

/** DataForSEO allows ~30 simultaneous — default 8 to stay safe. */
const COLLECTION_CONCURRENCY = Math.max(
  1,
  Math.min(30, Number(process.env.DATAFORSEO_CONCURRENCY ?? 8)),
);

function enrichSignalsFromRaw(
  signals: ReturnType<typeof parseResponse>,
  raw: unknown,
): ReturnType<typeof parseResponse> {
  const citations = collectAllCitations(signals.response_text, signals.cited_urls, raw);
  return {
    ...signals,
    cited_urls: citations.map((c) => c.url),
  };
}

async function loadBrandContext(brandId: string): Promise<{
  brand: Brand;
  competitors: Competitor[];
  ctx: BrandContext;
}> {
  const supabase = getAdminClient();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();
  if (error) throw error;

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("brand_id", brandId);

  const comps = (competitors ?? []) as Competitor[];
  const ctx: BrandContext = {
    brandName: (brand as Brand).name,
    brandDomain: (brand as Brand).domain,
    competitorNames: comps.map((c) => c.name ?? normaliseDomain(c.domain)),
  };
  return { brand: brand as Brand, competitors: comps, ctx };
}

/** Run tasks with a fixed concurrency pool. */
async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = COLLECTION_CONCURRENCY,
): Promise<void> {
  if (!items.length) return;
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function runPromptPlatformWithContext(args: {
  prompt: PromptRow;
  platform: Platform;
  modelName: string;
  brand: Brand;
  competitors: Competitor[];
  ctx: BrandContext;
}): Promise<ResponseSnapshot> {
  const supabase = getAdminClient();

  const res = await getLLMResponse(
    {
      platform: args.platform,
      model_name: args.modelName,
      user_prompt: args.prompt.prompt_text,
    },
    args.ctx,
  );

  const signals = enrichSignalsFromRaw(
    parseResponse(res, {
      brandName: args.brand.name,
      brandDomain: args.brand.domain,
      brandAliases: args.brand.brand_aliases ?? [],
      competitors: args.competitors.map((c) => ({ domain: c.domain, name: c.name })),
    }),
    res.raw,
  );

  const { data, error } = await supabase
    .from("response_snapshots")
    .insert({
      brand_id: args.brand.id,
      prompt_id: args.prompt.id,
      platform: args.platform,
      model_name: args.modelName,
      brand_mentioned: signals.brand_mentioned,
      brand_sentiment: signals.brand_sentiment,
      brand_position: signals.brand_position,
      response_text: signals.response_text,
      competitors_mentioned: signals.competitors_mentioned,
      entities_detected: signals.entities_detected,
      cited_urls: signals.cited_urls,
      fan_out_queries: signals.fan_out_queries,
      raw_response: res.raw,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ResponseSnapshot;
}

export async function runPromptPlatform(args: {
  prompt: PromptRow;
  platform: Platform;
  modelName: string;
}): Promise<ResponseSnapshot> {
  const { brand, competitors, ctx } = await loadBrandContext(args.prompt.brand_id);
  return runPromptPlatformWithContext({ ...args, brand, competitors, ctx });
}

function platformTargets(
  configs: Array<{ platform: Platform; model_name: string; is_active: boolean }>,
): PlatformTarget[] {
  const active = configs.filter((c) => c.is_active);
  return active.length
    ? active.map((c) => ({ platform: c.platform, modelName: c.model_name }))
    : PLATFORMS.map((platform) => ({ platform, modelName: DEFAULT_MODELS[platform] }));
}

/** Run one prompt across all its active platform configs (parallel). */
export async function runPromptAllPlatforms(promptId: string): Promise<ResponseSnapshot[]> {
  const supabase = getAdminClient();
  const { data: prompt, error } = await supabase
    .from("tracked_prompts")
    .select("id, prompt_text, brand_id, prompt_platform_config(*)")
    .eq("id", promptId)
    .single();
  if (error) throw error;

  const row = prompt as PromptRow & {
    prompt_platform_config?: Array<{ platform: Platform; model_name: string; is_active: boolean }>;
  };
  const targets = platformTargets(row.prompt_platform_config ?? []);
  const { brand, competitors, ctx } = await loadBrandContext(row.brand_id);

  const results: ResponseSnapshot[] = [];
  await runPool(targets, async (t) => {
    const snapshot = await runPromptPlatformWithContext({
      prompt: { id: row.id, prompt_text: row.prompt_text, brand_id: row.brand_id },
      platform: t.platform,
      modelName: t.modelName,
      brand,
      competitors,
      ctx,
    });
    results.push(snapshot);
  });

  return results;
}

/** Run every active prompt for a brand across all platforms (parallel, bounded). */
export async function runResponsesForBrand(brandId: string): Promise<number> {
  const supabase = getAdminClient();
  const { data: prompts, error } = await supabase
    .from("tracked_prompts")
    .select("id, prompt_text, brand_id, prompt_platform_config(*)")
    .eq("brand_id", brandId)
    .eq("is_active", true);
  if (error) throw error;

  const { brand, competitors, ctx } = await loadBrandContext(brandId);

  type Job = { prompt: PromptRow; platform: Platform; modelName: string };
  const jobs: Job[] = [];

  for (const p of prompts ?? []) {
    const row = p as PromptRow & {
      prompt_platform_config?: Array<{ platform: Platform; model_name: string; is_active: boolean }>;
    };
    for (const t of platformTargets(row.prompt_platform_config ?? [])) {
      jobs.push({
        prompt: { id: row.id, prompt_text: row.prompt_text, brand_id: row.brand_id },
        platform: t.platform,
        modelName: t.modelName,
      });
    }
  }

  let count = 0;
  const total = jobs.length;
  console.log(`[collection] Starting ${total} API calls (${COLLECTION_CONCURRENCY} parallel) for brand ${brandId}`);

  await runPool(jobs, async (job) => {
    await runPromptPlatformWithContext({
      prompt: job.prompt,
      platform: job.platform,
      modelName: job.modelName,
      brand,
      competitors,
      ctx,
    });
    count += 1;
    console.log(`[collection] ${count}/${total} — ${job.platform} done`);
  });

  console.log(`[collection] Finished ${count} snapshots for brand ${brandId}`);
  return count;
}

/**
 * Re-extract response_text and signals from stored raw_response JSON.
 * Fixes snapshots collected before the sections parser / chat_gpt path fix.
 */
export async function reparseSnapshotsForBrand(brandId: string): Promise<number> {
  const supabase = getAdminClient();
  const { brand, competitors } = await loadBrandContext(brandId);

  const { data: snapshots, error } = await supabase
    .from("response_snapshots")
    .select("id, platform, model_name, raw_response, response_text")
    .eq("brand_id", brandId);
  if (error) throw error;

  let updated = 0;
  for (const row of snapshots ?? []) {
    const raw = row.raw_response;
    if (!raw) continue;

    const task = (raw as { tasks?: Array<{ status_code?: number }> }).tasks?.[0];
    if (task?.status_code && task.status_code !== 20000) continue;

    const normalised = normaliseLlmResponse(
      row.platform as Platform,
      row.model_name,
      raw,
    );
    if (!normalised.response_text?.trim()) continue;

    const signals = enrichSignalsFromRaw(
      parseResponse(normalised, {
        brandName: brand.name,
        brandDomain: brand.domain,
        brandAliases: brand.brand_aliases ?? [],
        competitors: competitors.map((c) => ({ domain: c.domain, name: c.name })),
      }),
      raw,
    );

    await supabase
      .from("response_snapshots")
      .update({
        response_text: signals.response_text,
        brand_mentioned: signals.brand_mentioned,
        brand_sentiment: signals.brand_sentiment,
        brand_position: signals.brand_position,
        competitors_mentioned: signals.competitors_mentioned,
        entities_detected: signals.entities_detected,
        cited_urls: signals.cited_urls,
        fan_out_queries: signals.fan_out_queries,
      })
      .eq("id", row.id);

    updated += 1;
  }

  console.log(`[collection] Reparsed ${updated} snapshots for brand ${brandId}`);
  return updated;
}

/** Re-collect ChatGPT snapshots that failed or returned empty text. */
export async function recollectFailedChatgpt(brandId: string): Promise<number> {
  const supabase = getAdminClient();
  const { data: rows } = await supabase
    .from("response_snapshots")
    .select("prompt_id")
    .eq("brand_id", brandId)
    .eq("platform", "chatgpt")
    .or("response_text.is.null,response_text.eq.");

  const promptIds = [...new Set((rows ?? []).map((r) => r.prompt_id).filter(Boolean))] as string[];
  if (!promptIds.length) return 0;

  const { brand, competitors, ctx } = await loadBrandContext(brandId);
  let count = 0;

  for (const promptId of promptIds) {
    const { data: prompt } = await supabase
      .from("tracked_prompts")
      .select("id, prompt_text, brand_id, prompt_platform_config(*)")
      .eq("id", promptId)
      .single();
    if (!prompt) continue;

    const row = prompt as PromptRow & {
      prompt_platform_config?: Array<{ platform: Platform; model_name: string; is_active: boolean }>;
    };
    const cfg = row.prompt_platform_config?.find((c) => c.platform === "chatgpt" && c.is_active);
    if (!cfg) continue;

    await supabase
      .from("response_snapshots")
      .delete()
      .eq("brand_id", brandId)
      .eq("prompt_id", promptId)
      .eq("platform", "chatgpt");

    await runPromptPlatformWithContext({
      prompt: { id: row.id, prompt_text: row.prompt_text, brand_id: row.brand_id },
      platform: "chatgpt",
      modelName: cfg.model_name,
      brand,
      competitors,
      ctx,
    });
    count += 1;
  }

  return count;
}

/** Fire-and-forget wrapper — returns immediately so the UI stays responsive. */
export function startResponsesForBrand(brandId: string): void {
  void runResponsesForBrand(brandId)
    .then(async () => {
      await reparseSnapshotsForBrand(brandId);
      revalidatePath("/", "layout");
      revalidatePath("/responses");
      revalidatePath("/prompts");
      revalidatePath("/fan-out");
      revalidatePath("/categories");
      revalidatePath("/benchmarking");
      revalidatePath("/citations");
    })
    .catch((err) => console.error("[collection] brand responses failed:", err));
}

/** Fix empty responses from parser/path bugs, then re-fetch failed ChatGPT rows. */
export async function repairBrandSnapshots(brandId: string): Promise<{ reparsed: number; chatgpt: number }> {
  const reparsed = await reparseSnapshotsForBrand(brandId);
  let chatgpt = 0;
  try {
    chatgpt = await recollectFailedChatgpt(brandId);
  } catch (err) {
    console.error("[collection] ChatGPT re-collect failed:", err);
  }
  revalidatePath("/", "layout");
  revalidatePath("/responses");
  revalidatePath("/fan-out");
  revalidatePath("/benchmarking");
  revalidatePath("/citations");
  return { reparsed, chatgpt };
}

export function startPromptAllPlatforms(promptId: string): void {
  void runPromptAllPlatforms(promptId)
    .then(() => {
      revalidatePath("/prompts");
      revalidatePath("/responses");
      revalidatePath("/");
      revalidatePath("/fan-out");
      revalidatePath("/categories");
    })
    .catch((err) => console.error("[collection] prompt run failed:", err));
}

export function estimateCollectionMinutes(promptCount: number, platformsPerPrompt = 4): string {
  const calls = promptCount * platformsPerPrompt;
  // ~30–60s per call with concurrency 4
  const minutes = Math.ceil((calls * 45) / (COLLECTION_CONCURRENCY * 60));
  if (minutes <= 1) return "~1 minute";
  return `~${minutes} minutes`;
}

/**
 * Weekly job: pull LLM Mentions data — share of voice (brand vs competitors)
 * and top cited domains — and persist to the benchmarking tables.
 */
export async function runMentionsForBrand(brandId: string): Promise<void> {
  const supabase = getAdminClient();
  const { brand, competitors } = await loadBrandContext(brandId);

  const targets = [
    {
      key: brand.name.toLowerCase(),
      domain: normaliseDomain(brand.domain),
      keyword: brand.name,
    },
    ...competitors.map((c) => ({
      key: (c.name ?? normaliseDomain(c.domain).split(".")[0]).toLowerCase(),
      domain: normaliseDomain(c.domain),
      keyword: c.name ?? normaliseDomain(c.domain).split(".")[0],
    })),
  ];

  const today = new Date().toISOString().slice(0, 10);

  if (targets.length >= 2) {
    const sov = await getCrossAggregated(targets, "google");
    if (sov.length) {
      await supabase
        .from("competitor_sov_snapshots")
        .delete()
        .eq("brand_id", brandId)
        .eq("snapshot_date", today);

      await supabase.from("competitor_sov_snapshots").insert(
        sov.map((row) => ({
          brand_id: brandId,
          snapshot_date: today,
          domain: row.domain,
          mention_count: row.mention_count,
          share_of_voice: row.share_of_voice,
          platform: row.platform,
        })),
      );
    }
  }

  const { data: prompts } = await supabase
    .from("tracked_prompts")
    .select("prompt_text")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .limit(5);

  const keywords = [...new Set((prompts ?? []).map((p) => p.prompt_text).filter(Boolean))];
  if (keywords.length) {
    const ownRoot = normaliseDomain(brand.domain);
    const domainMap = new Map<string, number>();

    for (const keyword of keywords) {
      const top = await getTopDomains(keyword, "google");
      for (const row of top) {
        const domain = normaliseDomain(row.domain);
        domainMap.set(domain, (domainMap.get(domain) ?? 0) + row.mention_count);
      }
    }

    const merged = [...domainMap.entries()]
      .map(([domain, mention_count]) => ({ domain, mention_count }))
      .sort((a, b) => b.mention_count - a.mention_count);

    if (merged.length) {
      await supabase.from("citation_domains").delete().eq("brand_id", brandId);

      await supabase.from("citation_domains").insert(
        merged.map((row) => ({
          brand_id: brandId,
          domain: row.domain,
          mention_count: row.mention_count,
          is_own_domain: normaliseDomain(row.domain) === ownRoot,
          platform: "google",
        })),
      );
    }

    const search = await searchMentions(keywords[0], "google");
    await supabase.from("mention_snapshots").insert({
      brand_id: brandId,
      platform: search.platform,
      mention_count: search.mention_count,
      ai_search_volume: search.ai_search_volume,
      monthly_searches: search.monthly_searches,
      raw_response: search as unknown,
    });
  }
}

export function startMentionsForBrand(brandId: string): void {
  void runMentionsForBrand(brandId)
    .then(() => {
      revalidatePath("/", "layout");
      revalidatePath("/benchmarking");
      revalidatePath("/citations");
    })
    .catch((err) => console.error("[collection] mentions job failed:", err));
}
