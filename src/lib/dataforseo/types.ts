import type { Platform } from "../constants";

export interface LlmResponseRequest {
  platform: Platform;
  model_name: string;
  user_prompt: string;
  max_output_tokens?: number;
  temperature?: number;
  system_message?: string;
  use_reasoning?: boolean;
}

/**
 * Normalised LLM response — the defensively-extracted subset of the raw
 * DataForSEO payload that our parser and UI rely on. The full raw payload is
 * always stored alongside this in `response_snapshots.raw_response`.
 */
export interface NormalisedLlmResponse {
  platform: Platform;
  model_name: string;
  response_text: string;
  cited_urls: string[];
  fan_out_queries: string[];
  /** Brand entities DataForSEO extracts automatically, when present. */
  brand_entities: string[];
  money_spent: number | null;
  raw: unknown;
}

export interface MentionSearchRow {
  keyword: string;
  platform: string;
  mention_count: number;
  ai_search_volume: number | null;
  monthly_searches: number | null;
  cited_sources: string[];
  non_cited_sources: string[];
}

export interface CrossAggregatedTarget {
  /** Label used in API response `items[].key`. */
  key: string;
  domain: string;
  /** Brand/competitor name for keyword matching in the mentions dataset. */
  keyword?: string;
}

export interface CrossAggregatedRow {
  domain: string;
  mention_count: number;
  share_of_voice: number;
  platform: string;
}

export interface TopDomainRow {
  domain: string;
  mention_count: number;
  platform: string;
}

export interface TopPageRow {
  url: string;
  domain: string;
  mention_count: number;
  platform: string;
}
