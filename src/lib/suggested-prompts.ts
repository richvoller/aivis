import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { PromptCategory } from "./constants";
import { PROMPT_CATEGORIES } from "./constants";
import { normaliseDomain } from "./utils";
import type { Brand, Competitor } from "./types";

export interface SuggestedPrompt {
  prompt_text: string;
  category: PromptCategory;
  rationale: string;
}

const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      prompt_text: z.string(),
      category: z.enum(PROMPT_CATEGORIES),
      rationale: z.string(),
    }),
  ),
});

function normalisePrompt(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Terms that must not appear in suggested prompts — brand-named queries are trivially visible. */
function brandTerms(brand: Brand): string[] {
  const terms = new Set<string>();
  if (brand.name.trim()) terms.add(brand.name.trim().toLowerCase());
  const root = normaliseDomain(brand.domain).split(".")[0];
  if (root) terms.add(root.toLowerCase());
  for (const alias of brand.brand_aliases) {
    const a = alias.trim().toLowerCase();
    if (a.length >= 3) terms.add(a);
  }
  return [...terms];
}

function containsBrandTerm(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(lower);
  });
}

function dedupeSuggestions(
  suggestions: SuggestedPrompt[],
  existingPrompts: string[],
  brand: Brand,
): SuggestedPrompt[] {
  const existing = new Set(existingPrompts.map(normalisePrompt));
  const seen = new Set<string>();
  const terms = brandTerms(brand);

  return suggestions.filter((s) => {
    if (containsBrandTerm(s.prompt_text, terms)) return false;
    const key = normalisePrompt(s.prompt_text);
    if (existing.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function primaryTopic(brand: Brand): string {
  if (brand.categories.length) return brand.categories[0];
  if (brand.industry) return brand.industry;
  return "software";
}

function audienceFor(brand: Brand): string {
  if (brand.company_size?.toLowerCase().includes("enterprise")) return "enterprise teams";
  if (brand.primary_country) return `businesses in ${brand.primary_country}`;
  return "small businesses";
}

function buildTemplateSuggestions(brand: Brand, competitors: Competitor[]): SuggestedPrompt[] {
  const topic = primaryTopic(brand);
  const topicLower = topic.toLowerCase();
  const audience = audienceFor(brand);
  const useCase = brand.value_proposition
    ? brand.value_proposition.split(/[.!]/)[0].trim().toLowerCase()
    : null;

  const out: SuggestedPrompt[] = [
    {
      prompt_text: `What is the best ${topicLower} for ${audience}?`,
      category: "commercial",
      rationale: `Core commercial query — do AI assistants recommend you when users search for ${topicLower}?`,
    },
    {
      prompt_text: `How do I choose a ${topicLower} platform?`,
      category: "informational",
      rationale: "Early research intent — surfaces category leaders before users know your name.",
    },
    {
      prompt_text: `Top ${topicLower} tools for sales teams in 2026`,
      category: "commercial",
      rationale: "List-style query where visibility gaps are most visible.",
    },
    {
      prompt_text: `Affordable ${topicLower} software with automation`,
      category: "commercial",
      rationale: "Feature + budget intent common in AI recommendations.",
    },
    {
      prompt_text: `What should I look for when evaluating ${topicLower} solutions?`,
      category: "informational",
      rationale: "Buying-guide query — tests whether you appear in consideration sets.",
    },
    {
      prompt_text: `Which ${topicLower} platforms are most popular right now?`,
      category: "commercial",
      rationale: "Trend/discovery query without naming any specific vendor.",
    },
  ];

  if (useCase && !containsBrandTerm(useCase, brandTerms(brand))) {
    out.push({
      prompt_text: `What tools help with ${useCase}?`,
      category: "informational",
      rationale: "Problem-aware query based on your value proposition.",
    });
  }

  for (const cat of brand.categories.slice(1, 4)) {
    const catLower = cat.toLowerCase();
    out.push({
      prompt_text: `What are the best ${catLower} options for ${audience}?`,
      category: "commercial",
      rationale: `Category query (${cat}) — tracks visibility in this market segment.`,
    });
  }

  // Competitor-only comparisons (no brand name) — useful to see who owns the category narrative
  for (const comp of competitors.slice(0, 3)) {
    const name = comp.name ?? comp.domain.split(".")[0];
    const other = competitors.find((c) => c.id !== comp.id);
    const otherName = other ? (other.name ?? other.domain.split(".")[0]) : null;
    if (otherName) {
      out.push({
        prompt_text: `${name} vs ${otherName} — which is better for ${audience}?`,
        category: "commercial",
        rationale: `Competitive landscape query — see if you get mentioned alongside ${name} and ${otherName}.`,
      });
    } else {
      out.push({
        prompt_text: `What are the best alternatives to ${name}?`,
        category: "commercial",
        rationale: `Alternative-seeking query — tests whether you appear when users move away from ${name}.`,
      });
    }
  }

  return out;
}

async function buildAiSuggestions(
  brand: Brand,
  competitors: Competitor[],
  existingPrompts: string[],
): Promise<SuggestedPrompt[] | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  const context = {
    industry: brand.industry,
    description: brand.description,
    categories: brand.categories,
    value_proposition: brand.value_proposition,
    audience: audienceFor(brand),
    competitors: competitors.map((c) => c.name ?? c.domain),
    existing_prompts: existingPrompts,
    // Brand name provided only so the model knows what NOT to put in prompts
    do_not_mention: [brand.name, ...brand.brand_aliases, normaliseDomain(brand.domain).split(".")[0]],
  };

  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
  const { object } = await generateObject({
    model: openai(openaiModel),
    schema: SuggestionsSchema,
    prompt: `You are an AI visibility strategist. Suggest 8–12 realistic user prompts for tracking GENERIC search visibility.

Context (JSON):
${JSON.stringify(context, null, 2)}

Purpose: These prompts simulate questions real users ask BEFORE they know about a specific brand. We track whether the brand appears in AI answers to category/market queries — NOT whether it appears when asked about directly.

CRITICAL RULES:
- NEVER include the brand name, domain, aliases, or any term in do_not_mention in the prompt text
- Focus on commercial and informational intent — queries where the brand HOPES to appear but is NOT guaranteed
- Do NOT suggest navigational or brand-specific prompts (e.g. "what is X", "X vs Y" where X is our brand)
- Use industry, categories, use cases, audience, and problems — not vendor names from do_not_mention
- Competitor names MAY appear only in third-party comparisons (e.g. "HubSpot vs Salesforce") or "alternatives to [competitor]" — never alongside our brand
- Prompts must sound like real user questions, not marketing copy
- Do NOT duplicate existing_prompts
- Prefer: best-of lists, how-to-choose, feature-specific, problem-aware, budget/use-case queries
- Each rationale: one short sentence explaining the visibility gap this query tests`,
  });

  return object.suggestions;
}

export async function generateSuggestedPrompts(
  brand: Brand,
  competitors: Competitor[],
  existingPrompts: string[],
): Promise<{ suggestions: SuggestedPrompt[]; source: "ai" | "templates" }> {
  let suggestions: SuggestedPrompt[] = [];
  let source: "ai" | "templates" = "templates";

  try {
    const ai = await buildAiSuggestions(brand, competitors, existingPrompts);
    if (ai?.length) {
      suggestions = ai;
      source = "ai";
    }
  } catch {
    // Fall through to templates
  }

  if (!suggestions.length) {
    suggestions = buildTemplateSuggestions(brand, competitors);
    source = "templates";
  }

  return {
    suggestions: dedupeSuggestions(suggestions, existingPrompts, brand).slice(0, 12),
    source,
  };
}
