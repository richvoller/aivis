import type { Platform, PromptCategory, Sentiment, Severity } from "./constants";

export interface NamedItem {
  name: string;
  description: string;
}

export interface KeyFact {
  fact: string;
  source_url: string | null;
}

export interface KeyPerson {
  name: string;
  role: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}

export type ProfileStatus = "empty" | "analyzing" | "ready" | "error";

export interface Brand {
  id: string;
  name: string;
  domain: string;
  description: string | null;

  // Brand information
  tagline: string | null;
  value_proposition: string | null;
  mission_statement: string | null;

  // Company details
  industry: string | null;
  headquarters: string | null;
  founded_year: number | null;
  company_size: string | null;

  // Structured arrays
  products: NamedItem[];
  services: NamedItem[];
  key_facts: KeyFact[];
  key_people: KeyPerson[];
  research_sources: ResearchSource[];

  // Detection + prompt-generation inputs
  brand_aliases: string[];
  categories: string[];

  // Content generation preferences
  content_language: string | null;
  tone_of_voice: string | null;
  writing_style: string | null;
  ai_image_style: string | null;
  banned_phrases: string[];

  // Default location & language
  primary_country: string | null;
  primary_language: string | null;

  // Analysis metadata
  profile_status: ProfileStatus;
  profile_generated_at: string | null;
  profile_error: string | null;

  created_at: string;
  updated_at: string;
}

export interface Competitor {
  id: string;
  brand_id: string;
  domain: string;
  name: string | null;
  created_at: string;
}

export interface TrackedPrompt {
  id: string;
  brand_id: string;
  prompt_text: string;
  category: PromptCategory | null;
  location_code: number | null;
  language_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptPlatformConfig {
  id: string;
  prompt_id: string;
  platform: Platform;
  model_name: string;
  is_active: boolean;
}

export interface ResponseSnapshot {
  id: string;
  brand_id: string;
  prompt_id: string | null;
  platform: Platform;
  model_name: string;
  fetched_at: string;
  brand_mentioned: boolean | null;
  brand_sentiment: Sentiment | null;
  brand_position: number | null;
  response_text: string | null;
  competitors_mentioned: string[] | null;
  cited_urls: string[] | null;
  fan_out_queries: string[] | null;
  raw_response: unknown;
}

export interface MentionSnapshot {
  id: string;
  brand_id: string;
  prompt_id: string | null;
  fetched_at: string;
  platform: string | null;
  mention_count: number | null;
  ai_search_volume: number | null;
  monthly_searches: number | null;
  raw_response: unknown;
}

export interface CitationDomain {
  id: string;
  brand_id: string;
  snapshot_date: string;
  domain: string;
  mention_count: number | null;
  is_own_domain: boolean;
  platform: string | null;
}

export interface CompetitorSovSnapshot {
  id: string;
  brand_id: string;
  snapshot_date: string;
  domain: string;
  mention_count: number | null;
  share_of_voice: number | null;
  platform: string | null;
}

export interface ActionItem {
  id: string;
  brand_id: string;
  title: string;
  detail: string | null;
  severity: Severity;
  category: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export type PromptWithConfig = TrackedPrompt & {
  prompt_platform_config: PromptPlatformConfig[];
};
