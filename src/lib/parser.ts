import type { Sentiment } from "./constants";
import { normaliseDomain } from "./utils";
import type { NormalisedLlmResponse } from "./dataforseo/types";

export interface ParsedSignals {
  brand_mentioned: boolean;
  brand_sentiment: Sentiment | null;
  brand_position: number | null;
  competitors_mentioned: string[];
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

/** Build the set of brand aliases to match against (name + domain root + profile aliases). */
function brandAliases(brandName: string, brandDomain: string, profileAliases: string[] = []): string[] {
  const aliases = new Set<string>();
  if (brandName.trim()) aliases.add(brandName.trim().toLowerCase());
  const domainRoot = normaliseDomain(brandDomain).split(".")[0];
  if (domainRoot) aliases.add(domainRoot.toLowerCase());
  // Add profile aliases if provided
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

/**
 * Classify sentiment of the sentence(s) surrounding the first brand mention
 * using a lightweight keyword heuristic. Cheap, deterministic, no extra API
 * cost. Can be swapped for an LLM classifier later.
 */
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

  // 1) DataForSEO brand entities (authoritative when present)
  const entityMatch = res.brand_entities.some((e) =>
    aliases.some((a) => e.toLowerCase().includes(a)),
  );

  // 2) String match fallback
  const mentionIndex = firstMentionIndex(text, aliases);
  const stringMatch = mentionIndex !== -1;

  const brand_mentioned = entityMatch || stringMatch;

  // Competitors present in the text (by name or domain root)
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

  return {
    brand_mentioned,
    brand_sentiment: brand_mentioned ? classifySentiment(text, mentionIndex) : null,
    brand_position: stringMatch ? mentionIndex : null,
    competitors_mentioned: [...new Set(competitors_mentioned)],
    cited_urls: res.cited_urls,
    fan_out_queries: res.fan_out_queries,
    response_text: text,
  };
}
