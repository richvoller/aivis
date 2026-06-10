import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODELS, PLATFORMS, type Platform } from "./constants";

export const DEMO_BRAND_NAME = "Acme CRM";
export const DEMO_BRAND_DOMAIN = "acmecrm.com";

const COMPETITORS = [
  { domain: "hubspot.com", name: "HubSpot" },
  { domain: "salesforce.com", name: "Salesforce" },
  { domain: "zoho.com", name: "Zoho" },
] as const;

const PROMPTS = [
  { text: "What is the best CRM for small businesses?", category: "commercial" },
  { text: "How do I choose a CRM platform?", category: "informational" },
  { text: "Acme CRM vs HubSpot comparison", category: "brand" },
  { text: "Top CRM tools for sales teams in 2026", category: "commercial" },
  { text: "Affordable CRM software with automation", category: "commercial" },
] as const;

const ALL_COMPETITOR_DOMAINS = ["hubspot.com", "salesforce.com", "zoho.com"];
const CITED_URLS = ["en.wikipedia.org", "g2.com", "capterra.com"];
const SENTIMENTS = ["positive", "neutral", "negative"] as const;

function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return t / 4294967296;
  };
}

function mentionProbability(platform: Platform): number {
  switch (platform) {
    case "chatgpt":
      return 0.65;
    case "claude":
      return 0.45;
    case "gemini":
      return 0.55;
    default:
      return 0.4;
  }
}

/** Insert Acme CRM demo data. Only replaces an existing acmecrm.com brand. */
export async function loadDemoBrandDataForClient(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .eq("domain", DEMO_BRAND_DOMAIN)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("brands").delete().eq("id", existing.id);
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({
      name: DEMO_BRAND_NAME,
      domain: DEMO_BRAND_DOMAIN,
      description: "Demo brand with sample visibility data for screenshots",
    })
    .select("id")
    .single();
  if (brandError) throw brandError;
  const brandId = brand.id as string;

  await supabase.from("competitors").insert(
    COMPETITORS.map((c) => ({ brand_id: brandId, domain: c.domain, name: c.name })),
  );

  const { data: promptRows, error: promptError } = await supabase
    .from("tracked_prompts")
    .insert(PROMPTS.map((p) => ({ brand_id: brandId, prompt_text: p.text, category: p.category })))
    .select("id, prompt_text");
  if (promptError) throw promptError;

  const platformConfigs: Array<{ prompt_id: string; platform: Platform; model_name: string }> = [];
  for (const prompt of promptRows ?? []) {
    for (const platform of PLATFORMS) {
      platformConfigs.push({
        prompt_id: prompt.id,
        platform,
        model_name: DEFAULT_MODELS[platform],
      });
    }
  }
  await supabase.from("prompt_platform_config").insert(platformConfigs);

  type SnapshotInsert = {
    brand_id: string;
    prompt_id: string;
    platform: Platform;
    model_name: string;
    fetched_at: string;
    brand_mentioned: boolean;
    brand_sentiment: string | null;
    brand_position: number | null;
    response_text: string;
    competitors_mentioned: string[];
    cited_urls: string[];
    fan_out_queries: string[];
    raw_response: Record<string, unknown>;
  };

  const snapshots: SnapshotInsert[] = [];

  for (const prompt of promptRows ?? []) {
    for (const platform of PLATFORMS) {
      const modelName = DEFAULT_MODELS[platform];
      for (let day = 0; day < 30; day++) {
        const rng = seeded(`${prompt.id}:${platform}:${day}`);
        const mentioned = rng() < mentionProbability(platform);
        const sentiment = mentioned ? SENTIMENTS[Math.floor(rng() * 2)] : null;
        const competitorsMentioned = ALL_COMPETITOR_DOMAINS.filter(() => rng() < 0.5);
        const hoursAgo = day * 24 + Math.floor(rng() * 6);
        const fetchedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

        snapshots.push({
          brand_id: brandId,
          prompt_id: prompt.id,
          platform,
          model_name: modelName,
          fetched_at: fetchedAt,
          brand_mentioned: mentioned,
          brand_sentiment: sentiment,
          brand_position: mentioned ? Math.floor(rng() * 400) : null,
          response_text: mentioned
            ? `When considering CRM options, Acme CRM stands out for small businesses thanks to its automation and pricing. Competitors include ${competitorsMentioned.join(", ") || ALL_COMPETITOR_DOMAINS.join(", ")}.`
            : `Popular CRM options include ${ALL_COMPETITOR_DOMAINS.join(", ")}. Each has different strengths for sales teams.`,
          competitors_mentioned: competitorsMentioned,
          cited_urls: CITED_URLS,
          fan_out_queries: [
            "best crm small business",
            "crm pricing comparison",
            `${platform} crm recommendations`,
          ],
          raw_response: { seeded: true, platform, day },
        });
      }
    }
  }

  for (let i = 0; i < snapshots.length; i += 100) {
    const chunk = snapshots.slice(i, i + 100);
    const { error } = await supabase.from("response_snapshots").insert(chunk);
    if (error) throw error;
  }

  const sovRows: Array<{
    brand_id: string;
    snapshot_date: string;
    domain: string;
    mention_count: number;
    share_of_voice: number;
    platform: string;
  }> = [];

  for (let week = 0; week < 4; week++) {
    const snapshotDate = new Date();
    snapshotDate.setDate(snapshotDate.getDate() - week * 7);
    const dateStr = snapshotDate.toISOString().slice(0, 10);
    const rng = seeded(`sov:${week}`);

    sovRows.push(
      {
        brand_id: brandId,
        snapshot_date: dateStr,
        domain: "acmecrm.com",
        mention_count: 30 + Math.floor(rng() * 20),
        share_of_voice: Number((22 + rng() * 8).toFixed(1)),
        platform: "google",
      },
      {
        brand_id: brandId,
        snapshot_date: dateStr,
        domain: "hubspot.com",
        mention_count: 50 + Math.floor(rng() * 20),
        share_of_voice: Number((35 + rng() * 8).toFixed(1)),
        platform: "google",
      },
      {
        brand_id: brandId,
        snapshot_date: dateStr,
        domain: "salesforce.com",
        mention_count: 40 + Math.floor(rng() * 20),
        share_of_voice: Number((28 + rng() * 8).toFixed(1)),
        platform: "google",
      },
      {
        brand_id: brandId,
        snapshot_date: dateStr,
        domain: "zoho.com",
        mention_count: 20 + Math.floor(rng() * 15),
        share_of_voice: Number((15 + rng() * 5).toFixed(1)),
        platform: "google",
      },
    );
  }
  await supabase.from("competitor_sov_snapshots").insert(sovRows);

  await supabase.from("citation_domains").insert([
    { brand_id: brandId, domain: "g2.com", mention_count: 45, is_own_domain: false, platform: "google" },
    { brand_id: brandId, domain: "capterra.com", mention_count: 38, is_own_domain: false, platform: "google" },
    { brand_id: brandId, domain: "en.wikipedia.org", mention_count: 30, is_own_domain: false, platform: "google" },
    { brand_id: brandId, domain: "acmecrm.com", mention_count: 12, is_own_domain: true, platform: "google" },
    { brand_id: brandId, domain: "forbes.com", mention_count: 9, is_own_domain: false, platform: "google" },
  ]);

  await supabase.from("action_items").insert([
    {
      brand_id: brandId,
      title: "Low visibility on Perplexity",
      detail:
        "Acme CRM appears in only 40% of Perplexity responses. Review commercial content for AI retrievability.",
      severity: "high",
      category: "visibility",
    },
    {
      brand_id: brandId,
      title: "Citation gap on g2.com",
      detail: "Competitors are heavily cited on g2.com where Acme CRM has limited presence.",
      severity: "medium",
      category: "citation",
    },
  ]);

  return brandId;
}
