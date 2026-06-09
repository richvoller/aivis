/** A cited source with optional display title from the API. */
export interface CitationLink {
  url: string;
  title?: string;
}

function addCitation(map: Map<string, CitationLink>, url: unknown, title?: unknown) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) return;
  const normalised = url.trim();
  const existing = map.get(normalised);
  const label = typeof title === "string" && title.trim() ? title.trim() : undefined;
  if (!existing) {
    map.set(normalised, { url: normalised, title: label });
  } else if (!existing.title && label) {
    map.set(normalised, { ...existing, title: label });
  }
}

function collectFromAnnotationArrays(
  map: Map<string, CitationLink>,
  arrays: unknown[],
) {
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr as Array<Record<string, unknown>>) {
      addCitation(map, entry.url ?? entry.link ?? entry.source, entry.title);
    }
  }
}

/** Extract all citation URLs from a DataForSEO LLM response envelope. */
export function extractCitationsFromRaw(raw: unknown): CitationLink[] {
  const map = new Map<string, CitationLink>();
  const tasks = (raw as { tasks?: Array<Record<string, unknown>> })?.tasks;
  const result = tasks?.[0]?.result as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(result)) return [];

  for (const row of result) {
    collectFromAnnotationArrays(map, [
      row.sources,
      row.annotations,
      row.citations,
      row.references,
    ]);

    const items = row.items as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      collectFromAnnotationArrays(map, [
        item.sources,
        item.annotations,
        item.citations,
        item.references,
      ]);

      const sections = item.sections as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(sections)) continue;
      for (const section of sections) {
        collectFromAnnotationArrays(map, [
          section.annotations,
          section.citations,
          section.sources,
          section.references,
        ]);
      }
    }
  }

  return [...map.values()];
}

/** Merge stored URLs, raw API annotations, and markdown links from response text. */
export function collectAllCitations(
  responseText: string | null | undefined,
  storedUrls: string[] | null | undefined,
  rawResponse?: unknown,
): CitationLink[] {
  const map = new Map<string, CitationLink>();

  for (const u of storedUrls ?? []) addCitation(map, u);
  for (const c of extractCitationsFromRaw(rawResponse)) addCitation(map, c.url, c.title);

  const text = responseText ?? "";
  for (const m of text.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)) {
    addCitation(map, m[2], m[1]);
  }
  for (const u of text.match(/https?:\/\/[^\s)>\]"']+/gi) ?? []) {
    addCitation(map, u.replace(/[.,;:!?)]+$/, ""));
  }

  return [...map.values()];
}
