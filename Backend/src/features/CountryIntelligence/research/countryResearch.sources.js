const TAVILY_URL = "https://api.tavily.com/search";

const getApiKey = () => process.env.TAVILY_API_KEY?.trim();

const normalizeDomain = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return null; }
};

export const searchCountrySources = async ({ countryName, topics }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error("TAVILY_API_KEY is not configured. Add it to the backend environment to enable source-backed country research.");
    error.code = "COUNTRY_SEARCH_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }

  const results = await Promise.all(topics.map(async (topic) => {
    const response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: topic.query(countryName),
        topic: "general",
        search_depth: "advanced",
        max_results: 5,
        include_answer: false,
        include_raw_content: true,
      }),
      signal: AbortSignal.timeout(45000),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.detail || body?.error || `Country source search failed with HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }
    return Array.isArray(body?.results) ? body.results : [];
  }));

  const unique = new Map();
  for (const group of results) {
    for (const item of group) {
      if (!item?.url || !/^https?:\/\//i.test(item.url)) continue;
      const key = item.url.split("#")[0];
      const existing = unique.get(key);
      const raw = String(item.raw_content || item.content || "").trim();
      if (!existing || raw.length > existing.content.length) {
        unique.set(key, {
          sourceName: String(item.title || normalizeDomain(item.url) || "Untitled source").slice(0, 500),
          url: key,
          domain: normalizeDomain(key),
          publishedAt: item.published_date || null,
          content: raw.slice(0, 7000),
          score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
        });
      }
    }
  }

  return [...unique.values()].slice(0, 18).map((source, index) => ({
    ...source,
    sourceKey: `SRC_${index + 1}`,
    excerpt: source.content.slice(0, 5000),
  }));
};
