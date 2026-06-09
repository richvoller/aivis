-- Bump outdated platform defaults to current consumer-facing models (DataForSEO API names).
update public.prompt_platform_config
  set model_name = 'gpt-5.5'
  where platform = 'chatgpt'
    and model_name in ('gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3');

update public.prompt_platform_config
  set model_name = 'gemini-3.5-flash'
  where platform = 'gemini'
    and model_name in ('gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-pro', 'gemini-2.5-pro');
