import type { Sentiment } from "./constants";
import { normaliseDomain } from "./utils";
import type { NormalisedLlmResponse } from "./dataforseo/types";

export interface ParsedSignals {
  brand_mentioned: boolean;
  brand_sentiment: Sentiment | null;
  brand_position: number | null;
  /** Known competitors (from your whitelist) that appeared in the response. */
  competitors_mentioned: string[];
  /** Other brands/domains detected via API entities and cited sources. */
  entities_detected: string[];
  cited_urls: string[];
  fan_out_queries: string[];
  response_text: string;
}

const POSITIVE_WORDS = [
  "best", "top", "leading", "excellent", "great", "recommended", "popular",
  "strong", "powerful", "ideal", "favourite", "favorite", "trusted", "reliable",
  "innovative", "robust", "affordable", "value", "ease of use", "easy to use",
];

const NEGATIVE_WORDS = [
  "worst", "poor", "weak", "limited", "lacking", "expensive", "outdated",
  "difficult", "complicated", "buggy", "unreliable", "avoid", "downside",
  "drawback", "complaint", "disappointing", "overpriced",
];

/** Reference/review sites — cited often but not competitor brands. */
const GENERIC_CITATION_DOMAINS = new Set([
  "wikipedia.org",
  "en.wikipedia.org",
  "g2.com",
  "capterra.com",
  "trustpilot.com",
  "forbes.com",
  "techradar.com",
  "reddit.com",
  "youtube.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "glassdoor.com",
  "crunchbase.com",
  "google.com",
  "amazon.com",
  "apple.com",
  "microsoft.com",
  "bbc.com",
  "nytimes.com",
  "medium.com",
  "quora.com",
  "producthunt.com",
  "softwareadvice.com",
  "getapp.com",
  "trustradius.com",
]);

/** Build the set of brand aliases to match against (name + domain root + profile aliases). */
function brandAliases(brandName: string, brandDomain: string, profileAliases: string[] = []): string[] {
  const aliases = new Set<string>();
  if (brandName.trim()) aliases.add(brandName.trim().toLowerCase());
  const domainRoot = normaliseDomain(brandDomain).split(".")[0];
  if (domainRoot) aliases.add(domainRoot.toLowerCase());
  for (const alias of profileAliases) {
    const a = alias.trim().toLowerCase();
    if (a) aliases.add(a);
  }
  return [...aliases].filter(Boolean);
}

/** Find earliest character index any alias appears at, or -1. */
function firstMentionIndex(text: string, aliases: string[]): number {
  const lower = text.toLowerCase();
  let earliest = -1;
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest;
}

function classifySentiment(text: string, mentionIndex: number): Sentiment {
  if (mentionIndex < 0) return "neutral";
  const windowStart = Math.max(0, mentionIndex - 160);
  const windowEnd = Math.min(text.length, mentionIndex + 160);
  const context = text.slice(windowStart, windowEnd).toLowerCase();

  let score = 0;
  for (const w of POSITIVE_WORDS) if (context.includes(w)) score += 1;
  for (const w of NEGATIVE_WORDS) if (context.includes(w)) score -= 1;

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function matchesAlias(value: string, aliases: string[]): boolean {
  const lower = value.toLowerCase();
  return aliases.some((a) => lower.includes(a) || a.includes(lower));
}

function isOwnBrand(value: string, aliases: string[], ownDomain: string): boolean {
  const normalised = value.trim().toLowerCase();
  if (!normalised) return true;
  if (matchesAlias(normalised, aliases)) return true;
  const asDomain = normaliseDomain(normalised);
  if (asDomain === ownDomain) return true;
  const root = asDomain.split(".")[0];
  return aliases.some((a) => a === root);
}

function isKnownCompetitor(
  value: string,
  knownCompetitorDomains: Set<string>,
  knownCompetitorNames: string[],
): boolean {
  const lower = value.toLowerCase();
  const asDomain = normaliseDomain(lower);
  if (knownCompetitorDomains.has(asDomain)) return true;
  const root = asDomain.split(".")[0];
  if (root && knownCompetitorDomains.has(root)) return true;
  return knownCompetitorNames.some((n) => n && lower.includes(n));
}

function detectEntities(
  res: NormalisedLlmResponse,
  aliases: string[],
  ownDomain: string,
  knownCompetitorDomains: Set<string>,
  knownCompetitorNames: string[],
): string[] {
  const detected = new Set<string>();

  for (const entity of res.brand_entities) {
    const trimmed = entity.trim();
    if (!trimmed) continue;
    if (isOwnBrand(trimmed, aliases, ownDomain)) continue;
    if (isKnownCompetitor(trimmed, knownCompetitorDomains, knownCompetitorNames)) continue;
    detected.add(trimmed);
  }

  for (const url of res.cited_urls) {
    const domain = normaliseDomain(url);
    if (!domain || domain === ownDomain) continue;
    if (GENERIC_CITATION_DOMAINS.has(domain)) continue;
    if (isOwnBrand(domain, aliases, ownDomain)) continue;
    if (knownCompetitorDomains.has(domain)) continue;
    detected.add(domain);
  }

  return [...detected];
}

export interface ParseInput {
  brandName: string;
  brandDomain: string;
  brandAliases?: string[];
  competitors: { domain: string; name?: string | null }[];
}

export function parseResponse(
  res: NormalisedLlmResponse,
  input: ParseInput,
): ParsedSignals {
  const text = res.response_text ?? "";
  const lower = text.toLowerCase();
  const aliases = brandAliases(input.brandName, input.brandDomain, input.brandAliases);
  const ownDomain = normaliseDomain(input.brandDomain);

  const entityMatch = res.brand_entities.some((e) => matchesAlias(e, aliases));
  const mentionIndex = firstMentionIndex(text, aliases);
  const stringMatch = mentionIndex !== -1;
  const brand_mentioned = entityMatch || stringMatch;

  const knownCompetitorDomains = new Set(
    input.competitors.map((c) => normaliseDomain(c.domain)),
  );
  const knownCompetitorNames = input.competitors
    .map((c) => (c.name ?? "").toLowerCase())
    .filter(Boolean);

  const competitors_mentioned = input.competitors
    .filter((c) => {
      const root = normaliseDomain(c.domain).split(".")[0];
      const name = (c.name ?? "").toLowerCase();
      return (
        (root && lower.includes(root.toLowerCase())) ||
        (name && lower.includes(name))
      );
    })
    .map((c) => normaliseDomain(c.domain));

  const entities_detected = detectEntities(
    res,
    aliases,
    ownDomain,
    knownCompetitorDomains,
    knownCompetitorNames,
  );

  return {
    brand_mentioned,
    brand_sentiment: brand_mentioned ? classifySentiment(text, mentionIndex) : null,
    brand_position: stringMatch ? mentionIndex : null,
    competitors_mentioned: [...new Set(competitors_mentioned)],
    entities_detected,
    cited_urls: res.cited_urls,
    fan_out_queries: res.fan_out_queries,
    response_text: text,
  };
}
