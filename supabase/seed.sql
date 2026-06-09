-- Seed data for local development.
-- Creates one demo brand with competitors, prompts, per-platform model config,
-- and ~30 days of response snapshots across all four platforms.

do $$
declare
  v_brand_id uuid;
  v_prompt record;
  v_platform text;
  v_model text;
  v_day int;
  v_mentioned boolean;
  v_sentiment text;
  v_competitors text[];
  v_cited text[];
  v_fanout text[];
  v_sentiments text[] := array['positive','neutral','negative'];
  v_all_competitors text[] := array['hubspot.com','salesforce.com','zoho.com'];
begin
  -- Brand
  insert into public.brands (name, domain, description)
  values ('Acme CRM', 'acmecrm.com', 'Demo brand for local development')
  returning id into v_brand_id;

  -- Competitors
  insert into public.competitors (brand_id, domain, name) values
    (v_brand_id, 'hubspot.com', 'HubSpot'),
    (v_brand_id, 'salesforce.com', 'Salesforce'),
    (v_brand_id, 'zoho.com', 'Zoho');

  -- Prompts
  insert into public.tracked_prompts (brand_id, prompt_text, category) values
    (v_brand_id, 'What is the best CRM for small businesses?', 'commercial'),
    (v_brand_id, 'How do I choose a CRM platform?', 'informational'),
    (v_brand_id, 'Acme CRM vs HubSpot comparison', 'brand'),
    (v_brand_id, 'Top CRM tools for sales teams in 2026', 'commercial'),
    (v_brand_id, 'Affordable CRM software with automation', 'commercial');

  -- Per-platform model config for every prompt
  for v_prompt in select id from public.tracked_prompts where brand_id = v_brand_id loop
    insert into public.prompt_platform_config (prompt_id, platform, model_name) values
      (v_prompt.id, 'chatgpt', 'gpt-5.5'),
      (v_prompt.id, 'claude', 'claude-sonnet-4-6'),
      (v_prompt.id, 'gemini', 'gemini-3.5-flash'),
      (v_prompt.id, 'perplexity', 'sonar-reasoning-pro');
  end loop;

  -- 30 days of response snapshots
  for v_prompt in select id, prompt_text from public.tracked_prompts where brand_id = v_brand_id loop
    foreach v_platform in array array['chatgpt','claude','gemini','perplexity'] loop
      v_model := case v_platform
        when 'chatgpt' then 'gpt-5.5'
        when 'claude' then 'claude-sonnet-4-6'
        when 'gemini' then 'gemini-3.5-flash'
        else 'sonar-reasoning-pro' end;

      for v_day in 0..29 loop
        -- mention probability varies by platform to make charts interesting
        v_mentioned := random() < (case v_platform
          when 'chatgpt' then 0.65
          when 'claude' then 0.45
          when 'gemini' then 0.55
          else 0.40 end);

        v_sentiment := case when v_mentioned
          then v_sentiments[1 + floor(random() * 2)::int]  -- positive/neutral mostly
          else null end;

        -- random subset of competitors
        v_competitors := array(
          select c from unnest(v_all_competitors) c where random() < 0.5
        );

        v_cited := array['en.wikipedia.org','g2.com','capterra.com'];
        v_fanout := array['best crm small business', 'crm pricing comparison', v_platform || ' crm recommendations'];

        insert into public.response_snapshots (
          brand_id, prompt_id, platform, model_name, fetched_at,
          brand_mentioned, brand_sentiment, brand_position,
          response_text, competitors_mentioned, cited_urls, fan_out_queries, raw_response
        ) values (
          v_brand_id, v_prompt.id, v_platform, v_model,
          now() - (v_day || ' days')::interval - (random() * interval '6 hours'),
          v_mentioned,
          v_sentiment,
          case when v_mentioned then floor(random() * 400)::int else null end,
          case when v_mentioned
            then 'When considering CRM options, Acme CRM stands out for small businesses thanks to its automation and pricing. Competitors include ' || array_to_string(v_competitors, ', ') || '.'
            else 'Popular CRM options include ' || array_to_string(v_all_competitors, ', ') || '. Each has different strengths for sales teams.' end,
          v_competitors, v_cited, v_fanout,
          jsonb_build_object('seeded', true, 'platform', v_platform, 'day', v_day)
        );
      end loop;
    end loop;
  end loop;

  -- Competitor share-of-voice snapshots (weekly, last 4 weeks)
  for v_day in 0..3 loop
    insert into public.competitor_sov_snapshots (brand_id, snapshot_date, domain, mention_count, share_of_voice, platform) values
      (v_brand_id, current_date - (v_day * 7), 'acmecrm.com', 30 + floor(random()*20)::int, 22 + random()*8, 'google'),
      (v_brand_id, current_date - (v_day * 7), 'hubspot.com', 50 + floor(random()*20)::int, 35 + random()*8, 'google'),
      (v_brand_id, current_date - (v_day * 7), 'salesforce.com', 40 + floor(random()*20)::int, 28 + random()*8, 'google'),
      (v_brand_id, current_date - (v_day * 7), 'zoho.com', 20 + floor(random()*15)::int, 15 + random()*5, 'google');
  end loop;

  -- Citation domains
  insert into public.citation_domains (brand_id, domain, mention_count, is_own_domain, platform) values
    (v_brand_id, 'g2.com', 45, false, 'google'),
    (v_brand_id, 'capterra.com', 38, false, 'google'),
    (v_brand_id, 'en.wikipedia.org', 30, false, 'google'),
    (v_brand_id, 'acmecrm.com', 12, true, 'google'),
    (v_brand_id, 'forbes.com', 9, false, 'google');

  -- Action items
  insert into public.action_items (brand_id, title, detail, severity, category) values
    (v_brand_id, 'Low visibility on Perplexity', 'Acme CRM appears in only 40% of Perplexity responses. Review commercial content for AI retrievability.', 'high', 'visibility'),
    (v_brand_id, 'Citation gap on g2.com', 'Competitors are heavily cited on g2.com where Acme CRM has limited presence.', 'medium', 'citation');
end;
$$;
