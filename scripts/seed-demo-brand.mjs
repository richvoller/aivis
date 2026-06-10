import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity"];
const DEFAULT_MODELS = {
  chatgpt: "gpt-5.5",
  claude: "claude-sonnet-4-6",
  gemini: "gemini-3.5-flash",
  perplexity: "sonar-reasoning-pro",
};

const DEMO_BRAND_NAME = "Acme CRM";
const DEMO_BRAND_DOMAIN = "acmecrm.com";

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function seeded(seed) {
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

function mentionProbability(platform) {
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

async function loadDemoBrandDataForClient(supabase) {
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
  const brandId = brand.id;

  await supabase.from("competitors").insert([
    { brand_id: brandId, domain: "hubspot.com", name: "HubSpot" },
    { brand_id: brandId, domain: "salesforce.com", name: "Salesforce" },
    { brand_id: brandId, domain: "zoho.com", name: "Zoho" },
  ]);

  const prompts = [
    { text: "What is the best CRM for small businesses?", category: "commercial" },
    { text: "How do I choose a CRM platform?", category: "informational" },
    { text: "Acme CRM vs HubSpot comparison", category: "brand" },
    { text: "Top CRM tools for sales teams in 2026", category: "commercial" },
    { text: "Affordable CRM software with automation", category: "commercial" },
  ];

  const { data: promptRows, error: promptError } = await supabase
    .from("tracked_prompts")
    .insert(prompts.map((p) => ({ brand_id: brandId, prompt_text: p.text, category: p.category })))
    .select("id");
  if (promptError) throw promptError;

  const platformConfigs = [];
  for (const prompt of promptRows) {
    for (const platform of PLATFORMS) {
      platformConfigs.push({
        prompt_id: prompt.id,
        platform,
        model_name: DEFAULT_MODELS[platform],
      });
    }
  }
  await supabase.from("prompt_platform_config").insert(platformConfigs);

  const allCompetitors = ["hubspot.com", "salesforce.com", "zoho.com"];
  const citedUrls = ["en.wikipedia.org", "g2.com", "capterra.com"];
  const sentiments = ["positive", "neutral", "negative"];
  const snapshots = [];

  for (const prompt of promptRows) {
    for (const platform of PLATFORMS) {
      const modelName = DEFAULT_MODELS[platform];
      for (let day = 0; day < 30; day++) {
        const rng = seeded(`${prompt.id}:${platform}:${day}`);
        const mentioned = rng() < mentionProbability(platform);
        const sentiment = mentioned ? sentiments[Math.floor(rng() * 2)] : null;
        const competitorsMentioned = allCompetitors.filter(() => rng() < 0.5);
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
            ? `When considering CRM options, Acme CRM stands out for small businesses thanks to its automation and pricing. Competitors include ${competitorsMentioned.join(", ") || allCompetitors.join(", ")}.`
            : `Popular CRM options include ${allCompetitors.join(", ")}. Each has different strengths for sales teams.`,
          competitors_mentioned: competitorsMentioned,
          cited_urls: citedUrls,
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
    const { error } = await supabase.from("response_snapshots").insert(snapshots.slice(i, i + 100));
    if (error) throw error;
  }

  const sovRows = [];
  for (let week = 0; week < 4; week++) {
    const snapshotDate = new Date();
    snapshotDate.setDate(snapshotDate.getDate() - week * 7);
    const dateStr = snapshotDate.toISOString().slice(0, 10);
    const rng = seeded(`sov:${week}`);
    sovRows.push(
      { brand_id: brandId, snapshot_date: dateStr, domain: "acmecrm.com", mention_count: 30 + Math.floor(rng() * 20), share_of_voice: Number((22 + rng() * 8).toFixed(1)), platform: "google" },
      { brand_id: brandId, snapshot_date: dateStr, domain: "hubspot.com", mention_count: 50 + Math.floor(rng() * 20), share_of_voice: Number((35 + rng() * 8).toFixed(1)), platform: "google" },
      { brand_id: brandId, snapshot_date: dateStr, domain: "salesforce.com", mention_count: 40 + Math.floor(rng() * 20), share_of_voice: Number((28 + rng() * 8).toFixed(1)), platform: "google" },
      { brand_id: brandId, snapshot_date: dateStr, domain: "zoho.com", mention_count: 20 + Math.floor(rng() * 15), share_of_voice: Number((15 + rng() * 5).toFixed(1)), platform: "google" },
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
      detail: "Acme CRM appears in only 40% of Perplexity responses. Review commercial content for AI retrievability.",
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

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const brandId = await loadDemoBrandDataForClient(supabase);
console.log(`Added ${DEMO_BRAND_NAME} (${brandId}). Switch to it in the brand dropdown.`);
