import { COUNTRY_RESEARCH_TOPICS } from "./countryResearch.constants.js";
import { searchCountrySources } from "./countryResearch.sources.js";
import { interpretCountrySources } from "../ai/countryResearch.provider.js";

export const researchCountry = async ({ countryCode, countryName }) => {
  const sources = await searchCountrySources({
    countryName,
    topics: COUNTRY_RESEARCH_TOPICS,
  });

  if (sources.length < 2) {
    throw new Error(`Insufficient source material was retrieved for ${countryName}. Research was not marked complete.`);
  }

  const interpretation = await interpretCountrySources({
    countryName,
    countryCode,
    sources,
  });

  return {
    overview: interpretation.data.overview,
    requirements: interpretation.data.requirements,
    sources: sources.map(({ sourceKey, sourceName, url, domain, publishedAt, excerpt, score }) => ({
      sourceKey,
      sourceName,
      url,
      domain,
      publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : null,
      excerpt,
      score,
    })),
    metadata: {
      model: interpretation.model,
      requestId: interpretation.requestId,
    },
  };
};
