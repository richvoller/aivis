import "server-only";
import { getAdminClient } from "./supabase/admin";
import {
  getCrossAggregated,
  getLLMResponse,
  getTopDomains,
  searchMentions,
  type BrandContext,
} from "./dataforseo/client";
import { parseResponse } from "./parser";
import type { Platform } from "./constants";
import { DEFAULT_MODELS } from "./constants";
import { normaliseDomain } from "./utils";
import type { Brand, Competitor, ResponseSnapshot } from "./types";

interface PromptRow {
  id: string;
  prompt_text: string;
  brand_id: string;
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

/**
 * Run a single prompt against a single platform/model, parse the result and
 * persist a response_snapshot. Returns the inserted row.
 */
export async function runPromptPlatform(args: {
  prompt: PromptRow;
  platform: Platform;
  modelName: string;
}): Promise<ResponseSnapshot> {
  const supabase = getAdminClient();
  const { brand, competitors, ctx } = await loadBrandContext(args.prompt.brand_id);

  const res = await getLLMResponse(
    {
      platform: args.platform,
      model_name: args.modelName,
      user_prompt: args.prompt.prompt_text,
    },
    ctx,
  );

  const signals = parseResponse(res, {
    brandName: brand.name,
    brandDomain: brand.domain,
    brandAliases: brand.brand_aliases ?? [],
    competitors: competitors.map((c) => ({ domain: c.domain, name: c.name })),
  });

  const { data, error } = await supabase
    .from("response_snapshots")
    .insert({
      brand_id: brand.id,
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

/** Run one prompt across all its active platform configs. */
export async function runPromptAllPlatforms(promptId: string): Promise<ResponseSnapshot[]> {
  const supabase = getAdminClient();
  const { data: prompt, error } = await supabase
    .from("tracked_prompts")
    .select("id, prompt_text, brand_id, prompt_platform_config(*)")
    .eq("id", promptId)
    .single();
  if (error) throw error;

  const configs = ((prompt as { prompt_platform_config?: Array<{ platform: Platform; model_name: string; is_active: boolean }> })
    .prompt_platform_config ?? []).filter((c) => c.is_active);

  const targets = configs.length
    ? configs
    : (Object.keys(DEFAULT_MODELS) as Platform[]).map((platform) => ({
        platform,
        model_name: DEFAULT_MODELS[platform],
        is_active: true,
      }));

  const results: ResponseSnapshot[] = [];
  for (const c of targets) {
    results.push(
      await runPromptPlatform({
        prompt: { id: (prompt as PromptRow).id, prompt_text: (prompt as PromptRow).prompt_text, brand_id: (prompt as PromptRow).brand_id },
        platform: c.platform,
        modelName: c.model_name,
      }),
    );
  }
  return results;
}

/** Nightly job: run every active prompt for a brand across all platforms. */
export async function runResponsesForBrand(brandId: string): Promise<number> {
  const supabase = getAdminClient();
  const { data: prompts, error } = await supabase
    .from("tracked_prompts")
    .select("id")
    .eq("brand_id", brandId)
    .eq("is_active", true);
  if (error) throw error;

  let count = 0;
  for (const p of prompts ?? []) {
    const rows = await runPromptAllPlatforms(p.id);
    count += rows.length;
  }
  return count;
}

/**
 * Weekly job: pull LLM Mentions data — share of voice (brand vs competitors)
 * and top cited domains — and persist to the benchmarking tables.
 */
export async function runMentionsForBrand(brandId: string): Promise<void> {
  const supabase = getAdminClient();
  const { brand, competitors } = await loadBrandContext(brandId);

  const domains = [brand.domain, ...competitors.map((c) => c.domain)].map(normaliseDomain);
  const sov = await getCrossAggregated(domains, "google");
  const today = new Date().toISOString().slice(0, 10);

  if (sov.length) {
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

  // Top cited domains from the brand's first active prompt keyword
  const { data: firstPrompt } = await supabase
    .from("tracked_prompts")
    .select("prompt_text")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (firstPrompt?.prompt_text) {
    const top = await getTopDomains(firstPrompt.prompt_text, "google");
    if (top.length) {
      const ownRoot = normaliseDomain(brand.domain);
      await supabase.from("citation_domains").insert(
        top.map((row) => ({
          brand_id: brandId,
          domain: row.domain,
          mention_count: row.mention_count,
          is_own_domain: normaliseDomain(row.domain) === ownRoot,
          platform: row.platform,
        })),
      );
    }

    // Discovery: record a mention snapshot for the prompt keyword
    const search = await searchMentions(firstPrompt.prompt_text, "google");
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
