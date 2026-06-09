-- Auto-detected brands/domains from LLM responses (beyond the known-competitor whitelist).
alter table public.response_snapshots
  add column if not exists entities_detected text[];
