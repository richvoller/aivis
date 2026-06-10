import type { Platform } from "../constants";
import { PLATFORM_LABELS } from "../constants";
import type {
  CrossAggregatedRow,
  MentionSearchRow,
  NormalisedLlmResponse,
  TopDomainRow,
  TopPageRow,
} from "./types";

/**
 * Deterministic-ish pseudo random based on a string seed so mock output is
 * stable for a given prompt/platform within a run but varied across them.
 */
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

const SAMPLE_SOURCES = [
  "https://en.wikipedia.org/wiki/Customer_relationship_management",
  "https://www.g2.com/categories/crm",
  "https://www.capterra.com/customer-relationship-management-software/",
  "https://www.forbes.com/advisor/business/software/best-crm-software/",
  "https://www.techradar.com/best/best-crm-software",
];

export function mockLlmResponse(args: {
  platform: Platform;
  model_name: string;
  user_prompt: string;
  brandName: string;
  brandDomain: string;
  competitorNames: string[];
}): NormalisedLlmResponse {
  const { platform, model_name, user_prompt, brandName, competitorNames } = args;
  const rng = seeded(`${platform}:${user_prompt}`);
  const promptMentionsBrand =
    brandName.length > 0 &&
    user_prompt.toLowerCase().includes(brandName.toLowerCase());
  const mentioned = promptMentionsBrand || rng() < 0.75;

  const competitorList = competitorNames.length
    ? competitorNames.join(", ")
    : "HubSpot, Salesforce, Zoho";

  const response_text = mentioned
    ? `When evaluating options for "${user_prompt}", ${brandName} is a strong contender. ` +
      `It is frequently recommended for its automation features, ease of use, and competitive pricing. ` +
      `Other notable platforms include ${competitorList}. Overall, ${brandName} is well suited for ` +
      `teams that want a balance of capability and value.`
    : `For "${user_prompt}", the most commonly recommended platforms are ${competitorList}. ` +
      `Each offers different strengths depending on team size and budget. Consider your specific ` +
      `workflow requirements before deciding.`;

  const sourceCount = 2 + Math.floor(rng() * 3);
  const cited_urls = SAMPLE_SOURCES.slice(0, sourceCount);

  const fan_out_queries = [
    `best ${PLATFORM_LABELS[platform].toLowerCase()} recommended tools`,
    `${user_prompt} comparison`,
    `${user_prompt} pricing`,
    `top alternatives for ${user_prompt}`,
  ].slice(0, 2 + Math.floor(rng() * 2));

  const extraEntities = mentioned
    ? competitorNames.slice(0, 2)
    : ["Monday.com", "Pipedrive", ...competitorNames].slice(0, 3);

  return {
    platform,
    model_name,
    response_text,
    cited_urls,
    fan_out_queries,
    brand_entities: mentioned ? [brandName, ...extraEntities] : extraEntities,
    money_spent: 0,
    raw: { mock: true, platform, model_name, user_prompt },
  };
}

export function mockMentionSearch(keyword: string, platform: string): MentionSearchRow {
  const rng = seeded(`${keyword}:${platform}`);
  return {
    keyword,
    platform,
    mention_count: 5 + Math.floor(rng() * 50),
    ai_search_volume: 100 + Math.floor(rng() * 5000),
    monthly_searches: 500 + Math.floor(rng() * 20000),
    cited_sources: SAMPLE_SOURCES.slice(0, 3),
    non_cited_sources: SAMPLE_SOURCES.slice(3),
  };
}

export function mockCrossAggregated(domains: string[], platform: string): CrossAggregatedRow[] {
  const counts = domains.map((d) => {
    const rng = seeded(`${d}:${platform}`);
    return { domain: d, mention_count: 10 + Math.floor(rng() * 90) };
  });
  const total = counts.reduce((s, c) => s + c.mention_count, 0) || 1;
  return counts.map((c) => ({
    domain: c.domain,
    mention_count: c.mention_count,
    share_of_voice: Number(((c.mention_count / total) * 100).toFixed(1)),
    platform,
  }));
}

export function mockTopDomains(keyword: string, platform: string): TopDomainRow[] {
  const rng = seeded(`topdomains:${keyword}`);
  return [
    "g2.com",
    "capterra.com",
    "en.wikipedia.org",
    "forbes.com",
    "techradar.com",
    "reddit.com",
  ].map((domain) => ({
    domain,
    mention_count: 5 + Math.floor(rng() * 60),
    platform,
  }));
}

export function mockTopPages(keyword: string, platform: string): TopPageRow[] {
  const rng = seeded(`toppages:${keyword}`);
  return SAMPLE_SOURCES.map((url) => ({
    url,
    domain: url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0],
    mention_count: 3 + Math.floor(rng() * 40),
    platform,
  }));
}
