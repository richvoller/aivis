-- Rich brand profile — AI-auto-researched (Perplexity + OpenAI) and editable.
-- Mirrors the structured brand settings (company details, products/services,
-- key facts/people, content prefs, location/language, aliases, categories).
-- All columns nullable so existing brands are unaffected.

alter table public.brands
  -- Brand information
  add column if not exists tagline           text,
  add column if not exists value_proposition text,
  add column if not exists mission_statement text,

  -- Company details
  add column if not exists industry      text,
  add column if not exists headquarters  text,
  add column if not exists founded_year  int,
  add column if not exists company_size  text,

  -- Products & services / facts & people  (arrays of {..} objects)
  --   products / services : [{ "name": text, "description": text }]
  --   key_facts           : [{ "fact": text, "source_url": text }]
  --   key_people          : [{ "name": text, "role": text }]
  --   research_sources     : [{ "title": text, "url": text }]
  add column if not exists products         jsonb not null default '[]'::jsonb,
  add column if not exists services         jsonb not null default '[]'::jsonb,
  add column if not exists key_facts        jsonb not null default '[]'::jsonb,
  add column if not exists key_people       jsonb not null default '[]'::jsonb,
  add column if not exists research_sources jsonb not null default '[]'::jsonb,

  -- Detection + prompt generation inputs
  add column if not exists brand_aliases text[] not null default '{}',
  add column if not exists categories    text[] not null default '{}',

  -- Content generation preferences
  add column if not exists content_language text default 'English',
  add column if not exists tone_of_voice    text default 'Professional',
  add column if not exists writing_style     text,
  add column if not exists ai_image_style    text default 'Default style',
  add column if not exists banned_phrases    text[] not null default '{}',

  -- Default location & language
  add column if not exists primary_country  text default 'United Kingdom',
  add column if not exists primary_language text default 'English',

  -- Analysis metadata
  add column if not exists profile_status       text not null default 'empty', -- 'empty' | 'analyzing' | 'ready' | 'error'
  add column if not exists profile_generated_at timestamptz,
  add column if not exists profile_error        text;
