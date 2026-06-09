import "server-only";
import { z } from "zod";
import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { perplexity } from "@ai-sdk/perplexity";
import type { NamedItem, KeyFact, KeyPerson, ResearchSource } from "./types";

/** Zod schema for the structured brand profile extracted by OpenAI. */
const BrandProfileSchema = z.object({
  tagline: z.string().nullable(),
  value_proposition: z.string().nullable(),
  mission_statement: z.string().nullable(),
  industry: z.string().nullable(),
  headquarters: z.string().nullable(),
  founded_year: z.number().nullable(),
  company_size: z.string().nullable(),
  products: z.array(z.object({ name: z.string(), description: z.string() })),
  services: z.array(z.object({ name: z.string(), description: z.string() })),
  key_facts: z.array(z.object({ fact: z.string(), source_url: z.string().nullable() })),
  key_people: z.array(z.object({ name: z.string(), role: z.string() })),
  research_sources: z.array(z.object({ title: z.string(), url: z.string() })),
  brand_aliases: z.array(z.string()),
  categories: z.array(z.string()),
  content_language: z.string().nullable(),
  tone_of_voice: z.string().nullable(),
  writing_style: z.string().nullable(),
  ai_image_style: z.string().nullable(),
  banned_phrases: z.array(z.string()),
  primary_country: z.string().nullable(),
  primary_language: z.string().nullable(),
});

export type BrandProfileInput = z.infer<typeof BrandProfileSchema>;

export interface ReanalyzeResult {
  profile: BrandProfileInput | null;
  error: string | null;
  sources?: ResearchSource[];
}

/**
 * Fetch the brand's website text (simple GET, no headless browser).
 * Falls back to empty string on failure — the AI research step can still
 * work from the domain name alone.
 */
async function fetchWebsiteText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip tags/scripts and take first ~4000 chars for context
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000);
  } catch {
    return "";
  }
}

/**
 * Run the hybrid research pipeline:
 * 1. Fetch website text (best-effort)
 * 2. Perplexity Sonar researches the brand + web with citations
 * 3. OpenAI extracts the structured profile from the combined context
 */
export async function reanalyzeBrand(brandName: string, domain: string, description: string | null): Promise<ReanalyzeResult> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!perplexityKey || !openaiKey) {
    return {
      profile: null,
      error: "PERPLEXITY_API_KEY and OPENAI_API_KEY are required for brand re-analysis. Add them to .env.local.",
    };
  }

  const websiteUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const siteText = await fetchWebsiteText(websiteUrl);

  // Step 1: Perplexity research
  const researchPrompt = `Research the brand "${brandName}" (website: ${websiteUrl}) and gather comprehensive information:
- Industry, headquarters, founding year, company size
- Products and services
- Key facts and notable claims (with sources)
- Key people and their roles
- Brand aliases (alternative names, legal entity names)
- Categories relevant to AI visibility (e.g., "sustainable cards", "CRM", etc.)
- Tagline, value proposition, mission statement
- Content generation preferences (tone of voice, writing style, language)
- Primary country and language
- Any banned phrases or trademarked terms the brand avoids

Provide a detailed summary with citations to sources.`;

  const perplexityModel = process.env.PERPLEXITY_MODEL || "sonar-pro";
  const { text: researchText, sources: perplexitySources } = await generateText({
    model: perplexity(perplexityModel),
    prompt: researchPrompt,
  });

  // Step 2: OpenAI structured extraction
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
  const extractionPrompt = `You are a brand research analyst. Extract a structured brand profile from the following research about "${brandName}" (${websiteUrl}).

Website text context (first ~4k chars):
${siteText || "[website text unavailable]"}

Perplexity research with web citations:
${researchText}

Return the profile in the exact JSON schema provided. If a field cannot be inferred, return null or an empty array.`;

  const { object } = await generateObject({
    model: openai(openaiModel),
    schema: BrandProfileSchema,
    prompt: extractionPrompt,
  });

  // Normalise Perplexity sources into our ResearchSource shape
  const sources: ResearchSource[] = (perplexitySources ?? []).map((s: any) => ({
    title: s.title || s.url || "",
    url: s.url || "",
  }));

  return { profile: object, error: null, sources };
}
