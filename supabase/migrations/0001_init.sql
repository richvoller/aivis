-- AI Visibility & Optimisation Tool — initial schema
-- Mirrors Part 4 of featureplan.md, with indexes + updated_at triggers added.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Brands / projects being tracked
-- ---------------------------------------------------------------------------
create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger brands_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Competitor domains per brand
-- ---------------------------------------------------------------------------
create table public.competitors (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brands on delete cascade,
  domain     text not null,
  name       text,
  created_at timestamptz not null default now()
);

create index competitors_brand_id_idx on public.competitors (brand_id);

-- ---------------------------------------------------------------------------
-- Prompts to run against LLMs per brand
-- ---------------------------------------------------------------------------
create table public.tracked_prompts (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands on delete cascade,
  prompt_text   text not null,
  category      text,            -- 'informational' | 'commercial' | 'navigational' | 'brand'
  location_code int,             -- for LLM Mentions geo targeting
  language_code text not null default 'en',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tracked_prompts_brand_id_idx on public.tracked_prompts (brand_id);

create trigger tracked_prompts_updated_at
  before update on public.tracked_prompts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Per-platform model config per prompt
-- ---------------------------------------------------------------------------
create table public.prompt_platform_config (
  id         uuid primary key default gen_random_uuid(),
  prompt_id  uuid not null references public.tracked_prompts on delete cascade,
  platform   text not null,      -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity'
  model_name text not null,
  is_active  boolean not null default true,
  unique (prompt_id, platform)
);

create index prompt_platform_config_prompt_id_idx on public.prompt_platform_config (prompt_id);

-- ---------------------------------------------------------------------------
-- Full LLM response snapshot (core tracking table)
-- ---------------------------------------------------------------------------
create table public.response_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references public.brands on delete cascade,
  prompt_id             uuid references public.tracked_prompts on delete set null,
  platform              text not null,
  model_name            text not null,
  fetched_at            timestamptz not null default now(),
  -- Parsed signal fields
  brand_mentioned       boolean,
  brand_sentiment       text,          -- 'positive' | 'neutral' | 'negative'
  brand_position        int,           -- char position of first brand mention
  response_text         text,
  -- Competitor presence
  competitors_mentioned text[],
  -- Sources / citations
  cited_urls            text[],
  fan_out_queries       text[],
  -- Raw data — always store for re-processing
  raw_response          jsonb
);

create index response_snapshots_brand_id_idx on public.response_snapshots (brand_id);
create index response_snapshots_prompt_id_idx on public.response_snapshots (prompt_id);
create index response_snapshots_platform_idx on public.response_snapshots (platform);
create index response_snapshots_fetched_at_idx on public.response_snapshots (fetched_at desc);

-- ---------------------------------------------------------------------------
-- LLM Mentions API snapshots (discovery + Google AIO benchmarking)
-- ---------------------------------------------------------------------------
create table public.mention_snapshots (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands on delete cascade,
  prompt_id        uuid references public.tracked_prompts on delete set null,
  fetched_at       timestamptz not null default now(),
  platform         text,            -- 'chat_gpt' | 'google'
  mention_count    int,
  ai_search_volume int,
  monthly_searches int,
  raw_response     jsonb
);

create index mention_snapshots_brand_id_idx on public.mention_snapshots (brand_id);

-- ---------------------------------------------------------------------------
-- Top cited domains from LLM Mentions API (citation gap analysis)
-- ---------------------------------------------------------------------------
create table public.citation_domains (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands on delete cascade,
  snapshot_date date not null default current_date,
  domain        text not null,
  mention_count int,
  is_own_domain boolean not null default false,
  platform      text
);

create index citation_domains_brand_id_idx on public.citation_domains (brand_id);

-- ---------------------------------------------------------------------------
-- Competitor share of voice (from Cross Aggregated Metrics)
-- ---------------------------------------------------------------------------
create table public.competitor_sov_snapshots (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.brands on delete cascade,
  snapshot_date  date not null default current_date,
  domain         text not null,
  mention_count  int,
  share_of_voice numeric,
  platform       text
);

create index competitor_sov_snapshots_brand_id_idx on public.competitor_sov_snapshots (brand_id);

-- ---------------------------------------------------------------------------
-- Action items (auto-generated recommendations, Priority 3 feature)
-- ---------------------------------------------------------------------------
create table public.action_items (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands on delete cascade,
  title       text not null,
  detail      text,
  severity    text not null default 'medium',  -- 'high' | 'medium' | 'low'
  category    text,                            -- 'visibility' | 'citation' | 'sentiment' | 'competitor'
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index action_items_brand_id_idx on public.action_items (brand_id);

create trigger action_items_updated_at
  before update on public.action_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Internal tool: the Next.js server uses the service_role key (bypasses RLS).
-- RLS is enabled with default-deny so the public/anon key cannot read data.
-- Authenticated users (once Supabase Auth is wired up) get full access.
-- ---------------------------------------------------------------------------
alter table public.brands                   enable row level security;
alter table public.competitors              enable row level security;
alter table public.tracked_prompts          enable row level security;
alter table public.prompt_platform_config   enable row level security;
alter table public.response_snapshots       enable row level security;
alter table public.mention_snapshots        enable row level security;
alter table public.citation_domains         enable row level security;
alter table public.competitor_sov_snapshots enable row level security;
alter table public.action_items             enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'brands','competitors','tracked_prompts','prompt_platform_config',
    'response_snapshots','mention_snapshots','citation_domains',
    'competitor_sov_snapshots','action_items'
  ]
  loop
    execute format(
      'create policy "authenticated_full_access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end;
$$;
